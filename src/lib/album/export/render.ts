/**
 * Print renderer. Runs in a Web Worker (OffscreenCanvas) — or on the main
 * thread as a fallback — one spread at a time on one canvas at the profile's
 * exact pixel size (trim + bleed). Originals are decoded one by one and
 * released immediately, the canvas is freed after encoding. Photo placement
 * (zoom, focal point, rotation) comes from the same placement() the editor
 * uses; text uses the same baselines (texts.ts).
 *
 * Why the browser and not a Vercel function: originals must never be proxied
 * through our servers (cost rule of the whole app), a function has 1–3 GB of
 * memory, a 4.5 MB response limit and a time limit, while a 40×30 spread at
 * 300 DPI alone is ~9520×3614 px ≈ 138 MB of RGBA. The photographer's laptop
 * reads originals straight from storage and has the memory for one spread.
 */
import { placement } from '../crop'
import { cssFont, fontById } from '../fonts'
import { formatFor, mmToPx, rectToSheetPx, sheetSizePx, type SpreadFormat } from '../geometry'
import { baselineOffsets, hexToRgb, ptToMm, textBox, textLines } from '../texts'
import type { AlbumPhoto, AlbumSpread, AlbumText, PrintSpec, Rect } from '../types'
import { srgbToAdobeRgbInPlace } from './color'
import { iccProfile } from './icc'
import { finalizeJpeg } from './jpeg-meta'
import type { PsdLayerInput } from './psd'

export class ExportError extends Error {
  constructor(public code: 'canvas_too_big' | 'original_failed' | 'aborted' | 'encode_failed' | 'fonts_failed', message: string) {
    super(message)
  }
}

export const JPEG_QUALITY = 0.95
const STRIP_ROWS = 256

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
export type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

export interface RenderedSpread {
  canvas: AnyCanvas
  width: number
  height: number
  /** Present when asked for (PSD): one layer per photo/text, pixels in the output colour space. */
  layers?: PsdLayerInput[]
}

export type LoadOriginal = (assetId: string) => Promise<Blob>

function intersect(r: Rect, width: number, height: number): Rect | null {
  const x = Math.max(r.x, 0)
  const y = Math.max(r.y, 0)
  const right = Math.min(r.x + r.w, width)
  const bottom = Math.min(r.y + r.h, height)
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null
}

function rawCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function allocateCanvas(width: number, height: number, opaque = true): { canvas: AnyCanvas; ctx: Ctx2D } {
  const canvas = rawCanvas(width, height)
  const ctx = canvas.getContext('2d', { alpha: !opaque }) as Ctx2D | null
  const fail = () =>
    new ExportError(
      'canvas_too_big',
      `Браузер не дав полотно ${width}×${height} px (не вистачає пам'яті або це телефон). Експортуйте на ноутбуці/комп'ютері, у Chrome, Edge, Firefox чи Safari.`
    )
  if (!ctx) throw fail()
  if (opaque) {
    // Some browsers hand back a context but silently refuse to allocate:
    // a probe pixel in the far corner tells.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    const probe = ctx.getImageData(width - 1, height - 1, 1, 1).data
    if (probe[0] !== 255 || probe[3] !== 255) {
      releaseCanvas(canvas)
      throw fail()
    }
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

export function releaseCanvas(canvas: AnyCanvas) {
  canvas.width = 0
  canvas.height = 0
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Draws text items onto a context whose origin is the sheet corner (bleed included). */
export function drawTexts(ctx: Ctx2D, texts: AlbumText[], format: SpreadFormat, dpi: number, offset = { x: 0, y: 0 }) {
  for (const t of texts) {
    if (!t.text.trim()) continue
    const sizePx = (ptToMm(t.sizePt) / 25.4) * dpi
    ctx.save()
    ctx.translate((t.x + format.bleedMm) / 25.4 * dpi - offset.x, (t.y + format.bleedMm) / 25.4 * dpi - offset.y)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.font = cssFont(t.font, sizePx)
    ctx.textAlign = t.align
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = t.color
    const offsets = baselineOffsets(t)
    textLines(t.text).forEach((line, i) => ctx.fillText(line, 0, (offsets[i]! / 25.4) * dpi))
    ctx.restore()
  }
}

/** Widest line in mm, measured with the real font. */
export function measureTextMm(ctx: Ctx2D, t: AlbumText): number {
  ctx.save()
  ctx.font = cssFont(t.font, 100)
  const w = Math.max(...textLines(t.text).map((l) => ctx.measureText(l).width), 1)
  ctx.restore()
  return (w / 100) * ptToMm(t.sizePt)
}

export interface RenderOptions {
  layers?: boolean
  /** Draw text into the bitmap (JPEG/PSD) — the PDF puts live text on top instead. */
  rasterText?: boolean
  onPhoto?: (index: number, total: number) => void
  signal?: AbortSignal
}

export async function renderSpread(
  spread: AlbumSpread,
  spec: PrintSpec,
  photosById: Map<string, AlbumPhoto>,
  loadOriginal: LoadOriginal,
  options: RenderOptions = {}
): Promise<RenderedSpread> {
  const format = formatFor(spec, spread)
  const { width, height } = sheetSizePx(format, spec.dpi)
  const { canvas, ctx } = allocateCanvas(width, height)
  const layers: PsdLayerInput[] = []
  const filled = spread.slots.filter((s) => s.assetId && photosById.has(s.assetId))
  try {
    for (let i = 0; i < filled.length; i++) {
      if (options.signal?.aborted) throw new ExportError('aborted', 'Експорт скасовано')
      options.onPhoto?.(i, filled.length)
      const slot = filled[i]!
      const photo = photosById.get(slot.assetId!)!
      const blob = await loadOriginal(photo.id)
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      try {
        const target = rectToSheetPx(slot, format, spec.dpi)
        const visible = intersect(target, width, height)
        if (!visible) continue
        const p = placement(bitmap.width, bitmap.height, slot.w, slot.h, slot.zoom, slot.fx, slot.fy, slot.rotation ?? 0)
        const pxPerMm = target.w / slot.w
        const scale = p.k * pxPerMm // sheet px per image px
        const draw = (c: Ctx2D, ox: number, oy: number) => {
          c.save()
          c.beginPath()
          c.rect(target.x - ox, target.y - oy, target.w, target.h)
          c.clip()
          c.translate(target.x - ox + target.w / 2, target.y - oy + target.h / 2)
          if (p.theta) c.rotate(p.theta)
          c.drawImage(bitmap, -p.cx * scale, -p.cy * scale, bitmap.width * scale, bitmap.height * scale)
          c.restore()
        }
        if (options.layers) {
          const layer = allocateCanvas(visible.w, visible.h, false)
          draw(layer.ctx, visible.x, visible.y)
          ctx.drawImage(layer.canvas, visible.x, visible.y)
          const data = layer.ctx.getImageData(0, 0, visible.w, visible.h).data
          if (spec.colorProfile === 'adobe_rgb') srgbToAdobeRgbInPlace(data)
          layers.push({ name: `Фото ${i + 1} — ${photo.name}`, left: visible.x, top: visible.y, width: visible.w, height: visible.h, data })
          releaseCanvas(layer.canvas)
        } else {
          draw(ctx, 0, 0)
        }
      } finally {
        bitmap.close()
      }
      await tick()
    }

    const texts = (spread.texts ?? []).filter((t) => t.text.trim())
    if (options.rasterText !== false && texts.length) {
      if (options.layers) {
        for (const t of texts) {
          const box = textBox(t, measureTextMm(ctx, t))
          const pad = 2 // mm, for swashes of script fonts
          const r = intersect(
            rectToSheetPx({ x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad }, format, spec.dpi),
            width,
            height
          )
          if (!r) continue
          const layer = allocateCanvas(r.w, r.h, false)
          drawTexts(layer.ctx, [t], format, spec.dpi, { x: r.x, y: r.y })
          ctx.drawImage(layer.canvas, r.x, r.y)
          const data = layer.ctx.getImageData(0, 0, r.w, r.h).data
          if (spec.colorProfile === 'adobe_rgb') srgbToAdobeRgbInPlace(data)
          layers.push({ name: `Текст — ${t.text.split('\n')[0]!.slice(0, 40)}`, left: r.x, top: r.y, width: r.w, height: r.h, data, text: psdTextData(t, format, spec.dpi) })
          releaseCanvas(layer.canvas)
        }
      } else {
        drawTexts(ctx, texts, format, spec.dpi)
      }
    }
  } catch (error) {
    releaseCanvas(canvas)
    throw error
  }
  return { canvas, width, height, layers: options.layers ? layers : undefined }
}

/** Live text data for a PSD text layer (Photoshop re-renders it on «Update»). */
export function psdTextData(t: AlbumText, format: SpreadFormat, dpi: number): NonNullable<PsdLayerInput['text']> {
  const a = (t.rotation * Math.PI) / 180
  const [r, g, b] = hexToRgb(t.color)
  return {
    text: textLines(t.text).join('\n'),
    fontPostscript: fontById(t.font).postscriptName,
    // Photoshop keeps font size in document pixels: pt × ppi / 72.
    fontSizePx: (t.sizePt * dpi) / 72,
    color: { r, g, b },
    justification: t.align,
    leadingPx: ((t.sizePt * (t.lineHeight || 1.25)) * dpi) / 72,
    transform: [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), mmToPx(t.x + format.bleedMm, dpi), mmToPx(t.y + format.bleedMm, dpi)],
  }
}

/** Converts the canvas to the output colour space in strips (no second full-size buffer). */
export async function convertCanvasColor(canvas: AnyCanvas, spec: PrintSpec): Promise<void> {
  if (spec.colorProfile !== 'adobe_rgb') return
  const ctx = canvas.getContext('2d') as Ctx2D
  for (let y = 0; y < canvas.height; y += STRIP_ROWS) {
    const h = Math.min(STRIP_ROWS, canvas.height - y)
    const strip = ctx.getImageData(0, y, canvas.width, h)
    srgbToAdobeRgbInPlace(strip.data)
    ctx.putImageData(strip, 0, y)
    if ((y / STRIP_ROWS) % 4 === 3) await tick()
  }
}

async function canvasJpeg(canvas: AnyCanvas): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
}

export async function encodeSpreadJpeg(canvas: AnyCanvas, spec: PrintSpec): Promise<Blob> {
  await convertCanvasColor(canvas, spec)
  const blob = await canvasJpeg(canvas)
  if (!blob) throw new ExportError('encode_failed', 'Браузер не зміг закодувати JPEG (замалий запас пам’яті?)')
  const bytes = finalizeJpeg(new Uint8Array(await blob.arrayBuffer()), spec.dpi, iccProfile(spec.colorProfile))
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
}

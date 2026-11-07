'use client'

/**
 * Browser renderer for print export. One spread at a time on one canvas at
 * the profile's exact pixel size (trim + bleed), originals decoded one by
 * one and released immediately, the canvas freed after encoding. The crop
 * comes from the same computeCrop the editor uses.
 *
 * Why the browser and not a Vercel function: originals must never be proxied
 * through our servers (cost rule of the whole app), a function has 1–3 GB of
 * memory, a 4.5 MB response limit and a time limit, while a 40×30 spread at
 * 300 DPI alone is ~9520×3614 px ≈ 138 MB of RGBA. The photographer's laptop
 * reads originals straight from storage and has the memory for one spread.
 */
import { computeCrop } from '../crop'
import { formatFor, rectToSheetPx, sheetSizePx } from '../geometry'
import type { AlbumPhoto, AlbumSpread, PrintSpec, Rect } from '../types'
import { srgbToAdobeRgbInPlace } from './color'
import { iccProfile } from './icc'
import { finalizeJpeg } from './jpeg-meta'
import type { PsdLayerInput } from './psd'

export class ExportError extends Error {
  constructor(public code: 'canvas_too_big' | 'original_failed' | 'aborted' | 'encode_failed', message: string) {
    super(message)
  }
}

export const JPEG_QUALITY = 0.95
const STRIP_ROWS = 256

export interface RenderedSpread {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** Present when asked for (PSD): one layer per photo, pixels already in the output colour space. */
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

export function allocateCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })
  const fail = () =>
    new ExportError(
      'canvas_too_big',
      `Браузер не дав полотно ${width}×${height} px (не вистачає пам'яті або це телефон). Експортуйте на ноутбуці/комп'ютері, у Chrome, Edge, Firefox чи Safari.`
    )
  if (!ctx) throw fail()
  // Some browsers hand back a context but silently refuse to allocate:
  // a probe pixel in the far corner tells.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  const probe = ctx.getImageData(width - 1, height - 1, 1, 1).data
  if (probe[0] !== 255 || probe[3] !== 255) {
    canvas.width = 0
    canvas.height = 0
    throw fail()
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function renderSpread(
  spread: AlbumSpread,
  spec: PrintSpec,
  photosById: Map<string, AlbumPhoto>,
  loadOriginal: LoadOriginal,
  options: { layers?: boolean; onPhoto?: (index: number, total: number) => void; signal?: AbortSignal } = {}
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
      let blob: Blob
      try {
        blob = await loadOriginal(photo.id)
      } catch (cause) {
        throw new ExportError('original_failed', `Не вдалося завантажити оригінал «${photo.name}»: ${(cause as Error).message}`)
      }
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      try {
        const target = rectToSheetPx(slot, format, spec.dpi)
        const crop = computeCrop(bitmap.width, bitmap.height, slot.w, slot.h, slot.zoom, slot.fx, slot.fy)
        const sx = crop.x * bitmap.width
        const sy = crop.y * bitmap.height
        const sw = crop.w * bitmap.width
        const sh = crop.h * bitmap.height
        const visible = intersect(target, width, height)
        if (!visible) continue
        if (options.layers) {
          // The layer is the visible part of the slot, drawn on its own canvas.
          const layer = allocateCanvas(visible.w, visible.h)
          layer.ctx.drawImage(bitmap, sx, sy, sw, sh, target.x - visible.x, target.y - visible.y, target.w, target.h)
          ctx.drawImage(layer.canvas, visible.x, visible.y)
          const data = layer.ctx.getImageData(0, 0, visible.w, visible.h).data
          if (spec.colorProfile === 'adobe_rgb') srgbToAdobeRgbInPlace(data)
          layers.push({ name: `Фото ${i + 1} — ${photo.name}`, left: visible.x, top: visible.y, width: visible.w, height: visible.h, data })
          releaseCanvas(layer.canvas)
        } else {
          ctx.save()
          ctx.beginPath()
          ctx.rect(visible.x, visible.y, visible.w, visible.h)
          ctx.clip()
          ctx.drawImage(bitmap, sx, sy, sw, sh, target.x, target.y, target.w, target.h)
          ctx.restore()
        }
      } finally {
        bitmap.close()
      }
      await tick()
    }
  } catch (error) {
    releaseCanvas(canvas)
    throw error
  }
  return { canvas, width, height, layers: options.layers ? layers : undefined }
}

/** Converts the canvas to the output colour space in strips (no second full-size buffer). */
export async function convertCanvasColor(canvas: HTMLCanvasElement, spec: PrintSpec): Promise<void> {
  if (spec.colorProfile !== 'adobe_rgb') return
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < canvas.height; y += STRIP_ROWS) {
    const h = Math.min(STRIP_ROWS, canvas.height - y)
    const strip = ctx.getImageData(0, y, canvas.width, h)
    srgbToAdobeRgbInPlace(strip.data)
    ctx.putImageData(strip, 0, y)
    if ((y / STRIP_ROWS) % 4 === 3) await tick()
  }
}

export async function encodeSpreadJpeg(canvas: HTMLCanvasElement, spec: PrintSpec): Promise<Blob> {
  await convertCanvasColor(canvas, spec)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new ExportError('encode_failed', 'Браузер не зміг закодувати JPEG (замалий запас пам’яті?)')
  const bytes = finalizeJpeg(new Uint8Array(await blob.arrayBuffer()), spec.dpi, iccProfile(spec.colorProfile))
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
}

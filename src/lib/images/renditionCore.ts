/**
 * Rendition rules (sizes, quality, watermark) shared by the main-thread
 * generator (./variants.ts — portfolio, fallback) and the Web Worker
 * (./renditions.worker.ts — gallery uploads). Works on any 2D canvas, so the
 * very same code runs with a DOM <canvas> or an OffscreenCanvas in a worker.
 * No DOM globals here: the caller hands in a canvas factory.
 */

export type RenditionName = 'preview' | 'thumb' | 'mobile'

export type RenditionType = 'image/jpeg' | 'image/webp'

export interface GeneratedVariant {
  name: RenditionName
  blob: Blob
  /** 'image/jpeg', or 'image/webp' for the mobile rendition where supported. */
  contentType: RenditionType
}

/** Renditions + the (orientation-corrected) pixel size from the same decode. */
export interface GeneratedRenditions {
  variants: GeneratedVariant[]
  width?: number
  height?: number
}

export interface Target {
  name: RenditionName
  maxDim: number
  quality: number
  webp?: boolean
  /** Carries the watermark (the renditions clients browse). */
  watermark?: boolean
}

export const TARGETS: Target[] = [
  { name: 'preview', maxDim: 2048, quality: 0.85, watermark: true },
  { name: 'thumb', maxDim: 512, quality: 0.8 },
]

/**
 * Light grid tile for phones (docs/MOBILE_PREVIEWS.md): ~80–180 KB instead of
 * the 0.4–1 MB preview. Only gallery uploads ask for it; the lightbox keeps
 * using `preview`.
 */
export const MOBILE_TARGET: Target = {
  name: 'mobile',
  maxDim: 1080,
  quality: 0.8,
  webp: true,
  watermark: true,
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface RenderCanvas {
  width: number
  height: number
  getContext(kind: '2d'): Context2D | null
}

export type Encoder = (canvas: RenderCanvas, type: string, quality: number) => Promise<Blob | null>

/**
 * WebP where the browser can encode it. Some Safari versions can't and quietly
 * hand back a PNG instead — then the tile is a JPEG of the same size.
 */
async function encodeTarget(
  canvas: RenderCanvas,
  target: Target,
  encode: Encoder
): Promise<{ blob: Blob; contentType: RenditionType } | null> {
  if (target.webp) {
    const webp = await encode(canvas, 'image/webp', target.quality)
    if (webp && webp.type === 'image/webp') return { blob: webp, contentType: 'image/webp' }
  }
  const jpeg = await encode(canvas, 'image/jpeg', target.quality)
  return jpeg ? { blob: jpeg, contentType: 'image/jpeg' } : null
}

/**
 * Optional watermark: the photographer's name stamped bottom-right on the
 * renditions clients browse (preview and the mobile grid tile) only. Originals
 * and downloads stay untouched — the watermark exists exactly where clients
 * browse, not where they buy.
 */
function stampWatermark(context: Context2D, width: number, height: number, text: string) {
  const size = Math.max(Math.round(width / 36), 14)
  context.font = `600 ${size}px -apple-system, "Segoe UI", sans-serif`
  context.textAlign = 'right'
  context.textBaseline = 'bottom'
  context.shadowColor = 'rgba(0,0,0,.45)'
  context.shadowBlur = size / 3
  context.fillStyle = 'rgba(255,255,255,.6)'
  context.fillText(text, width - size, height - size)
}

/** Every rendition of one decoded image. The caller owns (and closes) the bitmap. */
export async function renderFromBitmap(
  bitmap: ImageBitmap,
  makeCanvas: (width: number, height: number) => RenderCanvas,
  encode: Encoder,
  watermarkText?: string,
  options: { mobile?: boolean } = {}
): Promise<GeneratedRenditions> {
  const variants: GeneratedVariant[] = []
  const targets = options.mobile ? [...TARGETS, MOBILE_TARGET] : TARGETS
  for (const target of targets) {
    const scale = target.maxDim / Math.max(bitmap.width, bitmap.height)
    // A watermarked preview must exist even for small originals, otherwise
    // the viewer would fall back to the clean original.
    const mustRender = target.name === 'preview' && !!watermarkText
    if (scale >= 1 && !mustRender) continue

    const effective = Math.min(scale, 1)
    const canvas = makeCanvas(
      Math.round(bitmap.width * effective),
      Math.round(bitmap.height * effective)
    )
    const context = canvas.getContext('2d')
    if (!context) continue
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    if (target.watermark && watermarkText) {
      stampWatermark(context, canvas.width, canvas.height, watermarkText)
    }

    const encoded = await encodeTarget(canvas, target, encode)
    if (encoded) variants.push({ name: target.name, ...encoded })
    // Free the pixels now rather than at GC: a 2048 canvas is 16 MB.
    canvas.width = 0
    canvas.height = 0
  }
  return { variants, width: bitmap.width, height: bitmap.height }
}

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

/** What the upload already knows about the photo (EXIF read once, upload/client.ts). */
export interface SourceHints {
  /** EXIF orientation 1–8. */
  orientation?: number | null
  /** Pixel size as stored, before orientation (EXIF PixelX/YDimension). */
  rawWidth?: number | null
  rawHeight?: number | null
}

/**
 * HEIC/HEIF by MIME type, extension or the ISO-BMFF brand («ftypheic»…):
 * Chrome on Windows/Android hands HEIC files over with an empty type.
 */
export function looksLikeHeic(type: string, name: string, head?: Uint8Array): boolean {
  if (/^image\/hei[cf](-sequence)?$/i.test(type)) return true
  if (/\.(heic|heif)$/i.test(name)) return true
  if (head && head.length >= 12) {
    const box = String.fromCharCode(...head.slice(4, 12))
    return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(box)
  }
  return false
}

/** Formats every browser shows in <img>: anything else needs a rendition. */
export function isWebDisplayable(type: string): boolean {
  return /^image\/(jpeg|png|webp|gif|avif)$/i.test(type)
}

/**
 * HEIC/TIFF originals can't be shown by most browsers: they always get a
 * preview and a grid tile, whatever their size — never an empty tile.
 */
export function needsRendition(type: string, name: string): boolean {
  return looksLikeHeic(type, name) || !isWebDisplayable(type)
}

/**
 * The orientation the browser did NOT apply and we must (1 = none). The
 * browser applies EXIF orientation itself (`imageOrientation: 'from-image'`);
 * some older engines ignore it for blobs, and that is caught here: if the EXIF
 * says «turned by 90°» but the bitmap still has the stored (unturned) size,
 * we turn it while drawing.
 */
export function pendingOrientation(bitmap: { width: number; height: number }, hints: SourceHints): number {
  const { orientation, rawWidth, rawHeight } = hints
  const swaps = !!orientation && orientation >= 5 && orientation <= 8
  const notApplied =
    swaps &&
    !!rawWidth &&
    !!rawHeight &&
    rawWidth !== rawHeight &&
    bitmap.width === rawWidth &&
    bitmap.height === rawHeight
  return notApplied ? (orientation as number) : 1
}

/**
 * Canvas transform (a, b, c, d, e, f) that turns a stored image into its
 * upright w×h picture for EXIF orientation 1–8 (x′ = a·x + c·y + e,
 * y′ = b·x + d·y + f).
 */
export function orientationTransform(
  orientation: number,
  width: number,
  height: number
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: return [-1, 0, 0, 1, width, 0]
    case 3: return [-1, 0, 0, -1, width, height]
    case 4: return [1, 0, 0, -1, 0, height]
    case 5: return [0, 1, 1, 0, 0, 0]
    case 6: return [0, 1, -1, 0, width, 0]
    case 7: return [0, -1, -1, 0, width, height]
    case 8: return [0, -1, 1, 0, 0, height]
    default: return [1, 0, 0, 1, 0, 0]
  }
}

/** Draws the bitmap upright into a w×h canvas, applying an orientation the browser left undone. */
function drawOriented(context: Context2D, bitmap: ImageBitmap, orientation: number, width: number, height: number) {
  context.setTransform(...orientationTransform(orientation, width, height))
  const swaps = orientation >= 5 && orientation <= 8
  context.drawImage(bitmap, 0, 0, swaps ? height : width, swaps ? width : height)
  context.setTransform(1, 0, 0, 1, 0, 0)
}

export interface RenderOptions {
  mobile?: boolean
  /** Orientation still to apply (pendingOrientation); 1 or absent = none. */
  orientation?: number
  /** Always render preview + grid tile (HEIC/TIFF: the browser can't show the original). */
  needsRendition?: boolean
}

/** Every rendition of one decoded image. The caller owns (and closes) the bitmap. */
export async function renderFromBitmap(
  bitmap: ImageBitmap,
  makeCanvas: (width: number, height: number) => RenderCanvas,
  encode: Encoder,
  watermarkText?: string,
  options: RenderOptions = {}
): Promise<GeneratedRenditions> {
  const pending = options.orientation ?? 1
  const swaps = pending >= 5 && pending <= 8
  // Upright size (after orientation).
  const width = swaps ? bitmap.height : bitmap.width
  const height = swaps ? bitmap.width : bitmap.height
  const variants: GeneratedVariant[] = []
  const targets = options.mobile ? [...TARGETS, MOBILE_TARGET] : TARGETS
  for (const target of targets) {
    const scale = target.maxDim / Math.max(width, height)
    // A watermarked preview must exist even for small originals, otherwise
    // the viewer would fall back to the clean original.
    const mustRender =
      (target.name === 'preview' && (!!watermarkText || !!options.needsRendition)) ||
      (target.name === 'mobile' && !!options.needsRendition)
    if (scale >= 1 && !mustRender) continue

    const effective = Math.min(scale, 1)
    const canvas = makeCanvas(Math.round(width * effective), Math.round(height * effective))
    const context = canvas.getContext('2d')
    if (!context) continue
    drawOriented(context, bitmap, pending, canvas.width, canvas.height)
    if (target.watermark && watermarkText) {
      stampWatermark(context, canvas.width, canvas.height, watermarkText)
    }

    const encoded = await encodeTarget(canvas, target, encode)
    if (encoded) variants.push({ name: target.name, ...encoded })
    // Free the pixels now rather than at GC: a 2048 canvas is 16 MB.
    canvas.width = 0
    canvas.height = 0
  }
  return { variants, width, height }
}

'use client'

/**
 * Client-side rendition generation. Runs in the browser at upload time so the
 * MVP gets thumb/preview variants with ZERO server infrastructure — the same
 * presigned-PUT path used for originals. When a real image pipeline (worker +
 * watermark) lands, it replaces this file and starts filling assets.variants
 * server-side; nothing else changes.
 *
 * Rule encoded here: gallery viewing NEVER serves originals. The preview cap
 * (2048px) is plenty for screens; originals are only reachable through the
 * explicit download endpoint.
 */

export type RenditionName = 'preview' | 'thumb' | 'mobile'

export interface GeneratedVariant {
  name: RenditionName
  blob: Blob
  /** 'image/jpeg', or 'image/webp' for the mobile rendition where supported. */
  contentType: 'image/jpeg' | 'image/webp'
}

/** Renditions + the (orientation-corrected) pixel size from the same decode. */
export interface GeneratedRenditions {
  variants: GeneratedVariant[]
  width?: number
  height?: number
}

interface Target {
  name: RenditionName
  maxDim: number
  quality: number
  webp?: boolean
  /** Carries the watermark (the renditions clients browse). */
  watermark?: boolean
}

const TARGETS: Target[] = [
  { name: 'preview', maxDim: 2048, quality: 0.85, watermark: true },
  { name: 'thumb', maxDim: 512, quality: 0.8 },
]

/**
 * Light grid tile for phones (docs/MOBILE_PREVIEWS.md): ~80–180 KB instead of
 * the 0.4–1 MB preview. Only gallery uploads ask for it; the lightbox keeps
 * using `preview`.
 */
const MOBILE_TARGET: Target = { name: 'mobile', maxDim: 1080, quality: 0.8, webp: true, watermark: true }

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * WebP where the browser can encode it. Some Safari versions can't and quietly
 * hand back a PNG instead — then the tile is a JPEG of the same size.
 */
async function encode(
  canvas: HTMLCanvasElement,
  target: Target
): Promise<{ blob: Blob; contentType: 'image/jpeg' | 'image/webp' } | null> {
  if (target.webp) {
    const webp = await canvasToBlob(canvas, 'image/webp', target.quality)
    if (webp && webp.type === 'image/webp') return { blob: webp, contentType: 'image/webp' }
  }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', target.quality)
  return jpeg ? { blob: jpeg, contentType: 'image/jpeg' } : null
}

/**
 * Optional watermark: the photographer's name stamped bottom-right on the
 * renditions clients browse (preview and the mobile grid tile) only. Originals and downloads stay untouched — the
 * watermark exists exactly where clients browse, not where they buy.
 */
function stampWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
) {
  const size = Math.max(Math.round(width / 36), 14)
  context.font = `600 ${size}px -apple-system, "Segoe UI", sans-serif`
  context.textAlign = 'right'
  context.textBaseline = 'bottom'
  context.shadowColor = 'rgba(0,0,0,.45)'
  context.shadowBlur = size / 3
  context.fillStyle = 'rgba(255,255,255,.6)'
  context.fillText(text, width - size, height - size)
}

/** What the upload already knows about the photo (EXIF read once, client.ts). */
export interface SourceHints {
  /** EXIF orientation 1–8. */
  orientation?: number | null
  /** Pixel size as stored, before orientation (EXIF PixelX/YDimension). */
  rawWidth?: number | null
  rawHeight?: number | null
}

interface Decoded {
  bitmap: ImageBitmap
  /** Upright size (after orientation). */
  width: number
  height: number
  /** Orientation the browser did NOT apply and we must (1 = none). */
  pending: number
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
 * Decodes the photo upright. The browser applies EXIF orientation itself
 * (`imageOrientation: 'from-image'`); some older engines ignore it for blobs,
 * and that is caught here: if the EXIF says «turned by 90°» but the bitmap
 * still has the stored (unturned) size, we turn it while drawing.
 *
 * HEIC: Safari decodes it natively; elsewhere libheif is loaded on demand from
 * heic-to (LGPL-3.0) — kept an unmodified, separately loaded module
 * (dynamic import, its own chunk; see docs/THIRD_PARTY_NOTICES.md). libheif
 * applies the HEIF rotation (irot) itself.
 */
async function decodeUpright(file: File, hints: SourceHints): Promise<Decoded | null> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = null
  }
  if (!bitmap) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer().catch(() => new ArrayBuffer(0)))
    if (!looksLikeHeic(file.type, file.name, head)) return null
    try {
      const { heicTo } = await import('heic-to/next')
      bitmap = await heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } })
    } catch {
      return null
    }
    return { bitmap, width: bitmap.width, height: bitmap.height, pending: 1 }
  }

  const { orientation, rawWidth, rawHeight } = hints
  const swaps = !!orientation && orientation >= 5 && orientation <= 8
  const notApplied =
    swaps &&
    !!rawWidth &&
    !!rawHeight &&
    rawWidth !== rawHeight &&
    bitmap.width === rawWidth &&
    bitmap.height === rawHeight
  if (notApplied) {
    return { bitmap, width: bitmap.height, height: bitmap.width, pending: orientation as number }
  }
  return { bitmap, width: bitmap.width, height: bitmap.height, pending: 1 }
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
function drawOriented(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  orientation: number,
  width: number,
  height: number
) {
  context.setTransform(...orientationTransform(orientation, width, height))
  const swaps = orientation >= 5 && orientation <= 8
  context.drawImage(bitmap, 0, 0, swaps ? height : width, swaps ? width : height)
  context.setTransform(1, 0, 0, 1, 0, 0)
}

export async function generateImageVariants(
  file: File,
  watermarkText?: string,
  options: { mobile?: boolean; hints?: SourceHints } = {}
): Promise<GeneratedRenditions> {
  const heic = looksLikeHeic(file.type, file.name)
  if (!file.type.startsWith('image/') && !heic) return { variants: [] }

  const decoded = await decodeUpright(file, options.hints ?? {})
  // Unsupported format — the viewer falls back to the original.
  if (!decoded) return { variants: [] }
  const { bitmap, width, height, pending } = decoded
  // HEIC/TIFF originals can't be shown by most browsers: they always get a
  // preview (and a grid tile), whatever their size — never an empty tile.
  const needsRendition = heic || !isWebDisplayable(file.type)

  const size = { width, height }
  const variants: GeneratedVariant[] = []
  try {
    const targets = options.mobile ? [...TARGETS, MOBILE_TARGET] : TARGETS
    for (const target of targets) {
      const scale = target.maxDim / Math.max(width, height)
      // A watermarked preview must exist even for small originals, otherwise
      // the viewer would fall back to the clean original.
      const mustRender =
        (target.name === 'preview' && (!!watermarkText || needsRendition)) ||
        (target.name === 'mobile' && needsRendition)
      if (scale >= 1 && !mustRender) continue

      const effective = Math.min(scale, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * effective)
      canvas.height = Math.round(height * effective)
      const context = canvas.getContext('2d')
      if (!context) continue
      drawOriented(context, bitmap, pending, canvas.width, canvas.height)
      if (target.watermark && watermarkText) {
        stampWatermark(context, canvas.width, canvas.height, watermarkText)
      }

      const encoded = await encode(canvas, target)
      if (encoded) variants.push({ name: target.name, ...encoded })
    }
  } finally {
    bitmap.close()
  }
  return { variants, ...size }
}

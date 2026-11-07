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

export async function generateImageVariants(
  file: File,
  watermarkText?: string,
  options: { mobile?: boolean } = {}
): Promise<GeneratedRenditions> {
  if (!file.type.startsWith('image/')) return { variants: [] }

  let bitmap: ImageBitmap
  try {
    // 'from-image' bakes EXIF orientation in, so variants are always upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Unsupported format (e.g. some HEICs) — viewer falls back to the original.
    return { variants: [] }
  }

  const size = { width: bitmap.width, height: bitmap.height }
  const variants: GeneratedVariant[] = []
  try {
    const targets = options.mobile ? [...TARGETS, MOBILE_TARGET] : TARGETS
    for (const target of targets) {
      const scale = target.maxDim / Math.max(bitmap.width, bitmap.height)
      // A watermarked preview must exist even for small originals, otherwise
      // the viewer would fall back to the clean original.
      const mustRender = target.name === 'preview' && !!watermarkText
      if (scale >= 1 && !mustRender) continue

      const effective = Math.min(scale, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * effective)
      canvas.height = Math.round(bitmap.height * effective)
      const context = canvas.getContext('2d')
      if (!context) continue
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
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

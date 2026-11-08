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
 *
 * This is the MAIN-THREAD generator (portfolio uploads, and the fallback where
 * a browser has no OffscreenCanvas in workers). Gallery uploads go through
 * ./renditionPool.ts, which runs the same rules (./renditionCore.ts) in a Web
 * Worker so a big PNG never freezes the tab.
 */

import {
  looksLikeHeic,
  needsRendition,
  pendingOrientation,
  renderFromBitmap,
  type GeneratedRenditions,
  type RenderCanvas,
  type SourceHints,
} from './renditionCore'

export type {
  GeneratedRenditions,
  GeneratedVariant,
  RenditionName,
  SourceHints,
} from './renditionCore'
export { isWebDisplayable, looksLikeHeic, orientationTransform } from './renditionCore'

function makeCanvas(width: number, height: number): RenderCanvas {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function encode(canvas: RenderCanvas, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality))
}

interface Decoded {
  bitmap: ImageBitmap
  /** Orientation the browser did NOT apply and we must (1 = none). */
  pending: number
}

/**
 * Decodes the photo. Orientation: see pendingOrientation (renditionCore).
 *
 * HEIC: Safari decodes it natively; elsewhere libheif is loaded on demand from
 * heic-to (LGPL-3.0) — kept an unmodified, separately loaded module
 * (dynamic import, its own chunk; see docs/THIRD_PARTY_NOTICES.md). libheif
 * applies the HEIF rotation (irot) itself. The rendition Web Worker can't use
 * it, so a HEIC the worker can't decode comes back here (renditionPool.ts).
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
    return { bitmap, pending: 1 }
  }
  return { bitmap, pending: pendingOrientation(bitmap, hints) }
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
  const { bitmap, pending } = decoded

  try {
    return await renderFromBitmap(bitmap, makeCanvas, encode, watermarkText, {
      mobile: options.mobile,
      orientation: pending,
      needsRendition: needsRendition(file.type, file.name),
    })
  } finally {
    bitmap.close()
  }
}

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
  renderFromBitmap,
  type GeneratedRenditions,
  type RenderCanvas,
} from './renditionCore'

export type {
  GeneratedRenditions,
  GeneratedVariant,
  RenditionName,
} from './renditionCore'

function makeCanvas(width: number, height: number): RenderCanvas {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function encode(canvas: RenderCanvas, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality))
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

  try {
    return await renderFromBitmap(bitmap, makeCanvas, encode, watermarkText, options)
  } finally {
    bitmap.close()
  }
}

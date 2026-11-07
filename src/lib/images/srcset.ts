/**
 * Width descriptors for the browser-made renditions (src/lib/images/variants.ts):
 * `mobile` is scaled to a longest side of 1080 px, `preview` to 2048 px; a
 * smaller original keeps its size. With the pixel size unknown (old rows) the
 * nominal 1080/2048 is the best guess.
 */
export const MOBILE_MAX_DIM = 1080
export const PREVIEW_MAX_DIM = 2048

export function renditionWidth(maxDim: number, width?: number | null, height?: number | null): number {
  if (!width || !height) return maxDim
  return Math.round(width * Math.min(1, maxDim / Math.max(width, height)))
}

/**
 * `srcset` for a photo that has a `mobile` rendition: «mobile 1080w, preview
 * 2048w» (real widths when the size is known). Undefined without mobile —
 * callers then render just the preview, as before.
 */
export function mobilePreviewSrcSet(item: {
  mobileUrl?: string | null
  previewUrl: string
  width?: number | null
  height?: number | null
}): string | undefined {
  if (!item.mobileUrl) return undefined
  const mobileW = renditionWidth(MOBILE_MAX_DIM, item.width, item.height)
  const previewW = renditionWidth(PREVIEW_MAX_DIM, item.width, item.height)
  // A small original: both renditions are the same size — the light one is enough.
  if (mobileW >= previewW) return `${item.mobileUrl} ${mobileW}w`
  return `${item.mobileUrl} ${mobileW}w, ${item.previewUrl} ${previewW}w`
}

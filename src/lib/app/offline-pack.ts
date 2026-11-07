/** Server-side rules of the offline portfolio (see lib/app/portfolio.ts). */
export const MAX_OFFLINE_PHOTOS_SERVER = 300

/**
 * Which rendition goes to the phone: the mobile one (≈1080 px WebP), else
 * the 2048 px preview for photos uploaded before mobile renditions existed.
 * Never the original; null = nothing light enough to keep.
 */
export function offlinePhotoKey(variants: Record<string, string> | null | undefined): string | null {
  if (!variants) return null
  return variants.mobile ?? variants.preview ?? null
}

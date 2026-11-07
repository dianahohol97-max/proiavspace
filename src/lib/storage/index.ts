import { B2Provider, R2Provider } from './R2Provider'
import type { StorageProvider } from './StorageProvider'

let cached: StorageProvider | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

/**
 * Server-only factory. Adding a provider (Backblaze B2, Bunny, …) means one
 * new class implementing StorageProvider plus a case here.
 */
export function getStorage(): StorageProvider {
  if (cached) return cached
  const provider = process.env.STORAGE_PROVIDER ?? 'r2'
  switch (provider) {
    case 'r2':
      cached = new R2Provider({
        accountId: requireEnv('R2_ACCOUNT_ID'),
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
        bucket: requireEnv('R2_BUCKET'),
      })
      return cached
    case 'b2':
      cached = new B2Provider({
        region: requireEnv('B2_REGION'),
        keyId: requireEnv('B2_KEY_ID'),
        applicationKey: requireEnv('B2_APPLICATION_KEY'),
        bucket: requireEnv('B2_BUCKET'),
      })
      return cached
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`)
  }
}

/** Canonical object key layout. Everything for a gallery shares one prefix. */
export function galleryPrefix(ownerId: string, galleryId: string): string {
  return `u/${ownerId}/g/${galleryId}/`
}

export function originalKey(ownerId: string, galleryId: string, fileName: string): string {
  const safeName = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-80)
  return `${galleryPrefix(ownerId, galleryId)}o/${crypto.randomUUID()}-${safeName}`
}

// 'poster' is a still frame for a video, shown in the grid so the tile never
// pulls the full original just to render. 'mobile' is a ~1080 px WebP for the
// gallery grid on phones (docs/MOBILE_PREVIEWS.md); older assets don't have it
// and the grid falls back to 'preview'.
export const VARIANT_NAMES = ['preview', 'thumb', 'poster', 'mobile'] as const
export type VariantName = (typeof VARIANT_NAMES)[number]

export function isVariantName(value: string): value is VariantName {
  return (VARIANT_NAMES as readonly string[]).includes(value)
}

/** Renditions are made in the browser as JPEG, or WebP for 'mobile'. */
export function isVariantContentType(contentType: string): boolean {
  return contentType === 'image/jpeg' || contentType === 'image/webp'
}

/** File extension of a rendition: WebP where the browser could encode it, else JPEG. */
export function variantExtension(contentType?: string): 'webp' | 'jpg' {
  return contentType === 'image/webp' ? 'webp' : 'jpg'
}

export function variantKey(
  ownerId: string,
  galleryId: string,
  variant: VariantName,
  contentType?: string
): string {
  return `${galleryPrefix(ownerId, galleryId)}v/${crypto.randomUUID()}-${variant}.${variantExtension(contentType)}`
}

/* ---- portfolio (photographer site) -------------------------------------- */

/** Everything a photographer's site portfolio stores lives under this prefix. */
export function portfolioPrefix(ownerId: string): string {
  return `u/${ownerId}/portfolio/`
}

/**
 * Key of a portfolio rendition: …/portfolio/v/<uuid>-<variant>.jpg, or .webp
 * for the `mobile` phone copy — the same …/v/ shape as gallery variants, so
 * the CDN Worker serves it.
 */
export function portfolioVariantKey(ownerId: string, variant: VariantName, contentType?: string): string {
  return `${portfolioPrefix(ownerId)}v/${crypto.randomUUID()}-${variant}.${variantExtension(contentType)}`
}

/** /api/portfolio/complete: the original and every rendition must be the caller's own. */
export function portfolioKeysOwned(ownerId: string, key: string, variants: Record<string, string> = {}): boolean {
  const prefix = portfolioPrefix(ownerId)
  return [key, ...Object.values(variants)].every((k) => typeof k === 'string' && k.startsWith(prefix))
}

/**
 * What deleting one portfolio photo removes from storage: the original and
 * every rendition in `variants` (preview, thumb, mobile…), never anything
 * outside the owner's portfolio prefix.
 */
export function portfolioDeleteKeys(
  ownerId: string,
  asset: { r2_key: string; variants: Record<string, string> | null }
): string[] {
  const prefix = portfolioPrefix(ownerId)
  return [asset.r2_key, ...Object.values(asset.variants ?? {})].filter(
    (key) => typeof key === 'string' && key.startsWith(prefix)
  )
}

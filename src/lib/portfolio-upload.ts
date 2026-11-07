import { isVariantName } from '@/lib/storage'

/** Body of /api/portfolio/complete — the browser's report after the direct PUTs. */
export interface PortfolioCompleteBody {
  key: string
  contentType: string
  sizeBytes: number
  width?: number
  height?: number
  /** Rendition name → key: preview, thumb and (since release 4) mobile. */
  variants?: Record<string, string>
  category?: string
}

export function parsePortfolioComplete(value: unknown): PortfolioCompleteBody | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const variantsOk =
    v.variants === undefined ||
    (typeof v.variants === 'object' &&
      v.variants !== null &&
      Object.entries(v.variants).every(([name, key]) => isVariantName(name) && typeof key === 'string'))
  const ok =
    typeof v.key === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number' &&
    (v.width === undefined || typeof v.width === 'number') &&
    (v.height === undefined || typeof v.height === 'number') &&
    (v.category === undefined || typeof v.category === 'string') &&
    variantsOk
  return ok ? (v as unknown as PortfolioCompleteBody) : null
}

/**
 * The portfolio_assets row. `size_bytes` is the ORIGINAL only — the storage
 * accounting trigger (0009) and the quota guard (0045) count exactly this, so
 * renditions (preview, thumb, mobile) never touch the photographer's quota;
 * they are just keys in `variants`, removed together with the photo.
 */
export function portfolioAssetRow(ownerId: string, body: PortfolioCompleteBody) {
  return {
    owner_id: ownerId,
    r2_key: body.key,
    content_type: body.contentType,
    width: body.width ?? null,
    height: body.height ?? null,
    size_bytes: body.sizeBytes,
    variants: body.variants ?? {},
    category: body.category?.trim().slice(0, 60) || null,
  }
}

/**
 * Row types for the Phase 1 schema (supabase/migrations/0001_phase1_galleries.sql).
 * Kept by hand for now; switch to `supabase gen types typescript` once the
 * schema stabilises.
 */

export type Locale = 'uk' | 'en'

export interface Profile {
  user_id: string
  display_name: string | null
  /** Latin-script name, shown on English-locale galleries. */
  display_name_en: string | null
  /** One client-facing contact link (Instagram / site / mailto: / tel:). */
  contact_url: string | null
  logo_url: string | null
  locale: Locale
  plan: string
  site_plan: string
  grace_until: string | null
  watermark_enabled: boolean
  storage_used_bytes: number
  storage_limit_bytes: number
  referral_code: string | null
  referred_by: string | null
  credit_balance_kop: number
  cash_balance_kop: number
  is_ambassador: boolean
  /** Set by the retention cron when galleries are closed to clients (LC-01). */
  gallery_closed_at: string | null
  created_at: string
  updated_at: string
}

export interface Gallery {
  id: string
  owner_id: string
  slug: string
  title: string
  description: string | null
  event_date: string | null
  cover_asset_id: string | null
  /** Whether a password is set. The scrypt hash itself is never selectable by
   *  the anon/authenticated key — only the service role reads it (unlock route). */
  has_password: boolean
  expires_at: string | null
  /** Free plan's 30-day deadline (migration 0049); null on paid plans. */
  free_expires_at?: string | null
  /** Set by the cron when the deadline passed: closed to clients. */
  free_expired_at?: string | null
  /** Files deleted 7 days after closure. */
  free_purged_at?: string | null
  is_published: boolean
  /** Shoot status shown to the client (migration 0055): 'shot' «зйомка
   *  пройшла», 'editing' «обробка», 'ready' «готово». null = not shown.
   *  Optional until 0055 is applied in production. */
  delivery_status?: GalleryDeliveryStatus | null
  /** Estimated date the photos are ready (YYYY-MM-DD, 0055); null = not set. */
  delivery_eta?: string | null
  view_count: number
  /** Style override (theme-catalog value); null = inherit from the site. */
  theme: string | null
  /** Fine-grained design overrides (accent/columns/radius/font) as jsonb. */
  style: unknown | null
  created_at: string
  updated_at: string
}

export type GalleryDeliveryStatus = 'shot' | 'editing' | 'ready'

export type AssetKind = 'photo' | 'video'

export interface Asset {
  id: string
  gallery_id: string
  owner_id: string
  r2_key: string
  kind: AssetKind
  content_type: string
  width: number | null
  height: number | null
  size_bytes: number
  variants: Record<string, string>
  position: number
  /** Focal point (0–100%) for cropped layouts; null = center. */
  focal_x: number | null
  focal_y: number | null
  /** ThumbHash (base64) for a blurred placeholder (migration 0053). May be
   *  null/absent: nothing generates it yet, and videos/old photos never have one. */
  thumbhash?: string | null
  /** Hidden from the client (future AI culling, migration 0054): the owner
   *  sees it, the public gallery, archive and selections never do. */
  hidden_from_client: boolean
  /** File name exactly as on the photographer's disk (migration 0066);
   *  null/absent for older uploads — use lib/gallery/client-picks assetOriginalName. */
  source_file_name?: string | null
  /** File name inside an imported zip (0037). */
  original_name?: string | null
  created_at: string
}

export type SelectionKind = 'favorite' | 'retouch'

export interface Selection {
  id: string
  gallery_id: string
  asset_id: string
  client_token: string
  kind: SelectionKind
  created_at: string
}

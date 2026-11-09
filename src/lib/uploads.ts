import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { galleryPrefix, getStorage, isVariantName } from '@/lib/storage'
import { MAX_FILE_BYTES } from '@/lib/upload/limits'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isValidTakenAt } from '@/lib/images/exif'

/**
 * Shared server-side upload logic for the single-PUT (/api/uploads/*) and
 * multipart (/api/uploads/multipart/*) flows: one place for the ownership +
 * quota gate and for asset registration, so the two paths cannot drift.
 */

export { MAX_FILE_BYTES }

/** Browser-made preview/thumb/poster JPEGs are far below this. */
const MAX_VARIANT_BYTES = 25 * 1024 * 1024

export type UploadCheck = { ok: true } | { ok: false; status: number; error: string }

export async function authorizeUpload(
  supabase: SupabaseClient,
  userId: string,
  input: { galleryId: string; contentType: string; sizeBytes: number },
  options: {
    /**
     * Bytes held by this account's other open multipart uploads (migration
     * 0063, lib/upload/reservations.ts) — counted as used while they exist.
     */
    reservedBytes?: number
  } = {}
): Promise<UploadCheck> {
  const isPhoto = input.contentType.startsWith('image/')
  const isVideo = input.contentType.startsWith('video/')
  if (!isPhoto && !isVideo) {
    return { ok: false, status: 415, error: 'unsupported_type' }
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, status: 413, error: 'file_too_large' }
  }

  // Ownership check — RLS returns nothing for someone else's gallery.
  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, owner_id, free_expired_at')
    .eq('id', input.galleryId)
    .eq('owner_id', userId)
    .single()
  if (!gallery) {
    return { ok: false, status: 404, error: 'gallery_not_found' }
  }
  // Closed by the Free plan's 30 days (0049): files in it are about to be
  // deleted, so nothing new goes in until the owner upgrades.
  if (gallery.free_expired_at) {
    return { ok: false, status: 403, error: 'gallery_free_expired' }
  }

  // Plan gates: quota (with the post-cancellation grace period applied
  // lazily) and the video feature (plans.ts: every paid tier, from «Базовий»).
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, storage_used_bytes, storage_limit_bytes, grace_until')
    .eq('user_id', userId)
    .single()
  if (!profile) {
    return { ok: false, status: 404, error: 'profile_not_found' }
  }

  const plan = effectiveGalleryPlan(profile.plan, profile.grace_until)
  if (isVideo && !plan.features.video) {
    return { ok: false, status: 403, error: 'plan_video_required' }
  }

  const effectiveLimit = Math.min(profile.storage_limit_bytes, planStorageBytes(plan))
  const reserved = options.reservedBytes ?? 0
  if (profile.storage_used_bytes + reserved + input.sizeBytes > effectiveLimit) {
    return { ok: false, status: 403, error: 'storage_quota_exceeded' }
  }

  return { ok: true }
}

export interface RegisterAssetInput {
  galleryId: string
  key: string
  contentType: string
  sizeBytes: number
  width?: number
  height?: number
  variants?: Record<string, string>
  /**
   * The file's name exactly as on the photographer's disk (File.name), kept in
   * assets.source_file_name (0066) for the Lightroom list of client picks —
   * the storage key holds only a sanitized copy.
   */
  sourceFileName?: string
  /** Zip import only: the file's name inside the zip (duplicate guard). */
  originalName?: string
  /** Zip import only: the gallery_imports row this file belongs to. */
  importId?: string
  /** Zip import only: sort position, so the gallery keeps the zip's name order. */
  position?: number
  /** Capture time from the photo's EXIF (ISO; wall clock as UTC, see images/exif.ts). */
  takenAt?: string
}

export function parseRegisterAssetInput(value: unknown): RegisterAssetInput | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const variantsOk =
    v.variants === undefined ||
    (typeof v.variants === 'object' &&
      v.variants !== null &&
      Object.entries(v.variants).every(
        ([name, key]) => isVariantName(name) && typeof key === 'string'
      ))
  const ok =
    typeof v.galleryId === 'string' &&
    typeof v.key === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number' &&
    (v.width === undefined || typeof v.width === 'number') &&
    (v.height === undefined || typeof v.height === 'number') &&
    (v.sourceFileName === undefined ||
      (typeof v.sourceFileName === 'string' && v.sourceFileName.length <= 1024)) &&
    (v.originalName === undefined ||
      (typeof v.originalName === 'string' && v.originalName.length <= 512)) &&
    (v.importId === undefined || typeof v.importId === 'string') &&
    (v.position === undefined || (Number.isInteger(v.position) && (v.position as number) >= 0)) &&
    (v.takenAt === undefined || isValidTakenAt(v.takenAt)) &&
    variantsOk
  return ok ? (v as unknown as RegisterAssetInput) : null
}

/**
 * A file name fit for assets.source_file_name: no folders (some browsers or a
 * folder drop hand over «a/b/IMG.jpg»), no control characters, NFC (macOS
 * hands over decomposed Cyrillic «й»), at most 255 characters; '' → null.
 */
export function cleanSourceFileName(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null
  const base = value.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const clean = base.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return clean ? Array.from(clean).slice(0, 255).join('') : null
}

/** PostgREST: the column is not in the schema (migration not applied yet). */
function isUnknownColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  return (
    !!error &&
    (error.code === 'PGRST204' || error.code === '42703') &&
    (error.message ?? '').includes(column)
  )
}

export type RegisterResult =
  | { ok: true; assetId: string }
  | { ok: false; status: number; error: string }

export async function registerAsset(
  supabase: SupabaseClient,
  userId: string,
  input: RegisterAssetInput
): Promise<RegisterResult> {
  // Every key must sit under this user's prefix for this gallery — prevents
  // registering someone else's object (or a foreign path) as your asset.
  const prefix = galleryPrefix(userId, input.galleryId)
  const allKeys = [input.key, ...Object.values(input.variants ?? {})]
  if (allKeys.some((key) => !key.startsWith(prefix))) {
    return { ok: false, status: 400, error: 'key_mismatch' }
  }

  // Imported files must belong to one of this user's running imports.
  if (input.importId) {
    const { data: running } = await supabase
      .from('gallery_imports')
      .select('id')
      .eq('id', input.importId)
      .eq('owner_id', userId)
      .eq('status', 'running')
      .maybeSingle()
    if (!running) {
      return { ok: false, status: 400, error: 'import_not_running' }
    }
  }

  // Idempotent: keys carry a fresh UUID, so an asset with this key is THIS
  // upload, registered by an earlier attempt whose answer was lost (the
  // browser retries /complete after a dropped connection). Answer the same.
  const { data: already } = await supabase
    .from('assets')
    .select('id')
    .eq('owner_id', userId)
    .eq('r2_key', input.key)
    .maybeSingle()
  if (already) {
    return { ok: true, assetId: (already as { id: string }).id }
  }

  // Never trust the client's own size/type: read what storage actually holds
  // and run the full upload gate (gallery ownership, type, per-file cap, video
  // on «Плюс»+, quota) against those real values. Anything that fails is
  // removed from storage so it can't sit there uncounted.
  const storage = getStorage()
  const discard = () => storage.delete(allKeys).catch(() => {})
  const stored = await storage.head(input.key)
  if (!stored) {
    return { ok: false, status: 400, error: 'upload_missing' }
  }
  const contentType = stored.contentType ?? input.contentType
  const gate = await authorizeUpload(supabase, userId, {
    galleryId: input.galleryId,
    contentType,
    sizeBytes: stored.sizeBytes,
  })
  if (!gate.ok) {
    await discard()
    return gate
  }
  // Variants (preview/thumb/poster) are small JPEGs made in the browser; they
  // aren't counted against the quota, so a "variant" can't be a big file.
  for (const variantKey of Object.values(input.variants ?? {})) {
    const variant = await storage.head(variantKey)
    if (!variant || variant.sizeBytes > MAX_VARIANT_BYTES) {
      await discard()
      return { ok: false, status: 400, error: 'invalid_variant' }
    }
  }

  // Asset rows are written only here, server-side, after the checks above —
  // the user's own client has no INSERT on assets (migration 0041).
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return { ok: false, status: 503, error: 'not_configured' }
  }

  const kind = contentType.startsWith('video/') ? 'video' : 'photo'

  const sourceFileName = cleanSourceFileName(input.sourceFileName ?? input.originalName)
  const row: Record<string, unknown> = {
    gallery_id: input.galleryId,
    owner_id: userId,
    r2_key: input.key,
    kind,
    content_type: contentType,
    width: input.width ?? null,
    height: input.height ?? null,
    // Original size only; variant overhead (~5-10%) is deliberately not
    // counted against the quota to keep accounting simple for now.
    size_bytes: stored.sizeBytes,
    variants: input.variants ?? {},
    // New photos go to the END of the gallery, never to the start: after a
    // sort or a zip import positions are 1..n, and the column default (0)
    // would put a later upload before all of them. A zip keeps its own name
    // order after whatever the gallery already holds.
    position: await nextPosition(admin, input.galleryId, input.importId, input.position),
    ...(input.importId
      ? {
          original_name: input.originalName ?? null,
          import_id: input.importId,
        }
      : {}),
    ...(sourceFileName ? { source_file_name: sourceFileName } : {}),
    ...(input.takenAt ? { taken_at: input.takenAt } : {}),
  }
  const insert = (values: Record<string, unknown>) =>
    admin.from('assets').insert(values).select('id').single<{ id: string }>()
  let { data, error } = await insert(row)
  // Migrations not applied yet (0066 source_file_name, 0067 taken_at):
  // register the photo without that column rather than fail the upload —
  // the list falls back to the storage key's name, the order to upload time.
  for (const column of ['source_file_name', 'taken_at']) {
    if (error && column in row && (isUnknownColumn(error, column) || isMissingColumn(error, column))) {
      delete row[column]
      ;({ data, error } = await insert(row))
    }
  }

  if (error?.code === '23505' && input.importId) {
    // Same file name already in this gallery (two tabs importing one zip):
    // drop the objects we just uploaded so they don't sit unaccounted.
    await discard()
    return { ok: false, status: 409, error: 'duplicate' }
  }
  if (isQuotaError(error)) {
    // Lost the race against another upload of this account (migration 0045
    // locks the profile row, so the second insert sees the first one's bytes).
    await discard()
    return { ok: false, status: 403, error: 'storage_quota_exceeded' }
  }
  if (error || !data) {
    return { ok: false, status: 500, error: error?.message ?? 'insert_failed' }
  }
  return { ok: true, assetId: (data as { id: string }).id }
}

/**
 * Position for a new photo: after the last one in the gallery. A zip import
 * passes the file's place in the zip (1, 2, …) and is laid out after the
 * photos that were there before the import (other imports' and plain uploads),
 * so its own files keep the zip's name order whatever order they finish in.
 * If the lookup fails, falls back to the old behaviour (0 / the zip index).
 */
export async function nextPosition(
  admin: SupabaseClient,
  galleryId: string,
  importId?: string,
  indexInImport?: number
): Promise<number> {
  let query = admin.from('assets').select('position').eq('gallery_id', galleryId)
  if (importId) query = query.or(`import_id.is.null,import_id.neq.${importId}`)
  const { data, error } = await query.order('position', { ascending: false }).limit(1)
  const last = !error && Array.isArray(data) && data.length ? Number((data[0] as { position: unknown }).position) || 0 : 0
  if (importId) return last + Math.max(indexInImport ?? 0, 0)
  return error ? 0 : last + 1
}

/** PostgREST / Postgres «no such column» (a migration not applied yet). */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined, column: string): boolean {
  if (!error) return false
  const mentions = !!error.message?.includes(column)
  return mentions && (error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message ?? ''))
}

/** The enforce_storage_quota trigger (0045) refused the insert. */
export function isQuotaError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes('storage_quota_exceeded')
}

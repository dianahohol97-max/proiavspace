import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { galleryPrefix, getStorage, isVariantName } from '@/lib/storage'
import { MAX_FILE_BYTES } from '@/lib/upload/limits'

/**
 * Shared server-side upload logic for the single-PUT (/api/uploads/*) and
 * multipart (/api/uploads/multipart/*) flows: one place for the ownership +
 * quota gate and for asset registration, so the two paths cannot drift.
 */

export { MAX_FILE_BYTES }

export type UploadCheck = { ok: true } | { ok: false; status: number; error: string }

export async function authorizeUpload(
  supabase: SupabaseClient,
  userId: string,
  input: { galleryId: string; contentType: string; sizeBytes: number }
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
    .select('id, owner_id')
    .eq('id', input.galleryId)
    .eq('owner_id', userId)
    .single()
  if (!gallery) {
    return { ok: false, status: 404, error: 'gallery_not_found' }
  }

  // Plan gates: quota (with the post-cancellation grace period applied
  // lazily) and the video feature, which starts on the «Плюс» tier.
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
  if (profile.storage_used_bytes + input.sizeBytes > effectiveLimit) {
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
  /** Zip import only: the file's name inside the zip (duplicate guard). */
  originalName?: string
  /** Zip import only: the gallery_imports row this file belongs to. */
  importId?: string
  /** Zip import only: sort position, so the gallery keeps the zip's name order. */
  position?: number
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
    (v.originalName === undefined ||
      (typeof v.originalName === 'string' && v.originalName.length <= 512)) &&
    (v.importId === undefined || typeof v.importId === 'string') &&
    (v.position === undefined || (Number.isInteger(v.position) && (v.position as number) >= 0)) &&
    variantsOk
  return ok ? (v as unknown as RegisterAssetInput) : null
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

  const kind = input.contentType.startsWith('video/') ? 'video' : 'photo'

  const { data, error } = await supabase
    .from('assets')
    .insert({
      gallery_id: input.galleryId,
      owner_id: userId,
      r2_key: input.key,
      kind,
      content_type: input.contentType,
      width: input.width ?? null,
      height: input.height ?? null,
      // Original size only; variant overhead (~5-10%) is deliberately not
      // counted against the quota to keep accounting simple for now.
      size_bytes: input.sizeBytes,
      variants: input.variants ?? {},
      ...(input.importId
        ? {
            original_name: input.originalName ?? null,
            import_id: input.importId,
            position: input.position ?? 0,
          }
        : {}),
    })
    .select('id')
    .single()

  if (error?.code === '23505' && input.importId) {
    // Same file name already in this gallery (two tabs importing one zip):
    // drop the objects we just uploaded so they don't sit unaccounted.
    await getStorage()
      .delete(allKeys)
      .catch(() => {})
    return { ok: false, status: 409, error: 'duplicate' }
  }
  if (error) {
    return { ok: false, status: 500, error: error.message }
  }
  return { ok: true, assetId: data.id }
}

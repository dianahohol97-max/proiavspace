import type { SupabaseClient } from '@supabase/supabase-js'
import { ORPHAN_GRACE_MS } from '@/lib/storage/cleanup'

/**
 * Open multipart uploads reserved against the storage quota (migration 0063).
 * Server-only; always called with the service-role client — the table has no
 * policies for signed-in users.
 *
 * Until 0063 is applied the table does not exist: every helper then behaves as
 * "no reservations" so uploads keep working exactly as before.
 */

const TABLE = 'upload_reservations'

/** PostgREST / Postgres "relation does not exist". */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    !!error.message?.includes(`relation "public.${TABLE}" does not exist`)
  )
}

/** Bytes this owner has reserved in uploads that are still open (< 24 h old). */
export async function reservedBytes(admin: SupabaseClient, ownerId: string): Promise<number> {
  const since = new Date(Date.now() - ORPHAN_GRACE_MS).toISOString()
  const { data, error } = await admin
    .from(TABLE)
    .select('size_bytes')
    .eq('owner_id', ownerId)
    .gte('created_at', since)
    .returns<{ size_bytes: number }[]>()
  if (error) {
    if (!isMissingTable(error)) console.error('upload reservations: read failed', error.message)
    return 0
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.size_bytes), 0)
}

export async function reserveUpload(
  admin: SupabaseClient,
  row: { uploadId: string; ownerId: string; galleryId: string; key: string; sizeBytes: number }
): Promise<void> {
  const { error } = await admin.from(TABLE).insert({
    upload_id: row.uploadId,
    owner_id: row.ownerId,
    gallery_id: row.galleryId,
    r2_key: row.key,
    size_bytes: row.sizeBytes,
  })
  if (error && !isMissingTable(error)) {
    console.error('upload reservations: insert failed', error.message)
  }
}

export async function releaseReservation(admin: SupabaseClient | null, uploadId: string): Promise<void> {
  if (!admin) return
  const { error } = await admin.from(TABLE).delete().eq('upload_id', uploadId)
  if (error && !isMissingTable(error)) {
    console.error('upload reservations: delete failed', error.message)
  }
}

/** Cron: drop reservations older than 24 h (their uploads are aborted by then). */
export async function pruneReservations(admin: SupabaseClient): Promise<number> {
  const before = new Date(Date.now() - ORPHAN_GRACE_MS).toISOString()
  const { data, error } = await admin
    .from(TABLE)
    .delete()
    .lt('created_at', before)
    .select('upload_id')
  if (error) {
    if (!isMissingTable(error)) console.error('upload reservations: prune failed', error.message)
    return 0
  }
  return data?.length ?? 0
}

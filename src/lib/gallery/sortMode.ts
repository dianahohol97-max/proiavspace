import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gallery order mode (galleries.sort_mode, migration 0071):
 *   - 'manual'   — the order the photographer set (upload / zip order or the
 *                  «За часом завантаження» button); new photos go to the end;
 *   - 'taken_at' — shot order: «За часом зйомки» switched it on, and after
 *                  every upload batch / zip import the gallery is sorted again
 *                  (sort_gallery_assets, 0067/0071), so new frames land among
 *                  their neighbours by EXIF capture time; no capture time → end.
 * Before 0071 is applied the column is missing: every gallery is 'manual'.
 */
export type GallerySortMode = 'manual' | 'taken_at'

export function parseSortMode(value: unknown): GallerySortMode {
  return value === 'taken_at' ? 'taken_at' : 'manual'
}

export interface SortModeState {
  mode: GallerySortMode
  /** false when the column doesn't exist yet (0071 not applied). */
  stored: boolean
}

/** Reads the mode with the caller's own client (RLS: owner / published). */
export async function readGallerySortMode(supabase: SupabaseClient, galleryId: string): Promise<SortModeState> {
  const { data, error } = await supabase
    .from('galleries')
    .select('sort_mode')
    .eq('id', galleryId)
    .maybeSingle<{ sort_mode?: string | null }>()
  if (error || !data) return { mode: 'manual', stored: !error }
  return { mode: parseSortMode(data.sort_mode), stored: 'sort_mode' in data }
}

/**
 * After an upload batch or a zip import: in shot order, sort the gallery again
 * so the new frames take their places. In manual order nothing happens (new
 * photos were already registered at the end, see uploads.ts nextPosition).
 * Never throws: a failed re-sort leaves the photos at the end, as in manual.
 */
export async function resortAfterUpload(
  supabase: SupabaseClient,
  galleryId: string
): Promise<{ mode: GallerySortMode; resorted: boolean }> {
  const { mode } = await readGallerySortMode(supabase, galleryId)
  if (mode !== 'taken_at') return { mode, resorted: false }
  const { error } = await supabase.rpc('sort_gallery_assets', { p_gallery: galleryId, p_mode: 'taken' })
  if (error) {
    console.error('resort after upload failed', galleryId, error.message)
    return { mode, resorted: false }
  }
  return { mode, resorted: true }
}

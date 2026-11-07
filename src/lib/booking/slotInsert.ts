/**
 * Inserting booking slots so that a duplicate (same owner_id + starts_at) is
 * "already exists", never an error.
 *
 * The generator already filters out starts that exist, but two tabs or a
 * double click can race between that read and this insert. Migration 0058
 * adds a UNIQUE index on (owner_id, starts_at); the insert uses
 * ON CONFLICT DO NOTHING against it and reports how many rows were skipped.
 * Before 0058 is applied there is no index to conflict on (42P10), so it
 * falls back to a plain insert — the behaviour the release had before.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NewSlotRow {
  owner_id: string
  starts_at: string
  duration_minutes: number
  price_uah: number
}

export interface SlotInsertResult {
  created: number
  /** Rows skipped because a slot with that owner + start already exists. */
  duplicates: number
  error: { code?: string; message: string } | null
}

export async function insertSlotsSkippingDuplicates(
  supabase: SupabaseClient,
  rows: NewSlotRow[]
): Promise<SlotInsertResult> {
  if (rows.length === 0) return { created: 0, duplicates: 0, error: null }

  const { data, error } = await supabase
    .from('booking_slots')
    .upsert(rows, { onConflict: 'owner_id,starts_at', ignoreDuplicates: true })
    .select('id')
  if (!error) {
    const created = data?.length ?? 0
    return { created, duplicates: rows.length - created, error: null }
  }
  // 23505 can still surface if PostgREST could not apply DO NOTHING: it is a
  // duplicate all the same.
  if (error.code === '23505') return { created: 0, duplicates: rows.length, error: null }
  if (error.code !== '42P10') return { created: 0, duplicates: 0, error }

  // 42P10: no unique index yet (migration 0058 not applied) → plain insert.
  const plain = await supabase.from('booking_slots').insert(rows)
  if (!plain.error) return { created: rows.length, duplicates: 0, error: null }
  if (plain.error.code === '23505') return { created: 0, duplicates: rows.length, error: null }
  return { created: 0, duplicates: 0, error: plain.error }
}

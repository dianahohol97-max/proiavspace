import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hourly cron /api/cron/booking-release: frees priced bookings that stayed
 * unpaid longer than the photographer's `unpaid_release_hours`, so the slot
 * is back on /b/<handle>. The release itself is public.release_expired_slots
 * (migration 0005; 0060 lets callers without auth.uid() — the service role —
 * release any owner). This module only finds the owners to call it for.
 */

export interface BookedSlot {
  owner_id: string
  booked_at: string | null
  price_uah: number | string
}

const PAGE = 1000
const ID_CHUNK = 200

/**
 * Owners with at least one booking past its unpaid deadline. Mirrors the SQL
 * in release_expired_slots (priced, booked, hours > 0, booked_at older than
 * the window); the SQL re-checks everything, this only avoids useless calls.
 */
export function ownersWithExpiredBookings(
  slots: BookedSlot[],
  releaseHours: Map<string, number>,
  nowMs: number
): string[] {
  const owners = new Set<string>()
  for (const s of slots) {
    if (!s.booked_at || Number(s.price_uah) <= 0) continue
    const hours = releaseHours.get(s.owner_id) ?? 0
    if (hours <= 0) continue
    if (Date.parse(s.booked_at) < nowMs - hours * 3_600_000) owners.add(s.owner_id)
  }
  return [...owners].sort()
}

export interface ReleaseSummary {
  booked: number
  owners: number
  released: number
  errors: number
}

/** Throws if a read fails (nothing is written then); per-owner RPC errors are counted. */
export async function releaseExpiredBookings(admin: SupabaseClient, nowMs = Date.now()): Promise<ReleaseSummary> {
  const slots: BookedSlot[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('booking_slots')
      .select('owner_id, booked_at, price_uah')
      .eq('status', 'booked')
      .gt('price_uah', 0)
      .not('booked_at', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`booking_slots: ${error.message}`)
    const rows = (data ?? []) as BookedSlot[]
    slots.push(...rows)
    if (rows.length < PAGE) break
  }

  const ownerIds = [...new Set(slots.map((s) => s.owner_id))]
  const releaseHours = new Map<string, number>()
  for (let i = 0; i < ownerIds.length; i += ID_CHUNK) {
    const { data, error } = await admin
      .from('booking_settings')
      .select('user_id, unpaid_release_hours')
      .in('user_id', ownerIds.slice(i, i + ID_CHUNK))
      .gt('unpaid_release_hours', 0)
    if (error) throw new Error(`booking_settings: ${error.message}`)
    for (const row of (data ?? []) as { user_id: string; unpaid_release_hours: number }[]) {
      releaseHours.set(row.user_id, Number(row.unpaid_release_hours))
    }
  }

  const owners = ownersWithExpiredBookings(slots, releaseHours, nowMs)
  const summary: ReleaseSummary = { booked: slots.length, owners: owners.length, released: 0, errors: 0 }
  for (const owner of owners) {
    const { data, error } = await admin.rpc('release_expired_slots', { p_owner: owner })
    if (error) {
      summary.errors += 1
      console.error('booking-release: release failed', owner, error.message)
    } else {
      summary.released += Number(data ?? 0)
    }
  }
  return summary
}

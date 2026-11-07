/**
 * Hourly release of expired unpaid bookings for ALL photographers
 * (/api/cron/booking-release, service role).
 *
 * Before this, release_expired_slots ran only when a photographer opened
 * their booking dashboard (get_free_slots stopped calling it in 0018), so a
 * client's unpaid booking could block a date for days.
 *
 *  1. Owners with a priced booking older than an hour (the shortest possible
 *     payment window) → release_expired_slots(owner) for each. The SQL rule
 *     (per-owner unpaid_release_hours) stays the single authority; 0060 lets
 *     a caller without auth.uid() — the service role — run it for anyone.
 *  2. Google Calendar: release_expired_slots does not touch google_event_id,
 *     so a released slot keeps the id of its booking event. Every FREE slot
 *     that still has one is such a leftover (reopenSlot clears it itself):
 *     delete the event, as reopenSlot does, then clear the id. Running this
 *     AFTER the release makes it race-safe: a slot paid in between is never
 *     free, so its event is never touched. It also cleans leftovers from
 *     releases triggered by the dashboard.
 *
 * Google failures never block the release; they are reported and the id is
 * kept so the next run retries. If the calendar was disconnected (no token),
 * the event cannot be deleted by us — the id is cleared.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { reportServerError } from '@/lib/sentry/server'
import { parseCalendarConfig } from './calendarConfig'
import { deleteCalendarEvent, refreshAccessToken } from './googleCalendar'
import { readSecret } from './secrets'

/** Events cleaned per run; the rest waits for the next hour. */
export const MAX_EVENT_CLEANUPS_PER_RUN = 200

export interface ReleaseSummary {
  owners: number
  released: number
  eventsDeleted: number
  /** Ids cleared without a Google call (calendar no longer connected). */
  eventsCleared: number
  errors: number
}

export async function releaseExpiredBookings(
  admin: SupabaseClient,
  options: { nowMs?: number } = {}
): Promise<ReleaseSummary> {
  const nowMs = options.nowMs ?? Date.now()
  const summary: ReleaseSummary = { owners: 0, released: 0, eventsDeleted: 0, eventsCleared: 0, errors: 0 }

  // 1. release ---------------------------------------------------------------
  const { data: candidates, error: readError } = await admin
    .from('booking_slots')
    .select('owner_id')
    .eq('status', 'booked')
    .gt('price_uah', 0)
    .lt('booked_at', new Date(nowMs - 60 * 60_000).toISOString())
    .limit(10_000)
  if (readError) throw new Error(`booking-release: candidates read failed: ${readError.message}`)

  const owners = [...new Set((candidates ?? []).map((r) => String(r.owner_id)))]
  summary.owners = owners.length
  for (const owner of owners) {
    const { data, error } = await admin.rpc('release_expired_slots', { p_owner: owner })
    if (error) {
      summary.errors++
      reportServerError(new Error(`release_expired_slots: ${error.message}`), { area: 'booking.release' })
      continue
    }
    summary.released += Number(data ?? 0)
  }

  // 2. Google events of released slots ---------------------------------------
  const { data: leftovers, error: leftoverError } = await admin
    .from('booking_slots')
    .select('id, owner_id, google_event_id')
    .eq('status', 'free')
    .not('google_event_id', 'is', null)
    .limit(MAX_EVENT_CLEANUPS_PER_RUN)
  if (leftoverError) {
    summary.errors++
    reportServerError(new Error(`booking-release: leftovers read failed: ${leftoverError.message}`), {
      area: 'booking.release',
    })
    return summary
  }
  const rows = (leftovers ?? []) as { id: string; owner_id: string; google_event_id: string }[]
  if (rows.length === 0) return summary

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))]
  const { data: settingsRows } = await admin
    .from('booking_settings')
    .select('user_id, google_refresh_token, google_calendar_id')
    .in('user_id', ownerIds)
  const settingsByOwner = new Map(
    ((settingsRows ?? []) as { user_id: string; google_refresh_token: string | null; google_calendar_id: string | null }[]).map(
      (s) => [s.user_id, s]
    )
  )

  const clearId = (row: { id: string; google_event_id: string }) =>
    admin
      .from('booking_slots')
      .update({ google_event_id: null })
      .eq('id', row.id)
      .eq('status', 'free')
      .eq('google_event_id', row.google_event_id)

  for (const ownerId of ownerIds) {
    const ownerRows = rows.filter((r) => r.owner_id === ownerId)
    const settings = settingsByOwner.get(ownerId)
    const token = readSecret(settings?.google_refresh_token, 'google_refresh_token', (e) =>
      reportServerError(e, { area: 'booking.secrets' })
    )
    if (!token) {
      // Disconnected: nothing we can delete with; stop carrying the id.
      for (const row of ownerRows) {
        await clearId(row)
        summary.eventsCleared++
      }
      continue
    }
    let accessToken: string
    try {
      accessToken = await refreshAccessToken(token)
    } catch (error) {
      summary.errors++
      reportServerError(error, { area: 'booking.release.google' })
      continue // keep the ids, retry next hour
    }
    const calendarId = parseCalendarConfig(settings?.google_calendar_id).write
    for (const row of ownerRows) {
      try {
        await deleteCalendarEvent(accessToken, calendarId, row.google_event_id)
        await clearId(row)
        summary.eventsDeleted++
      } catch (error) {
        summary.errors++
        reportServerError(error, { area: 'booking.release.google' })
      }
    }
  }
  return summary
}

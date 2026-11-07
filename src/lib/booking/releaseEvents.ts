/**
 * Google Calendar events of bookings freed by release_expired_slots — the
 * second step of the hourly /api/cron/booking-release (the first step, the
 * release itself, is releaseExpired.ts).
 *
 * release_expired_slots does not touch google_event_id, so a released slot
 * keeps the id of its booking event. Every FREE slot that still has one is
 * such a leftover (reopenSlot clears the id itself): delete the event, as
 * reopenSlot does, then clear the id. Running this AFTER the release makes it
 * race-safe: a slot paid in between is never free, so its event is never
 * touched. It also cleans leftovers of releases triggered from the dashboard.
 *
 * Google failures never undo or block a release; they go to Sentry and the id
 * is kept so the next run retries. If the calendar was disconnected (no
 * token), the event cannot be deleted by us — the id is just cleared.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { reportServerError } from '@/lib/sentry/server'
import { parseCalendarConfig } from './calendarConfig'
import { deleteCalendarEvent, refreshAccessToken } from './googleCalendar'
import { readSecret } from './secrets'

/** Events cleaned per run; the rest waits for the next hour. */
export const MAX_EVENT_CLEANUPS_PER_RUN = 200

export interface EventCleanupSummary {
  eventsDeleted: number
  /** Ids cleared without a Google call (calendar no longer connected). */
  eventsCleared: number
  /** Google/DB failures here; reported to Sentry, retried next run. */
  eventErrors: number
}

export async function cleanupReleasedSlotEvents(admin: SupabaseClient): Promise<EventCleanupSummary> {
  const summary: EventCleanupSummary = { eventsDeleted: 0, eventsCleared: 0, eventErrors: 0 }

  const { data: leftovers, error: leftoverError } = await admin
    .from('booking_slots')
    .select('id, owner_id, google_event_id')
    .eq('status', 'free')
    .not('google_event_id', 'is', null)
    .order('id')
    .range(0, MAX_EVENT_CLEANUPS_PER_RUN - 1)
  if (leftoverError) {
    summary.eventErrors++
    reportServerError(new Error(`booking-release: leftovers read failed: ${leftoverError.message}`), {
      area: 'booking.release',
    })
    return summary
  }
  const rows = (leftovers ?? []) as { id: string; owner_id: string; google_event_id: string }[]
  if (rows.length === 0) return summary

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))]
  const { data: settingsRows, error: settingsError } = await admin
    .from('booking_settings')
    .select('user_id, google_refresh_token, google_calendar_id')
    .in('user_id', ownerIds)
  if (settingsError) {
    summary.eventErrors++
    reportServerError(new Error(`booking-release: settings read failed: ${settingsError.message}`), {
      area: 'booking.release',
    })
    return summary
  }
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
      summary.eventErrors++
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
        summary.eventErrors++
        reportServerError(error, { area: 'booking.release.google' })
      }
    }
  }
  return summary
}

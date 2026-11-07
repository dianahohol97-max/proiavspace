/**
 * Google Calendar choices, stored WITHOUT a migration in the existing
 * booking_settings.google_calendar_id text column.
 *
 *  - Legacy value: a plain calendar id ('primary'). It means "write events to
 *    this calendar", busy times are not checked, and the account was
 *    connected before the free/busy scope existed → ask to reconnect.
 *  - Current value: a small JSON object
 *      {"v":2,"write":"primary","busy":["primary","team@group.calendar.google.com"]}
 *    v 2 = connected with the free/busy + calendar-list scopes.
 *
 * Calendar ids never start with '{', so the two forms cannot be confused.
 */
export interface CalendarConfig {
  /** Calendar new booking events are written to. */
  write: string
  /** Calendars whose busy time hides slots. */
  busy: string[]
  /** True when the stored grant includes free/busy + calendar list (v2). */
  busyScopes: boolean
}

export const MAX_BUSY_CALENDARS = 20

export function parseCalendarConfig(raw: string | null | undefined): CalendarConfig {
  const value = (raw ?? '').trim()
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as { v?: unknown; write?: unknown; busy?: unknown }
      const write = typeof parsed.write === 'string' && parsed.write ? parsed.write : 'primary'
      const busy = Array.isArray(parsed.busy)
        ? [...new Set(parsed.busy.filter((x): x is string => typeof x === 'string' && x.length > 0))].slice(
            0,
            MAX_BUSY_CALENDARS
          )
        : ['primary']
      return { write, busy, busyScopes: parsed.v === 2 }
    } catch {
      return { write: 'primary', busy: [], busyScopes: false }
    }
  }
  return { write: value || 'primary', busy: [], busyScopes: false }
}

export function serializeCalendarConfig(config: { write: string; busy: string[] }): string {
  return JSON.stringify({
    v: 2,
    write: config.write || 'primary',
    busy: [...new Set(config.busy)].slice(0, MAX_BUSY_CALENDARS),
  })
}

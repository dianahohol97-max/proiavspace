/**
 * Google Calendar sync — minimal, dependency-free OAuth + Calendar REST.
 *
 * The platform holds ONE OAuth client (GOOGLE_CLIENT_ID/SECRET). Each
 * photographer connects their own Google account; we store only their refresh
 * token and push booking events into their calendar. All calls are plain fetch
 * against Google's public endpoints, so there is no googleapis dependency.
 *
 * Timezone: slot times are stored as wall-clock strings (e.g. 2026-08-20T14:00)
 * with no offset. We hand them to Google with an explicit IANA timeZone so the
 * event lands at the intended local time regardless of the calendar's default.
 */

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token'
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars'

/** Booking events live in the photographer's local time. */
export const BOOKING_TIME_ZONE = 'Europe/Kyiv'

/** Scopes: write calendar events + read the connected account's email. */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function googleRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/api/booking/google/callback`
}

/** Consent URL. `state` is an opaque CSRF token echoed back to the callback. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent so Google returns a refresh_token even on re-connect.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${OAUTH_AUTH}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

/** Exchange an authorization code for tokens (first connect). */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const response = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error(`google token exchange: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as TokenResponse
}

/** Mint a short-lived access token from a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(`google token refresh: ${response.status} ${await response.text()}`)
  }
  const payload = (await response.json()) as TokenResponse
  return payload.access_token
}

/** The connected Google account's email, for display in the dashboard. */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const payload = (await response.json()) as { email?: string }
  return payload.email ?? null
}

/** '2026-08-20T14:00:00' + 60 min → RFC3339 end '2026-08-20T15:00:00'. */
function addMinutes(startsAt: string, minutes: number): string {
  const [date, time = '00:00:00'] = startsAt.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // Pure arithmetic in UTC to avoid the host timezone; we only reuse the
  // wall-clock components, which is exactly what Google's timeZone field wants.
  const base = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0)
  const end = new Date(base + minutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}` +
    `T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`
  )
}

export interface CalendarEventInput {
  startsAt: string
  durationMinutes: number
  summary: string
  description?: string
}

/**
 * Create an event and return its id. Best-effort by convention: callers wrap
 * this in try/catch so a calendar hiccup never blocks a booking.
 */
export async function insertCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: CalendarEventInput
): Promise<string | null> {
  const response = await fetch(
    `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startsAt, timeZone: BOOKING_TIME_ZONE },
        end: {
          dateTime: addMinutes(input.startsAt, input.durationMinutes),
          timeZone: BOOKING_TIME_ZONE,
        },
      }),
    }
  )
  if (!response.ok) {
    throw new Error(`google events.insert: ${response.status} ${await response.text()}`)
  }
  const payload = (await response.json()) as { id?: string }
  return payload.id ?? null
}

/** Remove a previously pushed event (booking reopened/canceled). */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  )
  // 410 = already gone; treat as success.
  if (!response.ok && response.status !== 410 && response.status !== 404) {
    throw new Error(`google events.delete: ${response.status}`)
  }
}

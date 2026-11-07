/**
 * Google Calendar busy time applied to booking slots (server-only I/O).
 *
 * Policy: Google is advisory. If it is not connected, lacks the free/busy
 * grant, is slow or errors, slots are shown and bookings go through exactly as
 * before — the failure is only reported to Sentry. Google never blocks a
 * booking by being unavailable, only by saying "busy".
 *
 * Caching: one freeBusy answer per photographer is reused for BUSY_CACHE_TTL_MS
 * (in-memory, per server instance) when it covers the requested window, so a
 * popular booking page does not hit Google on every view. The pre-booking
 * check in /api/booking/book always asks Google afresh for the one slot.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { reportServerError } from '@/lib/sentry/server'
import { filterFreeSlots, isSlotBusy, parseBusy, slotsWindow, type SlotLike } from './busy'
import { parseCalendarConfig, type CalendarConfig } from './calendarConfig'
import { queryFreeBusy, refreshAccessToken } from './googleCalendar'
import { readSecret } from './secrets'
import { DEFAULT_BOOKING_TIME_ZONE, slotInterval, utcToWall, wallString, type Interval } from './time'

export const BUSY_CACHE_TTL_MS = 3 * 60_000
/** Google gets this long before we give up and show/allow the slot. */
export const GOOGLE_TIMEOUT_MS = 4_000

interface OwnerCalendar {
  ownerId: string
  refreshToken: string
  config: CalendarConfig
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()
const busyCache = new Map<string, { fetchedAt: number; window: Interval; busy: Interval[] }>()

/** Test hook. */
export function resetAvailabilityCache(): void {
  tokenCache.clear()
  busyCache.clear()
}

/** Drops this instance's cached Google access for an owner (after disconnect). */
export function forgetGoogleAccess(ownerId: string): void {
  tokenCache.delete(ownerId)
  busyCache.delete(ownerId)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`google timeout after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

async function accessTokenFor(owner: OwnerCalendar, nowMs: number): Promise<string> {
  const cached = tokenCache.get(owner.ownerId)
  if (cached && cached.expiresAt > nowMs) return cached.token
  const token = await refreshAccessToken(owner.refreshToken)
  // Google access tokens live an hour; keep a safety margin.
  tokenCache.set(owner.ownerId, { token, expiresAt: nowMs + 45 * 60_000 })
  return token
}

/** Owner's calendar settings, or null when busy-checking is off for them. */
function ownerCalendar(row: {
  user_id: string
  google_refresh_token: string | null
  google_calendar_id: string | null
} | null): OwnerCalendar | null {
  if (!row?.google_refresh_token) return null
  const config = parseCalendarConfig(row.google_calendar_id)
  if (!config.busyScopes || config.busy.length === 0) return null
  const refreshToken = readSecret(row.google_refresh_token, 'google_refresh_token', (error) =>
    reportServerError(error, { area: 'booking.secrets' })
  )
  if (!refreshToken) return null
  return { ownerId: row.user_id, refreshToken, config }
}

async function fetchBusy(
  owner: OwnerCalendar,
  window: Interval,
  opts: { fresh: boolean; nowMs: number }
): Promise<Interval[]> {
  const cached = busyCache.get(owner.ownerId)
  if (
    !opts.fresh &&
    cached &&
    opts.nowMs - cached.fetchedAt < BUSY_CACHE_TTL_MS &&
    cached.window.start <= window.start &&
    cached.window.end >= window.end
  ) {
    return cached.busy
  }
  const token = await accessTokenFor(owner, opts.nowMs)
  const answer = await queryFreeBusy(token, owner.config.busy, window.start, window.end)
  if (answer.failed.length > 0) {
    reportServerError(new Error(`freeBusy: ${answer.failed.length} calendar(s) unreadable (${answer.failed[0].reason})`), {
      area: 'booking.freebusy',
    })
  }
  const busy = parseBusy(answer.busy)
  if (!opts.fresh) busyCache.set(owner.ownerId, { fetchedAt: opts.nowMs, window, busy })
  return busy
}

const wallAt = (ms: number, timeZone: string) => wallString(utcToWall(ms, timeZone))

/** Owner's booked/paid slots around a window — their events are proЯв's own. */
async function ownBookings(admin: SupabaseClient, ownerId: string, window: Interval, timeZone: string): Promise<SlotLike[]> {
  const { data } = await admin
    .from('booking_slots')
    .select('starts_at, duration_minutes')
    .eq('owner_id', ownerId)
    .in('status', ['booked', 'paid'])
    .gte('starts_at', wallAt(window.start - 86_400_000, timeZone))
    .lte('starts_at', wallAt(window.end, timeZone))
  return (data as SlotLike[] | null) ?? []
}

export interface AvailabilityOptions {
  admin?: SupabaseClient | null
  timeZone?: string
  nowMs?: number
}

/**
 * Public page / site block: drops free slots that collide with the
 * photographer's Google busy time. Never throws; on any problem returns the
 * slots unchanged.
 */
export async function hideBusySlots<T extends SlotLike>(
  handle: string,
  slots: T[],
  options: AvailabilityOptions = {}
): Promise<T[]> {
  if (slots.length === 0) return slots
  const timeZone = options.timeZone ?? DEFAULT_BOOKING_TIME_ZONE
  const nowMs = options.nowMs ?? Date.now()
  try {
    const admin = options.admin === undefined ? createSupabaseAdminClient() : options.admin
    if (!admin) return slots
    const { data } = await admin
      .from('booking_settings')
      .select('user_id, google_refresh_token, google_calendar_id')
      .eq('handle', handle)
      .eq('enabled', true)
      .maybeSingle()
    const owner = ownerCalendar(data)
    if (!owner) return slots
    const window = slotsWindow(slots, timeZone)
    if (!window) return slots
    const busy = await withTimeout(fetchBusy(owner, window, { fresh: false, nowMs }), GOOGLE_TIMEOUT_MS)
    if (busy.length === 0) return slots
    const own = await ownBookings(admin, owner.ownerId, window, timeZone)
    return filterFreeSlots(slots, busy, own, timeZone)
  } catch (error) {
    reportServerError(error, { area: 'booking.freebusy.page' })
    return slots
  }
}

export type GoogleVerdict = 'free' | 'busy' | 'unknown'

/**
 * Pre-booking check for ONE slot, always fresh from Google. 'unknown' means
 * "could not tell" (not connected, no grant, Google down) — the caller books
 * as usual.
 */
export async function checkSlotWithGoogle(
  admin: SupabaseClient,
  slot: { owner_id: string; starts_at: string; duration_minutes: number },
  options: { timeZone?: string; nowMs?: number } = {}
): Promise<GoogleVerdict> {
  const timeZone = options.timeZone ?? DEFAULT_BOOKING_TIME_ZONE
  const nowMs = options.nowMs ?? Date.now()
  try {
    const { data } = await admin
      .from('booking_settings')
      .select('user_id, google_refresh_token, google_calendar_id')
      .eq('user_id', slot.owner_id)
      .maybeSingle()
    const owner = ownerCalendar(data)
    if (!owner) return 'unknown'
    const window = slotInterval(slot.starts_at, slot.duration_minutes, timeZone)
    if (!window) return 'unknown'
    const busy = await withTimeout(fetchBusy(owner, window, { fresh: true, nowMs }), GOOGLE_TIMEOUT_MS)
    if (busy.length === 0) return 'free'
    const own = await ownBookings(admin, owner.ownerId, window, timeZone)
    return isSlotBusy(slot, busy, own, timeZone) ? 'busy' : 'free'
  } catch (error) {
    reportServerError(error, { area: 'booking.freebusy.book' })
    return 'unknown'
  }
}

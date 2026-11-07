/**
 * Wall-clock time helpers for booking.
 *
 * booking_slots.starts_at is a WALL-CLOCK timestamp without an offset
 * ('2026-07-20T14:00:00'): the photographer enters 14:00 and the client sees
 * 14:00, both in the photographer's time zone. Everything here works on those
 * strings and converts to real instants only where an instant is needed
 * (Google freeBusy answers in UTC, "is this slot in the past").
 *
 * Pure, dependency-free and host-timezone-independent (Intl only), so it runs
 * the same in the browser, on Vercel and in node:test.
 */

/**
 * The photographer's time zone. There is no per-photographer setting yet
 * (see docs/MANUAL_TASKS.md), so every booking lives in Kyiv time. Code that
 * needs a zone takes it as a parameter and defaults to this constant, so a
 * future setting only has to be passed through.
 */
export const DEFAULT_BOOKING_TIME_ZONE = 'Europe/Kyiv'

export interface WallParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' → parts, or null when malformed / not a real date. */
export function parseDate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

/** 'HH:MM' → minutes since midnight, or null. '24:00' is accepted as end of day. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return null
  if (h === 24 && min === 0) return 24 * 60
  if (h > 23) return null
  return h * 60 + min
}

export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** Canonical wall-clock string as Postgres returns `timestamp`: 'YYYY-MM-DDTHH:MM:00'. */
export function wallString(p: WallParts): string {
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00`
}

/** Any 'YYYY-MM-DD[T ]HH:MM[:SS[.fff]]' → parts (seconds dropped). */
export function parseWall(value: string): WallParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  }
}

/**
 * Dedup key for a slot start: minute precision, separator-insensitive, so
 * '2026-07-20 14:00:00', '2026-07-20T14:00' and '2026-07-20T14:00:00' match.
 */
export function slotKey(startsAt: string): string {
  const p = parseWall(startsAt)
  return p ? wallString(p) : startsAt
}

/** Calendar arithmetic on wall-clock parts (no time zone involved). */
export function addMinutesWall(p: WallParts, minutes: number): WallParts {
  const base = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  const d = new Date(base + minutes * 60_000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

/** 'YYYY-MM-DD' + n days. */
export function addDays(date: string, days: number): string {
  const p = parseDate(date)
  if (!p) return date
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day) + days * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const p = parseDate(date)
  if (!p) return 0
  const js = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  return js === 0 ? 7 : js
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

/** Whole days from `from` to `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  if (!a || !b) return NaN
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000
  )
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** The wall clock in `timeZone` at a UTC instant. */
export function utcToWall(utcMs: number, timeZone: string): WallParts {
  const parts: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
  }
}

function offsetMs(utcMs: number, timeZone: string): number {
  const w = utcToWall(utcMs, timeZone)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - Math.floor(utcMs / 60_000) * 60_000
}

/**
 * Wall clock in `timeZone` → UTC instant. For a time that happens twice
 * (autumn fall-back) the earlier instant wins; for a time that does not exist
 * (spring gap) the result is the instant just after the gap — use
 * `wallExists` to detect that case.
 */
export function wallToUtc(p: WallParts, timeZone: string): number {
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  // Two passes converge for every real zone (offset changes at most once
  // within the few hours between the guess and the answer).
  let guess = asUtc - offsetMs(asUtc, timeZone)
  guess = asUtc - offsetMs(guess, timeZone)
  // Fall-back ambiguity: prefer the earlier of the two candidates.
  const earlier = guess - 60 * 60_000
  const e = utcToWall(earlier, timeZone)
  if (wallString(e) === wallString(p)) return earlier
  return guess
}

/** False for wall-clock times skipped by a DST jump (e.g. 03:30 on the spring-forward night). */
export function wallExists(p: WallParts, timeZone: string): boolean {
  return wallString(utcToWall(wallToUtc(p, timeZone), timeZone)) === wallString(p)
}

/** A slot as a half-open UTC interval [start, end). */
export interface Interval {
  start: number
  end: number
}

export function slotInterval(startsAt: string, durationMinutes: number, timeZone: string): Interval | null {
  const p = parseWall(startsAt)
  if (!p) return null
  const end = addMinutesWall(p, durationMinutes)
  return { start: wallToUtc(p, timeZone), end: wallToUtc(end, timeZone) }
}

/** Today's date in `timeZone` as 'YYYY-MM-DD'. */
export function todayIn(timeZone: string, nowMs: number = Date.now()): string {
  const w = utcToWall(nowMs, timeZone)
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`
}

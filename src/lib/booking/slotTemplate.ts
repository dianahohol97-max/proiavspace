/**
 * "Create slots from a template" — the pure generator behind the schedule
 * form. The same code runs in the browser (instant preview: "N slots will be
 * created") and in the server action (the authority), so the preview and the
 * insert can never disagree.
 *
 * A template is: a date range, a set of weekdays, and either
 *   - `times`:    explicit start times per day (10:00, 13:00, 16:00);
 *   - `interval`: "from 10:00 to 18:00 every N minutes" — a slot fits only if
 *                 it also ENDS by the range end;
 *   - `allDay`:   one slot per day covering the whole range (weddings): the
 *                 day is closed by a single booking.
 * All times are wall-clock in the photographer's zone (see ./time.ts).
 */
import {
  DEFAULT_BOOKING_TIME_ZONE,
  addDays,
  addMinutesWall,
  daysBetween,
  formatTime,
  isoWeekday,
  parseDate,
  parseTime,
  slotKey,
  wallExists,
  wallString,
  wallToUtc,
} from './time'

/** One batch may not create more than this many slots. */
export const MAX_SLOTS_PER_BATCH = 500
/** A template period may not be longer than this (inclusive days). */
export const MAX_PERIOD_DAYS = 366
export const MIN_SLOT_MINUTES = 15
/**
 * The CHECK on booking_slots.duration_minutes (migration 0004) allows 15–480.
 * Longer slots (a 10:00–22:00 wedding) need migration 0058, which widens it
 * to a full day; the generator accepts up to a day and the server action
 * turns the database refusal into a clear message until 0058 is applied.
 */
export const DB_MAX_SLOT_MINUTES = 480
export const MAX_SLOT_MINUTES = 24 * 60

export type TemplateMode = 'times' | 'interval' | 'allDay'

export interface SlotTemplate {
  /** 'YYYY-MM-DD', inclusive. */
  from: string
  /** 'YYYY-MM-DD', inclusive. */
  to: string
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  mode: TemplateMode
  /** mode 'times': 'HH:MM' start times. */
  times?: string[]
  /** mode 'interval' / 'allDay': 'HH:MM'. */
  rangeStart?: string
  /** mode 'interval' / 'allDay': 'HH:MM' ('24:00' = midnight). */
  rangeEnd?: string
  /** mode 'interval': minutes between starts. Defaults to the duration. */
  stepMinutes?: number
  /** Ignored in 'allDay' (derived from the range). */
  durationMinutes: number
  priceUah: number
}

export type TemplateError =
  | 'bad_period'
  | 'period_too_long'
  | 'no_weekdays'
  | 'no_times'
  | 'bad_time'
  | 'bad_range'
  | 'bad_step'
  | 'bad_duration'
  | 'bad_price'
  | 'too_many'

export interface NewSlot {
  starts_at: string
  duration_minutes: number
  price_uah: number
}

export interface GenerateResult {
  /** Slots to insert — unique, not in `existing`, not in the past. */
  slots: NewSlot[]
  /** Skipped because a slot with that start already exists (or repeats in the template). */
  duplicates: number
  /** Skipped because the start is already in the past. */
  past: number
  /** Skipped because the wall-clock time does not exist that day (DST jump). */
  nonexistent: number
  errors: TemplateError[]
}

export interface GenerateOptions {
  /** Slot starts already in the database for this owner (any wall-clock format). */
  existing?: Iterable<string>
  timeZone?: string
  /** Injected for tests; defaults to Date.now(). */
  nowMs?: number
}

/** Starting minutes-of-day for one day, plus the duration each slot gets. */
function dayPlan(t: SlotTemplate, errors: TemplateError[]): { starts: number[]; duration: number } {
  if (t.mode === 'times') {
    const raw = (t.times ?? []).map((s) => s.trim()).filter(Boolean)
    if (raw.length === 0) errors.push('no_times')
    const starts: number[] = []
    for (const s of raw) {
      const m = parseTime(s)
      if (m === null || m >= 24 * 60) {
        errors.push('bad_time')
        continue
      }
      starts.push(m)
    }
    return { starts: [...new Set(starts)].sort((a, b) => a - b), duration: Math.round(t.durationMinutes) }
  }

  const start = parseTime(t.rangeStart ?? '')
  const end = parseTime(t.rangeEnd ?? '')
  if (start === null || end === null || start >= 24 * 60) {
    errors.push('bad_time')
    return { starts: [], duration: 0 }
  }
  if (end <= start) {
    errors.push('bad_range')
    return { starts: [], duration: 0 }
  }

  if (t.mode === 'allDay') return { starts: [start], duration: end - start }

  const duration = Math.round(t.durationMinutes)
  const step = Math.round(t.stepMinutes ?? duration)
  if (!Number.isFinite(step) || step < 5 || step > 24 * 60) {
    errors.push('bad_step')
    return { starts: [], duration }
  }
  const starts: number[] = []
  for (let m = start; m + duration <= end; m += step) starts.push(m)
  if (starts.length === 0 && Number.isFinite(duration) && duration > 0) errors.push('bad_range')
  return { starts, duration }
}

export function generateSlots(t: SlotTemplate, options: GenerateOptions = {}): GenerateResult {
  const timeZone = options.timeZone ?? DEFAULT_BOOKING_TIME_ZONE
  const nowMs = options.nowMs ?? Date.now()
  const errors: TemplateError[] = []
  const result: GenerateResult = { slots: [], duplicates: 0, past: 0, nonexistent: 0, errors }

  const from = parseDate(t.from)
  const to = parseDate(t.to)
  const span = daysBetween(t.from, t.to)
  if (!from || !to || !(span >= 0)) errors.push('bad_period')
  else if (span + 1 > MAX_PERIOD_DAYS) errors.push('period_too_long')

  const weekdays = new Set((t.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))
  if (weekdays.size === 0) errors.push('no_weekdays')

  const price = Number(t.priceUah)
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) errors.push('bad_price')

  const before = errors.length
  const { starts, duration } = dayPlan(t, errors)
  const planFailed = errors.length > before
  if (
    !planFailed &&
    (!Number.isFinite(duration) || duration < MIN_SLOT_MINUTES || duration > MAX_SLOT_MINUTES)
  ) {
    errors.push('bad_duration')
  }

  if (errors.length > 0) {
    result.errors = [...new Set(errors)]
    return result
  }

  const seen = new Set<string>()
  for (const s of options.existing ?? []) seen.add(slotKey(s))

  for (let i = 0; i <= span; i++) {
    const date = addDays(t.from, i)
    if (!weekdays.has(isoWeekday(date))) continue
    const d = parseDate(date)!
    for (const minutes of starts) {
      const wall = { ...d, hour: Math.floor(minutes / 60), minute: minutes % 60 }
      if (!wallExists(wall, timeZone)) {
        result.nonexistent++
        continue
      }
      const key = wallString(wall)
      if (seen.has(key)) {
        result.duplicates++
        continue
      }
      if (wallToUtc(wall, timeZone) <= nowMs) {
        result.past++
        continue
      }
      seen.add(key)
      result.slots.push({ starts_at: key, duration_minutes: duration, price_uah: price })
    }
  }

  if (result.slots.length > MAX_SLOTS_PER_BATCH) errors.push('too_many')
  return result
}

/** The wall-clock end of a slot as 'HH:MM' (for labels such as 10:00–22:00). */
export function slotEndTime(startsAt: string, durationMinutes: number): string {
  const key = slotKey(startsAt)
  const [date, time] = key.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const end = addMinutesWall({ year: y, month: m, day: d, hour: hh, minute: mm }, durationMinutes)
  return formatTime(end.hour * 60 + end.minute)
}

/**
 * Validates an untrusted payload (from the browser) into a SlotTemplate.
 * Shape only — semantic checks happen in generateSlots.
 */
export function parseTemplate(value: unknown): SlotTemplate | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const mode = v.mode
  if (mode !== 'times' && mode !== 'interval' && mode !== 'allDay') return null
  if (typeof v.from !== 'string' || typeof v.to !== 'string') return null
  if (!Array.isArray(v.weekdays) || v.weekdays.length > 7) return null
  const times = Array.isArray(v.times) ? v.times : []
  if (times.length > 48 || !times.every((x) => typeof x === 'string')) return null
  const optStr = (x: unknown) => (typeof x === 'string' ? x : undefined)
  const num = (x: unknown) => (typeof x === 'number' ? x : Number(x))
  return {
    from: v.from,
    to: v.to,
    weekdays: v.weekdays.map(num),
    mode,
    times: times as string[],
    rangeStart: optStr(v.rangeStart),
    rangeEnd: optStr(v.rangeEnd),
    stepMinutes: v.stepMinutes === undefined || v.stepMinutes === '' ? undefined : num(v.stepMinutes),
    durationMinutes: num(v.durationMinutes),
    priceUah: num(v.priceUah),
  }
}

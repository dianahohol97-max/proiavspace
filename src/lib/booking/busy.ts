/**
 * Google Calendar busy times vs. booking slots — pure logic, no I/O.
 *
 * Google freeBusy answers with merged busy intervals per calendar (UTC
 * instants, no event ids). Two kinds of busy time must NOT hide a slot:
 *
 *  1. events proЯв itself pushed for bookings. A busy interval lying entirely
 *     inside one of the owner's booked/paid slots is that slot's own event
 *     (or something during a shoot that is already booked) — it says nothing
 *     about neighbouring free slots. freeBusy merges overlapping busy time,
 *     so a personal event that sticks out of the booking still counts.
 *  2. a stale event for the very slot being checked (e.g. the photographer
 *     reopened a booking and the calendar cleanup failed): an interval that
 *     matches the slot EXACTLY is treated as our own leftover.
 */
import { slotInterval, type Interval } from './time'

export interface SlotLike {
  starts_at: string
  duration_minutes: number
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end
}

/** Parses Google's busy entries ({start, end} RFC3339) into intervals; drops junk. */
export function parseBusy(entries: { start?: string; end?: string }[] | undefined): Interval[] {
  const out: Interval[] = []
  for (const e of entries ?? []) {
    const start = Date.parse(e.start ?? '')
    const end = Date.parse(e.end ?? '')
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ start, end })
  }
  return out
}

/**
 * Busy time that really blocks `slot`: everything from `busy` except
 * intervals inside the owner's own bookings and an exact match of the slot.
 */
export function blockingBusy(slot: Interval, busy: Interval[], own: Interval[]): Interval[] {
  return busy.filter(
    (b) =>
      overlaps(slot, b) &&
      !(b.start === slot.start && b.end === slot.end) &&
      !own.some((o) => contains(o, b))
  )
}

export function isSlotBusy(
  slot: SlotLike,
  busy: Interval[],
  own: SlotLike[],
  timeZone: string
): boolean {
  const interval = slotInterval(slot.starts_at, slot.duration_minutes, timeZone)
  if (!interval) return false
  const ownIntervals = own
    .map((o) => slotInterval(o.starts_at, o.duration_minutes, timeZone))
    .filter((x): x is Interval => x !== null)
  return blockingBusy(interval, busy, ownIntervals).length > 0
}

/** Keeps the slots that do not collide with real busy time. */
export function filterFreeSlots<T extends SlotLike>(
  slots: T[],
  busy: Interval[],
  own: SlotLike[],
  timeZone: string
): T[] {
  if (busy.length === 0) return slots
  const ownIntervals = own
    .map((o) => slotInterval(o.starts_at, o.duration_minutes, timeZone))
    .filter((x): x is Interval => x !== null)
  return slots.filter((slot) => {
    const interval = slotInterval(slot.starts_at, slot.duration_minutes, timeZone)
    return !interval || blockingBusy(interval, busy, ownIntervals).length === 0
  })
}

/** The UTC window covering all `slots` (for one freeBusy query), or null. */
export function slotsWindow(slots: SlotLike[], timeZone: string): Interval | null {
  let start = Infinity
  let end = -Infinity
  for (const slot of slots) {
    const i = slotInterval(slot.starts_at, slot.duration_minutes, timeZone)
    if (!i) continue
    start = Math.min(start, i.start)
    end = Math.max(end, i.end)
  }
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null
}

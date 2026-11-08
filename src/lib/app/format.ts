/** «08.11, 14:00» from booking_slots.starts_at (a Kyiv wall-clock timestamp). */
export function formatSlotShort(startsAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(startsAt)
  return match ? `${match[3]}.${match[2]}, ${match[4]}:${match[5]}` : startsAt
}

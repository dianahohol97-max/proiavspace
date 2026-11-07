/**
 * «Останні події від клієнтів» on the dashboard home: client picks
 * (favorites / retouch, grouped per gallery) and bookings, newest first.
 * Pure: the dashboard page reads the rows, this shapes them.
 */
export type AppEventKind = 'favorite' | 'retouch' | 'booking'

export interface AppEvent {
  kind: AppEventKind
  /** Newest moment of the event (ISO). */
  at: string
  galleryId?: string
  galleryTitle?: string
  /** Photos marked (picks) — distinct photos. */
  count?: number
  clientName?: string
  startsAt?: string
}

export interface SelectionRow {
  gallery_id: string
  asset_id: string
  kind: 'favorite' | 'retouch'
  created_at: string
}

export interface BookingRow {
  id: string
  client_name: string | null
  starts_at: string
  booked_at: string | null
}

export function buildRecentEvents(
  selections: SelectionRow[],
  galleryTitles: Map<string, string>,
  bookings: BookingRow[],
  limit = 6
): AppEvent[] {
  const groups = new Map<string, { event: AppEvent; assets: Set<string> }>()
  for (const row of selections) {
    const title = galleryTitles.get(row.gallery_id)
    if (!title) continue // not the photographer's gallery
    const id = `${row.gallery_id}:${row.kind}`
    const group = groups.get(id) ?? {
      event: { kind: row.kind, at: row.created_at, galleryId: row.gallery_id, galleryTitle: title },
      assets: new Set<string>(),
    }
    group.assets.add(row.asset_id)
    if (row.created_at > group.event.at) group.event.at = row.created_at
    groups.set(id, group)
  }
  const events: AppEvent[] = Array.from(groups.values()).map(({ event, assets }) => ({ ...event, count: assets.size }))
  for (const booking of bookings) {
    if (!booking.booked_at) continue
    events.push({
      kind: 'booking',
      at: booking.booked_at,
      clientName: booking.client_name?.trim() || '—',
      startsAt: booking.starts_at,
    })
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit)
}

/** «щойно» / «5 хв тому» / «3 год тому» / «2 дн. тому». */
export function timeAgo(
  at: string,
  now: Date,
  t: { agoNow: string; agoMinutes: string; agoHours: string; agoDays: string }
): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / 60_000))
  if (minutes < 1) return t.agoNow
  if (minutes < 60) return t.agoMinutes.replace('{n}', String(minutes))
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t.agoHours.replace('{n}', String(hours))
  return t.agoDays.replace('{n}', String(Math.floor(hours / 24)))
}

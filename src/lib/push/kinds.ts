/**
 * Types of photographer notifications (Web Push) and their on/off switches.
 * Shared by the server (send.ts, API) and the settings UI. The column names
 * of push_preferences (migration 0068) are exactly these ids.
 */
export const PUSH_KINDS = [
  'client_picks',
  'first_view',
  'booking',
  'storage_low',
  'gallery_expiring',
] as const

export type PushKind = (typeof PUSH_KINDS)[number]

export type PushPreferences = Record<PushKind, boolean>

/** No row in push_preferences = every type is on. */
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  client_picks: true,
  first_view: true,
  booking: true,
  storage_low: true,
  gallery_expiring: true,
}

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === 'string' && (PUSH_KINDS as readonly string[]).includes(value)
}

/** Picks only known boolean switches out of an untrusted body; null when none. */
export function parsePreferencesPatch(value: unknown): Partial<PushPreferences> | null {
  if (typeof value !== 'object' || value === null) return null
  const out: Partial<PushPreferences> = {}
  for (const kind of PUSH_KINDS) {
    const v = (value as Record<string, unknown>)[kind]
    if (typeof v === 'boolean') out[kind] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Storage share (0..1) from which «місце закінчується» is sent. */
export const STORAGE_LOW_THRESHOLD = 0.9

/** A gallery closing within this many days triggers «скоро закриється». */
export const EXPIRING_WITHIN_DAYS = 3

/** Shape the browser hands us (PushSubscription.toJSON()). */
export interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Validates PushSubscription.toJSON() from an untrusted body. */
export function parseSubscription(value: unknown): PushSubscriptionInput | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const keys = v.keys as Record<string, unknown> | undefined
  if (
    typeof v.endpoint !== 'string' ||
    !/^https:\/\/[^\s]{10,990}$/.test(v.endpoint) ||
    typeof keys !== 'object' ||
    keys === null ||
    typeof keys.p256dh !== 'string' ||
    typeof keys.auth !== 'string' ||
    !/^[A-Za-z0-9_\-=]{20,200}$/.test(keys.p256dh) ||
    !/^[A-Za-z0-9_\-=]{8,100}$/.test(keys.auth)
  ) {
    return null
  }
  return { endpoint: v.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

/** «Таблиці ще немає» from PostgREST / Postgres: the migration is not applied. */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(error.message ?? '')
  )
}

/**
 * Крон /api/cron/booking-release, крок 2: події Google Календаря звільнених
 * слотів видаляються (як у reopenSlot) — src/lib/booking/releaseEvents.ts.
 * Крок 1 (саме звільнення, releaseExpired.ts) тут ганяється разом із ним на
 * фейку в пам'яті; на справжніх міграціях його перевіряє booking-release.test.ts.
 * Google — мок fetch.
 */
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptSecret } from '@/lib/booking/secrets'
import { serializeCalendarConfig } from '@/lib/booking/calendarConfig'

type Row = Record<string, unknown>
const db: { booking_slots: Row[]; booking_settings: Row[] } = { booking_slots: [], booking_settings: [] }
const rpcCalls: string[] = []
const NOW = Date.parse('2026-11-07T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

/** release_expired_slots as in 0060 (service role: no auth.uid()). */
function releaseExpired(owner: string): number {
  const s = db.booking_settings.find((x) => x.user_id === owner)
  let n = 0
  for (const b of db.booking_slots) {
    if (
      b.owner_id === owner &&
      b.status === 'booked' &&
      Number(b.price_uah) > 0 &&
      s &&
      Number(s.unpaid_release_hours) > 0 &&
      Date.parse(String(b.booked_at)) < NOW - Number(s.unpaid_release_hours) * 3_600_000
    ) {
      Object.assign(b, {
        status: 'free', client_name: null, client_phone: null, client_email: null,
        booking_token: null, payment_method: null, invoice_id: null, booked_at: null,
      }) // google_event_id is NOT cleared by the SQL function
      n++
    }
  }
  return n
}

class Q {
  private f: ((r: Row) => boolean)[] = []
  private patch: Row | null = null
  constructor(private t: keyof typeof db) {}
  select() { return this }
  limit() { return this }
  order() { return this }
  range() { return this }
  update(p: Row) { this.patch = p; return this }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this }
  gt(c: string, v: number) { this.f.push((r) => Number(r[c]) > v); return this }
  lt(c: string, v: string) { this.f.push((r) => r[c] !== null && String(r[c]) < v); return this }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this }
  not(c: string, op: string, v: unknown) {
    assert.equal(op, 'is'); assert.equal(v, null)
    this.f.push((r) => r[c] !== null && r[c] !== undefined)
    return this
  }
  then<A = { data: Row[]; error: null }, B = never>(
    ok?: ((v: { data: Row[]; error: null }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    const rows = db[this.t].filter((r) => this.f.every((fn) => fn(r)))
    if (this.patch) for (const r of rows) Object.assign(r, this.patch)
    return Promise.resolve({ data: rows.map((r) => ({ ...r })), error: null as null }).then(ok, fail)
  }
}
const admin = {
  from: (t: keyof typeof db) => new Q(t),
  rpc: async (fn: string, args: { p_owner: string }) => {
    assert.equal(fn, 'release_expired_slots')
    rpcCalls.push(args.p_owner)
    return { data: releaseExpired(args.p_owner), error: null }
  },
} as unknown as SupabaseClient

const google = { down: false, deleted: [] as string[], tokenCalls: 0 }
const realFetch = globalThis.fetch

const A = 'aaaaaaaa-0000-4000-8000-000000000001' // Google підключено
const B = 'bbbbbbbb-0000-4000-8000-000000000002' // Google відключено
function slot(over: Row): Row {
  return {
    id: crypto.randomUUID(), owner_id: A, starts_at: '2026-11-20T10:00:00', duration_minutes: 60,
    price_uah: 2000, status: 'booked', booked_at: hoursAgo(30), google_event_id: null,
    client_name: 'Ія', client_phone: '+380', client_email: 'a@b.c', ...over,
  }
}

type Combined = { owners: number; released: number; errors: number; eventsDeleted: number; eventsCleared: number; eventErrors: number }

describe('крон: звільнення + видалення подій Google', () => {
  let release: (a: SupabaseClient, o: { nowMs: number }) => Promise<Combined>
  before(async () => {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        google.tokenCalls++
        if (google.down) return new Response('down', { status: 503 })
        return Response.json({ access_token: 'at', expires_in: 3600, token_type: 'Bearer' })
      }
      if (url.includes('/calendar/v3/calendars/') && init?.method === 'DELETE') {
        if (google.down) return new Response('down', { status: 503 })
        google.deleted.push(decodeURIComponent(url.split('/events/')[1]))
        return new Response(null, { status: 204 })
      }
      return realFetch(input as RequestInfo, init)
    }) as typeof fetch
    const { releaseExpiredBookings } = await import('@/lib/booking/releaseExpired')
    const { cleanupReleasedSlotEvents } = await import('@/lib/booking/releaseEvents')
    // Same order as the route: release first, then events of freed slots.
    release = async (a, o) => ({ ...(await releaseExpiredBookings(a, o.nowMs)), ...(await cleanupReleasedSlotEvents(a)) })
  })
  after(() => {
    globalThis.fetch = realFetch
  })
  beforeEach(() => {
    rpcCalls.length = 0
    google.down = false
    google.deleted = []
    google.tokenCalls = 0
    db.booking_settings = [
      {
        user_id: A, unpaid_release_hours: 24,
        google_refresh_token: encryptSecret('1//0rt-a', 'google_refresh_token'),
        google_calendar_id: serializeCalendarConfig({ write: 'work@group.calendar.google.com', busy: ['primary'] }),
      },
      { user_id: B, unpaid_release_hours: 2, google_refresh_token: null, google_calendar_id: 'primary' },
    ]
  })

  test('звільняє прострочені неоплачені броні всіх власників; решту не чіпає', async () => {
    db.booking_slots = [
      slot({ id: 'a-expired', booked_at: hoursAgo(30) }),                     // 30 год > 24 → звільнити
      slot({ id: 'a-fresh', booked_at: hoursAgo(5) }),                        // ще в межах 24 год
      slot({ id: 'a-paid', status: 'paid', booked_at: hoursAgo(50) }),        // оплачено
      slot({ id: 'a-free-price', price_uah: 0, booked_at: hoursAgo(50) }),    // безкоштовна — не чекає оплати
      slot({ id: 'b-expired', owner_id: B, booked_at: hoursAgo(3) }),         // у B вікно 2 год
    ]
    const summary = await release(admin, { nowMs: NOW })
    const status = Object.fromEntries(db.booking_slots.map((s) => [s.id, s.status]))
    assert.deepEqual(status, {
      'a-expired': 'free', 'a-fresh': 'booked', 'a-paid': 'paid', 'a-free-price': 'booked', 'b-expired': 'free',
    })
    assert.deepEqual(rpcCalls.sort(), [A, B].sort()) // лише власники з кандидатами
    assert.equal(summary.released, 2)
    assert.equal(db.booking_slots.find((s) => s.id === 'a-expired')!.client_name, null)
  })

  test('подія звільненого слота видаляється з Google (календар запису з налаштувань), id очищується', async () => {
    db.booking_slots = [
      slot({ id: 'a-expired', google_event_id: 'evt-a' }),
      slot({ id: 'a-paid', status: 'paid', google_event_id: 'evt-paid' }),
    ]
    const summary = await release(admin, { nowMs: NOW })
    assert.deepEqual(google.deleted, ['evt-a'])
    assert.equal(db.booking_slots.find((s) => s.id === 'a-expired')!.google_event_id, null)
    assert.equal(db.booking_slots.find((s) => s.id === 'a-paid')!.google_event_id, 'evt-paid')
    assert.equal(summary.eventsDeleted, 1)
  })

  test('Google недоступний → слот однаково звільнено, id лишається для наступного запуску', async () => {
    google.down = true
    db.booking_slots = [slot({ id: 'a-expired', google_event_id: 'evt-a' })]
    const summary = await release(admin, { nowMs: NOW })
    const row = db.booking_slots[0]
    assert.equal(row.status, 'free')
    assert.equal(row.google_event_id, 'evt-a')
    assert.equal(summary.eventErrors, 1)
    assert.equal(summary.errors, 0, 'збій Google не робить запуск помилковим')
    google.down = false
    await release(admin, { nowMs: NOW })
    assert.deepEqual(google.deleted, ['evt-a'])
    assert.equal(row.google_event_id, null)
  })

  test('календар відключено → подію видалити нічим, id просто очищується', async () => {
    db.booking_slots = [slot({ id: 'b-expired', owner_id: B, booked_at: hoursAgo(3), google_event_id: 'evt-b' })]
    const summary = await release(admin, { nowMs: NOW })
    assert.equal(db.booking_slots[0].status, 'free')
    assert.equal(db.booking_slots[0].google_event_id, null)
    assert.equal(summary.eventsCleared, 1)
    assert.equal(google.tokenCalls, 0)
  })

  test('нічого простроченого → жодного виклику RPC чи Google', async () => {
    db.booking_slots = [slot({ id: 'a-fresh', booked_at: hoursAgo(0.5) })]
    const summary = await release(admin, { nowMs: NOW })
    assert.deepEqual(rpcCalls, [])
    assert.equal(google.tokenCalls, 0)
    assert.deepEqual(
      { owners: summary.owners, released: summary.released, deleted: summary.eventsDeleted, errors: summary.errors },
      { owners: 0, released: 0, deleted: 0, errors: 0 }
    )
  })
})

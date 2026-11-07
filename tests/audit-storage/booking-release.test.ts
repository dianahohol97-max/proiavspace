/**
 * Release 6 — погодинний крон звільняє прострочені неоплачені броні всіх
 * фотографів (/api/cron/booking-release → src/lib/booking/release.ts) і
 * видаляє їхні події в Google Календарі (як reopenSlot).
 * Supabase — фейк у пам'яті з правилом release_expired_slots з 0005/0060;
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

describe('крон звільнення прострочених броней', () => {
  let release: typeof import('@/lib/booking/release').releaseExpiredBookings
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
    release = (await import('@/lib/booking/release')).releaseExpiredBookings
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
    assert.equal(summary.errors, 1)
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
    assert.deepEqual(summary, { owners: 0, released: 0, eventsDeleted: 0, eventsCleared: 0, errors: 0 })
  })
})

describe('/api/booking-release: захист CRON_SECRET', () => {
  test('без правильного Bearer → 401, нічого не робиться', async () => {
    const env = process.env as Record<string, string | undefined>
    const prev = env.CRON_SECRET
    env.CRON_SECRET = 'cron-secret-test'
    try {
      const { GET } = await import('@/app/api/cron/booking-release/route')
      const call = (auth?: string) =>
        GET(new Request('http://localhost/api/cron/booking-release', {
          headers: auth ? { authorization: auth } : {},
        }) as never)
      assert.equal((await call()).status, 401)
      assert.equal((await call('Bearer wrong')).status, 401)
    } finally {
      if (prev === undefined) delete env.CRON_SECRET
      else env.CRON_SECRET = prev
    }
  })
})

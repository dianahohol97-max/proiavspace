/**
 * Release 6 — розклад бронювання і двостороння синхронізація з Google.
 *
 *  - генератор слотів за шаблоном (дні тижня, кілька часів, інтервал, «весь
 *    день», без дублів, ліміт, перехід на літній/зимовий час);
 *  - перетин слотів із зайнятістю Google (freeBusy), свої події проЯв не блокують;
 *  - збереження вибору календарів у наявному полі без міграції;
 *  - кнопка «Забронювати дату» на сайтах;
 *  - кеш freeBusy, поведінка при недоступному Google, перевірка в /api/booking/book.
 * Google — мок globalThis.fetch; Supabase — фейковий клієнт у пам'яті.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, beforeEach, describe, mock, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MAX_SLOTS_PER_BATCH,
  generateSlots,
  parseTemplate,
  slotEndTime,
  type SlotTemplate,
} from '@/lib/booking/slotTemplate'
import { slotKey, utcToWall, wallExists, wallToUtc, wallString } from '@/lib/booking/time'
import { blockingBusy, filterFreeSlots, isSlotBusy, parseBusy } from '@/lib/booking/busy'
import { parseCalendarConfig, serializeCalendarConfig } from '@/lib/booking/calendarConfig'
import { hasBusyScopes, SCOPE_CALENDAR_LIST, SCOPE_EVENTS, SCOPE_FREEBUSY } from '@/lib/booking/googleCalendar'
import { resolveBookHref } from '@/lib/booking/siteCta'

const TZ = 'Europe/Kyiv'
/** 1 Nov 2026, 00:00 Kyiv — "now" for the generator tests. */
const NOW = Date.parse('2026-10-31T22:00:00Z')

function tpl(over: Partial<SlotTemplate>): SlotTemplate {
  return {
    from: '2026-11-02',
    to: '2026-11-08',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    mode: 'times',
    times: ['10:00'],
    durationMinutes: 60,
    priceUah: 1500,
    ...over,
  }
}
const gen = (t: SlotTemplate, existing: string[] = []) =>
  generateSlots(t, { existing, timeZone: TZ, nowMs: NOW })

describe('генератор слотів за шаблоном', () => {
  test('дні тижня: лише пн/ср/пт за два тижні', () => {
    const r = gen(tpl({ from: '2026-11-02', to: '2026-11-15', weekdays: [1, 3, 5] }))
    assert.deepEqual(r.errors, [])
    assert.deepEqual(
      r.slots.map((s) => s.starts_at.slice(0, 10)),
      ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13']
    )
  })

  test('кілька часів на день, відсортовані, з тривалістю й ціною', () => {
    const r = gen(tpl({ from: '2026-11-02', to: '2026-11-02', times: ['16:00', '10:00', '13:00'], durationMinutes: 90 }))
    assert.deepEqual(r.slots, [
      { starts_at: '2026-11-02T10:00:00', duration_minutes: 90, price_uah: 1500 },
      { starts_at: '2026-11-02T13:00:00', duration_minutes: 90, price_uah: 1500 },
      { starts_at: '2026-11-02T16:00:00', duration_minutes: 90, price_uah: 1500 },
    ])
  })

  test('інтервал «з 10:00 до 18:00 кожні 90 хв» — останній слот має завершитися до 18:00', () => {
    const r = gen(tpl({ to: '2026-11-02', mode: 'interval', rangeStart: '10:00', rangeEnd: '18:00', stepMinutes: 90, durationMinutes: 60 }))
    assert.deepEqual(r.slots.map((s) => s.starts_at.slice(11, 16)), ['10:00', '11:30', '13:00', '14:30', '16:00'])
    // 17:30 + 60 хв = 18:30 > 18:00 — не створюється
  })

  test('інтервал без кроку = крок дорівнює тривалості', () => {
    const r = gen(tpl({ to: '2026-11-02', mode: 'interval', rangeStart: '10:00', rangeEnd: '13:00', durationMinutes: 60 }))
    assert.deepEqual(r.slots.map((s) => s.starts_at.slice(11, 16)), ['10:00', '11:00', '12:00'])
  })

  test('«весь день» 10–22: один слот на день тривалістю 720 хв', () => {
    const r = gen(tpl({ from: '2026-11-07', to: '2026-11-08', weekdays: [6, 7], mode: 'allDay', rangeStart: '10:00', rangeEnd: '22:00', durationMinutes: 60 }))
    assert.deepEqual(r.slots, [
      { starts_at: '2026-11-07T10:00:00', duration_minutes: 720, price_uah: 1500 },
      { starts_at: '2026-11-08T10:00:00', duration_minutes: 720, price_uah: 1500 },
    ])
    assert.equal(slotEndTime(r.slots[0].starts_at, 720), '22:00')
  })

  test('без дублів: наявні слоти (у будь-якому форматі) і повтори в шаблоні не створюються', () => {
    const r = gen(tpl({ from: '2026-11-02', to: '2026-11-03', times: ['10:00', '10:00', '13:00'] }), [
      '2026-11-02T10:00:00',
      '2026-11-03 13:00:00', // формат, у якому Postgres може повернути timestamp
      '2026-11-03T13:00',
    ])
    assert.deepEqual(r.slots.map((s) => s.starts_at), ['2026-11-02T13:00:00', '2026-11-03T10:00:00'])
    assert.equal(r.duplicates, 2)
  })

  test('повторний запуск того самого шаблону нічого не створює', () => {
    const t = tpl({ times: ['10:00', '14:00'] })
    const first = gen(t)
    const second = gen(t, first.slots.map((s) => s.starts_at))
    assert.equal(first.slots.length, 14)
    assert.equal(second.slots.length, 0)
    assert.equal(second.duplicates, 14)
  })

  test('минулі старти пропускаються', () => {
    const now = Date.parse('2026-11-02T09:30:00Z') // 11:30 Київ
    const r = generateSlots(tpl({ from: '2026-11-02', to: '2026-11-02', times: ['10:00', '12:00'] }), { timeZone: TZ, nowMs: now })
    assert.deepEqual(r.slots.map((s) => s.starts_at), ['2026-11-02T12:00:00'])
    assert.equal(r.past, 1)
  })

  test(`ліміт ${MAX_SLOTS_PER_BATCH} слотів за раз`, () => {
    const r = gen(tpl({ from: '2026-11-02', to: '2027-01-31', mode: 'interval', rangeStart: '08:00', rangeEnd: '20:00', durationMinutes: 60 }))
    assert.ok(r.slots.length > MAX_SLOTS_PER_BATCH)
    assert.deepEqual(r.errors, ['too_many'])
  })

  test('помилки шаблону', () => {
    assert.deepEqual(gen(tpl({ weekdays: [] })).errors, ['no_weekdays'])
    assert.deepEqual(gen(tpl({ from: '2026-11-10', to: '2026-11-01' })).errors, ['bad_period'])
    assert.deepEqual(gen(tpl({ from: '2026-01-01', to: '2027-06-01' })).errors, ['period_too_long'])
    assert.deepEqual(gen(tpl({ times: [] })).errors, ['no_times'])
    assert.deepEqual(gen(tpl({ times: ['25:00'] })).errors, ['bad_time'])
    assert.deepEqual(gen(tpl({ mode: 'interval', rangeStart: '18:00', rangeEnd: '10:00' })).errors, ['bad_range'])
    assert.deepEqual(gen(tpl({ durationMinutes: 10 })).errors, ['bad_duration'])
    assert.deepEqual(gen(tpl({ priceUah: -1 })).errors, ['bad_price'])
  })

  test('parseTemplate відкидає сміття з браузера', () => {
    assert.equal(parseTemplate(null), null)
    assert.equal(parseTemplate({ mode: 'weekly' }), null)
    assert.equal(parseTemplate({ ...tpl({}), weekdays: 'mon' }), null)
    const ok = parseTemplate({ ...tpl({}), durationMinutes: '45', stepMinutes: '' })
    assert.equal(ok?.durationMinutes, 45)
    assert.equal(ok?.stepMinutes, undefined)
  })
})

describe('перехід на літній / зимовий час (Europe/Kyiv)', () => {
  test('10:00 лишається 10:00 по обидва боки переходу, а UTC-зсув змінюється', () => {
    const r = gen(tpl({ from: '2027-03-27', to: '2027-03-29', times: ['10:00'] }))
    assert.deepEqual(r.slots.map((s) => s.starts_at), ['2027-03-27T10:00:00', '2027-03-28T10:00:00', '2027-03-29T10:00:00'])
    const utc = r.slots.map((s) => new Date(wallToUtc({ year: 2027, month: 3, day: Number(s.starts_at.slice(8, 10)), hour: 10, minute: 0 }, TZ)).toISOString())
    assert.deepEqual(utc, ['2027-03-27T08:00:00.000Z', '2027-03-28T07:00:00.000Z', '2027-03-29T07:00:00.000Z'])
  })

  test('весна: 03:30 у ніч переходу не існує — слот пропускається, решта днів створюються', () => {
    const r = gen(tpl({ from: '2027-03-27', to: '2027-03-29', times: ['03:30'] }))
    assert.deepEqual(r.slots.map((s) => s.starts_at), ['2027-03-27T03:30:00', '2027-03-29T03:30:00'])
    assert.equal(r.nonexistent, 1)
    assert.equal(wallExists({ year: 2027, month: 3, day: 28, hour: 3, minute: 30 }, TZ), false)
  })

  test('осінь: 03:30 буває двічі — створюється один слот, перший з моментів', () => {
    const at = { year: 2026, month: 10, day: 25, hour: 3, minute: 30 }
    assert.equal(wallExists(at, TZ), true)
    assert.equal(new Date(wallToUtc(at, TZ)).toISOString(), '2026-10-25T00:30:00.000Z')
    const r2 = generateSlots(tpl({ from: '2026-10-25', to: '2026-10-25', times: ['03:30', '03:30'] }), {
      timeZone: TZ,
      nowMs: Date.parse('2026-10-20T00:00:00Z'),
    })
    assert.equal(r2.slots.length, 1)
  })

  test('інтервал через ніч переходу: тривалість слотів у хвилинах не змінюється', () => {
    const r = generateSlots(
      tpl({ from: '2026-10-24', to: '2026-10-25', mode: 'interval', rangeStart: '09:00', rangeEnd: '12:00', durationMinutes: 60 }),
      { timeZone: TZ, nowMs: Date.parse('2026-10-20T00:00:00Z') }
    )
    assert.equal(r.slots.length, 6)
    assert.ok(r.slots.every((s) => s.duration_minutes === 60))
  })

  test('utcToWall / wallToUtc — взаємно обернені для звичайного часу', () => {
    const w = { year: 2026, month: 7, day: 20, hour: 14, minute: 0 }
    assert.equal(wallString(utcToWall(wallToUtc(w, TZ), TZ)), '2026-07-20T14:00:00')
    assert.equal(slotKey('2026-07-20 14:00:00.000'), '2026-07-20T14:00:00')
  })
})

describe('перетин зі зайнятістю Google (freeBusy)', () => {
  // Слоти — київський настінний час; Google відповідає в UTC.
  const slot10 = { starts_at: '2026-11-10T10:00:00', duration_minutes: 60 } // 08:00–09:00Z
  const slot12 = { starts_at: '2026-11-10T12:00:00', duration_minutes: 60 } // 10:00–11:00Z
  const busy = (start: string, end: string) => parseBusy([{ start, end }])

  test('подія 10:30–11:30 ховає слот 10:00–11:00, але не 12:00', () => {
    const b = busy('2026-11-10T08:30:00Z', '2026-11-10T09:30:00Z')
    assert.deepEqual(filterFreeSlots([slot10, slot12], b, [], TZ), [slot12])
  })

  test('стик (подія закінчується рівно о початку слота) — не перетин', () => {
    const b = busy('2026-11-10T07:00:00Z', '2026-11-10T08:00:00Z')
    assert.equal(isSlotBusy(slot10, b, [], TZ), false)
  })

  test('подія, яку створив проЯв для сусіднього бронювання, не блокує вільний слот', () => {
    // Заброньовано 10:00–12:00 (подія проЯв), поруч вільний 11:00–12:00 у тому ж вікні.
    const booked = { starts_at: '2026-11-10T10:00:00', duration_minutes: 120 }
    const free11 = { starts_at: '2026-11-10T11:00:00', duration_minutes: 60 }
    const b = busy('2026-11-10T08:00:00Z', '2026-11-10T10:00:00Z')
    assert.equal(isSlotBusy(free11, b, [booked], TZ), false)
  })

  test('але особиста подія, що виходить за межі бронювання (злиті інтервали), блокує', () => {
    const booked = { starts_at: '2026-11-10T10:00:00', duration_minutes: 60 }
    const free11 = { starts_at: '2026-11-10T11:00:00', duration_minutes: 60 }
    const b = busy('2026-11-10T08:00:00Z', '2026-11-10T09:30:00Z') // 10:00–11:30 Київ
    assert.equal(isSlotBusy(free11, b, [booked], TZ), true)
  })

  test('залишок власної події саме для цього слота (точний збіг) не блокує його', () => {
    const b = busy('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z')
    assert.equal(isSlotBusy(slot10, b, [], TZ), false)
    assert.equal(blockingBusy({ start: 0, end: 10 }, [{ start: 0, end: 11 }], []).length, 1)
  })

  test('literal Google entries: биті записи відкидаються', () => {
    assert.deepEqual(parseBusy([{ start: 'x', end: 'y' }, { start: '2026-01-01T00:00:00Z', end: '2025-01-01T00:00:00Z' }]), [])
  })

  test('літній час: слот 10:00 у липні = 07:00Z', () => {
    const s = { starts_at: '2026-07-20T10:00:00', duration_minutes: 60 }
    assert.equal(isSlotBusy(s, busy('2026-07-20T07:30:00Z', '2026-07-20T07:45:00Z'), [], TZ), true)
    assert.equal(isSlotBusy(s, busy('2026-07-20T08:00:00Z', '2026-07-20T09:00:00Z'), [], TZ), false)
  })
})

describe('вибір календарів у наявному полі google_calendar_id (без міграції)', () => {
  test('старе значення «primary» — запис туди ж, зайнятість не перевіряється, треба перепідключити', () => {
    assert.deepEqual(parseCalendarConfig('primary'), { write: 'primary', busy: [], busyScopes: false })
    assert.deepEqual(parseCalendarConfig(null), { write: 'primary', busy: [], busyScopes: false })
  })
  test('нове значення — JSON v2 туди-назад', () => {
    const raw = serializeCalendarConfig({ write: 'primary', busy: ['primary', 'team@group.calendar.google.com', 'primary'] })
    assert.deepEqual(parseCalendarConfig(raw), {
      write: 'primary',
      busy: ['primary', 'team@group.calendar.google.com'],
      busyScopes: true,
    })
  })
  test('зіпсований JSON не ламає сторінку', () => {
    assert.deepEqual(parseCalendarConfig('{oops'), { write: 'primary', busy: [], busyScopes: false })
  })
  test('scope: потрібні і freebusy, і список календарів', () => {
    assert.equal(hasBusyScopes(`${SCOPE_EVENTS} ${SCOPE_FREEBUSY} ${SCOPE_CALENDAR_LIST}`), true)
    assert.equal(hasBusyScopes(`${SCOPE_EVENTS} ${SCOPE_FREEBUSY}`), false)
    assert.equal(hasBusyScopes(undefined), false)
  })
})

describe('кнопка «Забронювати дату» на сайті', () => {
  test('є вільні дати → #booking (навіть поверх старого посилання на /b/)', () => {
    assert.equal(resolveBookHref({ bookingActive: true, customUrl: '', leadForm: true }), '#booking')
    assert.equal(resolveBookHref({ bookingActive: true, customUrl: 'https://x.com/uk/b/olena', leadForm: false }), '#booking')
  })
  test('немає вільних дат → форма заявки', () => {
    assert.equal(resolveBookHref({ bookingActive: false, customUrl: '', leadForm: true }), '#contact')
    assert.equal(resolveBookHref({ bookingActive: false, customUrl: '/uk/b/olena', leadForm: true }), '#contact')
  })
  test('власне посилання фотографа зберігається, коли бронювання неактивне', () => {
    assert.equal(resolveBookHref({ bookingActive: false, customUrl: 'https://calendly.com/olena', leadForm: true }), 'https://calendly.com/olena')
  })
  test('ні бронювання, ні форми, ні посилання → кнопки немає', () => {
    assert.equal(resolveBookHref({ bookingActive: false, customUrl: '', leadForm: false }), '')
  })
})

// ---------------------------------------------------------------------------
// I/O: fake Supabase + mocked Google
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { booking_settings: [], booking_slots: [] }

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: ((r: Row) => boolean)[] = []
  private patch: Row | null = null
  constructor(private table: string) {}
  select() { return this }
  update(patch: Row) { this.patch = patch; return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this }
  lte(c: string, v: string) { this.filters.push((r) => String(r[c]) <= v); return this }
  private rows() { return (tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r))) }
  async maybeSingle() { return { data: this.rows()[0] ?? null, error: null } }
  async single() { const r = this.rows(); return { data: r[0] ?? null, error: r.length ? null : { code: 'PGRST116' } } }
  then<A = { data: unknown; error: null }, B = never>(
    ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    if (this.patch) for (const r of this.rows()) Object.assign(r, this.patch)
    return Promise.resolve({ data: this.rows(), error: null as null }).then(ok, fail)
  }
}
const fakeAdmin = { from: (t: string) => new FakeQuery(t) } as unknown as SupabaseClient

const google = {
  busy: [] as { start: string; end: string }[],
  down: false,
  calls: { token: 0, freeBusy: 0 },
  lastFreeBusyBody: null as null | { items: { id: string }[]; timeMin: string; timeMax: string },
}
const realFetch = globalThis.fetch
function installGoogle() {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      google.calls.token++
      if (google.down) return new Response('down', { status: 503 })
      return Response.json({ access_token: 'at-1', expires_in: 3600, token_type: 'Bearer' })
    }
    if (url.startsWith('https://www.googleapis.com/calendar/v3/freeBusy')) {
      google.calls.freeBusy++
      if (google.down) return new Response('down', { status: 503 })
      google.lastFreeBusyBody = JSON.parse(String(init?.body))
      return Response.json({ calendars: { primary: { busy: google.busy } } })
    }
    if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/')) {
      return Response.json({ id: 'evt-1' })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
}

const OWNER = '11111111-1111-4111-8111-111111111111'
function seedOwner(calendarId: string) {
  tables.booking_settings = [
    {
      user_id: OWNER,
      handle: 'olena',
      enabled: true,
      notify_email: null,
      google_refresh_token: 'rt-1',
      google_calendar_id: calendarId,
    },
  ]
}
const V2 = serializeCalendarConfig({ write: 'primary', busy: ['primary'] })
const slotA = { id: 'a', starts_at: '2026-11-10T10:00:00', duration_minutes: 60, price_uah: 0 }
const slotB = { id: 'b', starts_at: '2026-11-10T12:00:00', duration_minutes: 60, price_uah: 0 }

describe('доступність: кеш, недоступний Google, власні бронювання', () => {
  let avail: typeof import('@/lib/booking/availability')
  before(async () => {
    installGoogle()
    avail = await import('@/lib/booking/availability')
  })
  after(() => {
    globalThis.fetch = realFetch
  })
  beforeEach(() => {
    avail.resetAvailabilityCache()
    google.busy = []
    google.down = false
    google.calls = { token: 0, freeBusy: 0 }
    tables.booking_slots = []
    seedOwner(V2)
  })

  test('публічна сторінка ховає слот, що перетинається з подією; запит — на діапазон показаних дат', async () => {
    google.busy = [{ start: '2026-11-10T08:15:00Z', end: '2026-11-10T08:45:00Z' }]
    const out = await avail.hideBusySlots('olena', [slotA, slotB], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW })
    assert.deepEqual(out.map((s) => s.id), ['b'])
    assert.equal(google.lastFreeBusyBody?.timeMin, '2026-11-10T08:00:00.000Z')
    assert.equal(google.lastFreeBusyBody?.timeMax, '2026-11-10T11:00:00.000Z')
    assert.deepEqual(google.lastFreeBusyBody?.items, [{ id: 'primary' }])
  })

  test('кеш на фотографа: повторний перегляд за 3 хв не йде в Google, через 3+ хв — іде', async () => {
    await avail.hideBusySlots('olena', [slotA], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW })
    await avail.hideBusySlots('olena', [slotA], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW + 60_000 })
    assert.equal(google.calls.freeBusy, 1)
    await avail.hideBusySlots('olena', [slotA], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW + avail.BUSY_CACHE_TTL_MS + 1 })
    assert.equal(google.calls.freeBusy, 2)
    assert.equal(google.calls.token, 1, 'access token теж кешується')
  })

  test('Google недоступний → слоти показуються як є', async () => {
    google.down = true
    const out = await avail.hideBusySlots('olena', [slotA, slotB], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW })
    assert.deepEqual(out.map((s) => s.id), ['a', 'b'])
  })

  test('старе підключення (без scope freebusy) → Google не питаємо', async () => {
    seedOwner('primary')
    const out = await avail.hideBusySlots('olena', [slotA], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW })
    assert.deepEqual(out, [slotA])
    assert.equal(google.calls.freeBusy, 0)
  })

  test('без service-role ключа — без змін', async () => {
    const out = await avail.hideBusySlots('olena', [slotA], { admin: null, timeZone: TZ, nowMs: NOW })
    assert.deepEqual(out, [slotA])
  })

  test('подія проЯв для заброньованого сусіднього слота не ховає вільний', async () => {
    tables.booking_slots = [
      { id: 'x', owner_id: OWNER, status: 'booked', starts_at: '2026-11-10T09:00:00', duration_minutes: 120 },
    ]
    google.busy = [{ start: '2026-11-10T07:00:00Z', end: '2026-11-10T09:00:00Z' }] // 09:00–11:00 Київ
    const out = await avail.hideBusySlots('olena', [slotA, slotB], { admin: fakeAdmin, timeZone: TZ, nowMs: NOW })
    assert.deepEqual(out.map((s) => s.id), ['a', 'b'])
  })

  test('перевірка перед бронюванням: завжди свіжа, busy/free/unknown', async () => {
    const slot = { owner_id: OWNER, starts_at: slotA.starts_at, duration_minutes: 60 }
    assert.equal(await avail.checkSlotWithGoogle(fakeAdmin, slot, { timeZone: TZ, nowMs: NOW }), 'free')
    google.busy = [{ start: '2026-11-10T08:30:00Z', end: '2026-11-10T08:40:00Z' }]
    assert.equal(await avail.checkSlotWithGoogle(fakeAdmin, slot, { timeZone: TZ, nowMs: NOW }), 'busy')
    assert.equal(google.calls.freeBusy, 2, 'без кешу')
    google.down = true
    avail.resetAvailabilityCache()
    assert.equal(await avail.checkSlotWithGoogle(fakeAdmin, slot, { timeZone: TZ, nowMs: NOW }), 'unknown')
  })
})

describe('/api/booking/book з Google', () => {
  const root = path.resolve(__dirname, '..', '..')
  const modUrl = (rel: string) => pathToFileURL(path.join(root, rel)).href
  const rpcCalls: string[] = []
  let POST: (req: Request) => Promise<Response>

  before(async () => {
    installGoogle()
    mock.module(modUrl('src/lib/supabase/admin.ts'), {
      namedExports: { createSupabaseAdminClient: () => fakeAdmin },
    })
    mock.module(modUrl('src/lib/supabase/server.ts'), {
      namedExports: {
        createSupabaseServerClient: () => ({
          rpc: async (_name: string, args: { p_slot: string }) => {
            rpcCalls.push(args.p_slot)
            const slot = tables.booking_slots.find((s) => s.id === args.p_slot && s.status === 'free')
            if (!slot) return { data: null, error: null }
            slot.status = 'booked'
            return { data: 'token-1', error: null }
          },
        }),
      },
    })
    mock.module(modUrl('src/lib/email.ts'), {
      namedExports: { sendEmail: async () => undefined, isEmailConfigured: () => false },
    })
    const route = await import('@/app/api/booking/book/route')
    POST = route.POST as unknown as (req: Request) => Promise<Response>
  })
  after(() => {
    globalThis.fetch = realFetch
  })
  beforeEach(async () => {
    ;(await import('@/lib/booking/availability')).resetAvailabilityCache()
    rpcCalls.length = 0
    google.busy = []
    google.down = false
    seedOwner(V2)
    tables.booking_slots = [
      { id: 'slot-1', owner_id: OWNER, status: 'free', starts_at: '2027-02-10T10:00:00', duration_minutes: 60, price_uah: 0 },
    ]
  })

  const book = () =>
    POST(
      new Request('http://localhost/api/booking/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slotId: 'slot-1', name: 'Ія', phone: '+380', email: 'a@b.c' }),
      })
    )

  test('час щойно зайнятий у Google → 409 slot_unavailable, book_slot не викликається', async () => {
    google.busy = [{ start: '2027-02-10T08:00:00Z', end: '2027-02-10T08:30:00Z' }]
    const res = await book()
    assert.equal(res.status, 409)
    assert.deepEqual(await res.json(), { error: 'slot_unavailable' })
    assert.deepEqual(rpcCalls, [])
    assert.equal(tables.booking_slots[0].status, 'free')
  })

  test('вільно в Google → бронювання проходить, подія отримує google_event_id', async () => {
    const res = await book()
    assert.equal(res.status, 200)
    assert.deepEqual(rpcCalls, ['slot-1'])
    assert.equal(tables.booking_slots[0].google_event_id, 'evt-1')
  })

  test('Google лежить → бронювання не блокується', async () => {
    google.down = true
    const res = await book()
    assert.equal(res.status, 200)
    assert.deepEqual(rpcCalls, ['slot-1'])
  })
})

describe('вставка слотів: дубль = «вже існує», не помилка (індекс 0058)', () => {
  type Err = { code?: string; message: string } | null
  function client(opts: { upsertError?: Err; insertError?: Err; existing?: string[] }) {
    const calls: string[] = []
    const existing = new Set(opts.existing ?? [])
    const c = {
      from: () => ({
        upsert: (rows: { starts_at: string }[], o: { onConflict: string; ignoreDuplicates: boolean }) => ({
          select: async () => {
            calls.push(`upsert:${o.onConflict}:${o.ignoreDuplicates}`)
            if (opts.upsertError) return { data: null, error: opts.upsertError }
            const fresh = rows.filter((r) => !existing.has(r.starts_at))
            return { data: fresh.map((_, i) => ({ id: String(i) })), error: null }
          },
        }),
        insert: async () => {
          calls.push('insert')
          return { error: opts.insertError ?? null }
        },
      }),
    }
    return { supabase: c as unknown as SupabaseClient, calls }
  }
  const rows = ['10:00', '13:00', '16:00'].map((t) => ({
    owner_id: OWNER,
    starts_at: `2027-03-01T${t}:00`,
    duration_minutes: 60,
    price_uah: 0,
  }))
  let insert: typeof import('@/lib/booking/slotInsert').insertSlotsSkippingDuplicates
  before(async () => {
    insert = (await import('@/lib/booking/slotInsert')).insertSlotsSkippingDuplicates
  })

  test('ON CONFLICT (owner_id, starts_at) DO NOTHING: створено 2, пропущено 1', async () => {
    const { supabase, calls } = client({ existing: ['2027-03-01T13:00:00'] })
    assert.deepEqual(await insert(supabase, rows), { created: 2, duplicates: 1, error: null })
    assert.deepEqual(calls, ['upsert:owner_id,starts_at:true'])
  })

  test('подвійний клік: усе вже вставила інша вкладка → 0 створено, без помилки', async () => {
    const { supabase } = client({ existing: rows.map((r) => r.starts_at) })
    assert.deepEqual(await insert(supabase, rows), { created: 0, duplicates: 3, error: null })
  })

  test('23505 від бази — теж «вже існує»', async () => {
    const { supabase } = client({ upsertError: { code: '23505', message: 'duplicate key' } })
    assert.deepEqual(await insert(supabase, rows), { created: 0, duplicates: 3, error: null })
  })

  test('0058 ще не застосована (42P10) → звичайна вставка, як раніше', async () => {
    const { supabase, calls } = client({ upsertError: { code: '42P10', message: 'no unique constraint' } })
    assert.deepEqual(await insert(supabase, rows), { created: 3, duplicates: 0, error: null })
    assert.deepEqual(calls, ['upsert:owner_id,starts_at:true', 'insert'])
  })

  test('інші помилки (напр. CHECK 23514 для слотів > 8 год) не ховаються', async () => {
    const { supabase } = client({ upsertError: { code: '23514', message: 'check' } })
    const r = await insert(supabase, rows)
    assert.equal(r.created, 0)
    assert.equal(r.error?.code, '23514')
  })

  test('порожній список — без запиту', async () => {
    const { supabase, calls } = client({})
    assert.deepEqual(await insert(supabase, []), { created: 0, duplicates: 0, error: null })
    assert.deepEqual(calls, [])
  })
})

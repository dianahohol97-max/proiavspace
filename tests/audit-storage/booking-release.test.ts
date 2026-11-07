/**
 * Крон /api/cron/booking-release: щогодини звільняє прострочені неоплачені
 * броні всіх фотографів сервісною роллю. До нього звільнення відбувалося лише
 * тоді, коли фотограф відкривав кабінет бронювань.
 *
 * Роут ходить у справжні міграції на локальному Postgres
 * (helpers/local-pg.ts): admin-клієнт підмінено тонким перекладачем
 * supabase-js → SQL, що виконується від імені service_role. Після крону
 * слот знову повертає get_free_slots для anon — те, що читає /b/<handle>.
 * Без Postgres-бінарників SQL-частина пропускається.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, describe, mock, test } from 'node:test'
import { ownersWithExpiredBookings } from '@/lib/booking/releaseExpired'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

const NOW = Date.parse('2026-11-07T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

describe('кого звільняти (чиста функція)', () => {
  test('лише платні броні, старші за unpaid_release_hours власника', () => {
    const hours = new Map([
      ['a', 24],
      ['b', 24],
      ['c', 0],
    ])
    const owners = ownersWithExpiredBookings(
      [
        { owner_id: 'a', booked_at: hoursAgo(25), price_uah: 500 }, // прострочена
        { owner_id: 'b', booked_at: hoursAgo(23), price_uah: 500 }, // ще в межах
        { owner_id: 'b', booked_at: hoursAgo(30), price_uah: '0' }, // безкоштовна
        { owner_id: 'c', booked_at: hoursAgo(100), price_uah: 500 }, // авто-звільнення вимкнено
        { owner_id: 'd', booked_at: hoursAgo(100), price_uah: 500 }, // без налаштувань
        { owner_id: 'a', booked_at: null, price_uah: 500 },
        { owner_id: 'a', booked_at: hoursAgo(48), price_uah: '1500.00' }, // дубль власника
      ],
      hours,
      NOW
    )
    assert.deepEqual(owners, ['a'])
  })
})

// ---------------------------------------------------------------------------
// Роут на локальному Postgres
// ---------------------------------------------------------------------------

let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())
const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

const lit = (v: unknown) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const asService = (query: string) => pg!.trySql(`begin; set local role service_role; ${query}; commit;`)

/** Just enough of supabase-js for releaseExpiredBookings, as service_role SQL. */
function pgAdmin(opts: { failRpc?: boolean } = {}) {
  const calls: string[] = []
  function from(table: string) {
    let cols = '*'
    const where: string[] = []
    let order = ''
    let limit = ''
    const q = {
      select(c: string) { cols = c; return q },
      eq(c: string, v: unknown) { where.push(`${c} = ${lit(v)}`); return q },
      gt(c: string, v: unknown) { where.push(`${c} > ${lit(v)}`); return q },
      in(c: string, vs: unknown[]) { where.push(`${c} in (${vs.map(lit).join(',') || 'null'})`); return q },
      not(c: string, op: string, v: unknown) {
        assert.equal(op, 'is'); assert.equal(v, null)
        where.push(`${c} is not null`); return q
      },
      order(c: string) { order = `order by ${c}`; return q },
      range(a: number, b: number) { limit = `offset ${a} limit ${b - a + 1}`; return q },
      then(resolve: (r: { data: unknown; error: { message: string } | null }) => void) {
        const sql = `select coalesce(json_agg(t), '[]') from (select ${cols} from public.${table}
          ${where.length ? 'where ' + where.join(' and ') : ''} ${order} ${limit}) t`
        const r = asService(sql)
        resolve(r.ok ? { data: JSON.parse(r.out), error: null } : { data: null, error: { message: r.out } })
      },
    }
    return q
  }
  return {
    calls,
    from,
    async rpc(name: string, args: { p_owner: string }) {
      calls.push(`${name}:${args.p_owner}`)
      if (opts.failRpc) return { data: null, error: { message: 'boom' } }
      const r = asService(`select public.${name}(${lit(args.p_owner)})`)
      return r.ok ? { data: Number(r.out), error: null } : { data: null, error: { message: r.out } }
    },
  }
}

function newUser(): string {
  return pg!.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
}

/** Owner with a public booking page; returns a helper to add booked slots. */
function photographer(releaseHours: number) {
  const owner = newUser()
  const handle = 'r' + pg!.sql(`select substr(md5(random()::text), 1, 10)`)
  pg!.sql(`insert into public.booking_settings (user_id, enabled, handle, unpaid_release_hours)
           values ('${owner}', true, '${handle}', ${releaseHours})`)
  const slot = (bookedHoursAgo: number, price = 500) =>
    pg!.sql(`insert into public.booking_slots (owner_id, starts_at, price_uah, status, client_name, client_phone, client_email, booked_at)
             values ('${owner}', (now() + interval '5 days' + random() * interval '10 days')::timestamp, ${price}, 'booked',
                     'Клієнтка', '+380', 'c@t.test', now() - make_interval(hours => ${bookedHoursAgo}))
             returning id`)
  return { owner, handle, slot }
}

const statusOf = (slot: string) => pg!.sql(`select status from public.booking_slots where id = '${slot}'`)
/** What /b/<handle> gets: get_free_slots for anon. */
const publicSlots = (handle: string) =>
  pg!.sql(`begin; set local role anon; select coalesce(string_agg(id::text, ','), '') from public.get_free_slots('${handle}'); commit;`)

describe('/api/cron/booking-release', () => {
  const root = path.resolve(__dirname, '..', '..')
  const modUrl = (rel: string) => pathToFileURL(path.join(root, rel)).href
  let admin: ReturnType<typeof pgAdmin> | null = null
  let GET: (req: Request) => Promise<Response>

  before(async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    mock.module(modUrl('src/lib/supabase/admin.ts'), {
      namedExports: { createSupabaseAdminClient: () => admin },
    })
    GET = (await import('@/app/api/cron/booking-release/route')).GET as unknown as (req: Request) => Promise<Response>
  })

  const call = (auth?: string) =>
    GET(new Request('http://localhost/api/cron/booking-release', { headers: auth ? { authorization: auth } : {} }))

  test('без CRON_SECRET — 401, у базу не ходить', async () => {
    admin = pg ? pgAdmin() : null
    assert.equal((await call()).status, 401)
    assert.equal((await call('Bearer wrong')).status, 401)
    assert.deepEqual(admin?.calls ?? [], [])
  })

  test('усі міграції накочуються на чисту БД', { skip: skip() }, () => {
    assert.deepEqual(pg!.failedMigrations, {})
  })

  test('звільняє прострочені броні всіх власників; слот знову видно на /b', { skip: skip() }, async () => {
    const p1 = photographer(24)
    const p2 = photographer(2)
    const p3 = photographer(0) // авто-звільнення вимкнено
    const expired1 = p1.slot(25)
    const fresh1 = p1.slot(3)
    const free1 = p1.slot(100, 0) // безкоштовна бронь не чекає оплати
    const expired2 = p2.slot(3)
    const kept3 = p3.slot(500)
    assert.equal(publicSlots(p1.handle), '', 'до крону на /b прострочена бронь не видна')

    admin = pgAdmin()
    const res = await call('Bearer test-cron-secret')
    assert.equal(res.status, 200)
    const summary = (await res.json()) as { owners: number; released: number; errors: number }
    assert.equal(summary.errors, 0)
    assert.ok(summary.owners >= 2)
    assert.ok(summary.released >= 2)
    assert.ok(admin.calls.includes(`release_expired_slots:${p1.owner}`))
    assert.ok(admin.calls.includes(`release_expired_slots:${p2.owner}`))
    assert.ok(!admin.calls.includes(`release_expired_slots:${p3.owner}`), 'власникам без простроченого — без зайвих викликів')

    assert.equal(statusOf(expired1), 'free')
    assert.equal(statusOf(expired2), 'free')
    assert.equal(statusOf(fresh1), 'booked')
    assert.equal(statusOf(free1), 'booked')
    assert.equal(statusOf(kept3), 'booked')
    assert.equal(
      pg!.sql(`select coalesce(client_name, '') || coalesce(client_email, '') || coalesce(booked_at::text, '') from public.booking_slots where id = '${expired1}'`),
      '',
      'контакти клієнтки стерто'
    )

    assert.equal(publicSlots(p1.handle), expired1, 'звільнений слот знову на /b')
    assert.equal(publicSlots(p2.handle), expired2)
    assert.equal(publicSlots(p3.handle), '')
  })

  test('повторний запуск нічого не чіпає', { skip: skip() }, async () => {
    admin = pgAdmin()
    const summary = (await (await call('Bearer test-cron-secret')).json()) as { owners: number; released: number }
    assert.equal(summary.owners, 0)
    assert.equal(summary.released, 0)
  })

  test('помилка звільнення в одного власника — 500 і лічильник помилок, решта йде далі', { skip: skip() }, async () => {
    const a = photographer(1)
    const b = photographer(1)
    a.slot(5)
    b.slot(5)
    admin = pgAdmin({ failRpc: true })
    const res = await call('Bearer test-cron-secret')
    assert.equal(res.status, 500)
    const summary = (await res.json()) as { owners: number; errors: number }
    assert.equal(summary.owners, 2)
    assert.equal(summary.errors, 2)
  })

  test('без service key — 503', async () => {
    admin = null
    assert.equal((await call('Bearer test-cron-secret')).status, 503)
  })
})

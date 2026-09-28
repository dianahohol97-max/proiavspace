/**
 * Partner accounts (task 3, migration 0051): admin actions, the daily sync in
 * /api/cron/free-expiry, the 7-day letter, the end (Free + 30 days for the
 * existing galleries), a payment during the period, and the retention cron
 * leaving partners alone. Real database behind PostgREST (tests/referrals/run.sh).
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { before, beforeEach, describe, mock, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import * as harness from '../referrals/harness'
import { GALLERY_PLANS, planStorageBytes } from '../../src/lib/plans'
import { partnerEndingEmail } from '../../src/lib/lifecycle-emails'

const { dbAvailable, deliverWebhook, installMocks, outbox, pendingPayment, pg, q, session, signUp, startProxy, userClient } = harness
const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'
const root = path.resolve(__dirname, '../..')
const DAY = 24 * 3600 * 1000

describe('партнери: правила (без БД)', () => {
  test('3 / 6 місяців від дати початку', async () => {
    // Dynamic: lib/partners pulls in the e-mail module, which must load after the mocks.
    const { partnerEndFromMonths } = await import('@/lib/partners')
    const start = new Date('2026-10-01T00:00:00Z')
    assert.equal(partnerEndFromMonths(start, 3).toISOString(), '2027-01-01T00:00:00.000Z')
    assert.equal(partnerEndFromMonths(start, 6).toISOString(), '2027-04-01T00:00:00.000Z')
  })
  test('лист за 7 днів: лише для діючого періоду й один раз', async () => {
    const { partnerNoticeDue } = await import('@/lib/partners')
    const now = Date.parse('2026-12-25T03:00:00Z')
    const base = { ends_at: '2027-01-01T00:00:00Z', applied_at: 'x', ending_notice_at: null, finished_at: null }
    assert.equal(partnerNoticeDue(base, now), true)
    assert.equal(partnerNoticeDue({ ...base, ends_at: '2027-01-10T00:00:00Z' }, now), false)
    assert.equal(partnerNoticeDue({ ...base, ending_notice_at: 'y' }, now), false)
    assert.equal(partnerNoticeDue({ ...base, applied_at: null }, now), false)
  })
  test('лист: дата кінця, ціна з автоплатежем, що буде після', () => {
    const m = partnerEndingEmail({ name: 'Олена', plan: 'plus', endsAt: new Date('2027-01-01T10:00:00Z') })
    assert.match(m.subject, /партнерський період закінчується 01\.01\.2027/)
    assert.match(m.text, /519 ₴\/міс/)
    assert.match(m.text, /автоплатежем/)
    assert.match(m.text, /ще 30 днів/)
    assert.match(m.text, /\/uk\/dashboard\/billing/)
  })
})

let url = ''
before(async () => {
  if (skip) return
  mock.module(pathToFileURL(path.join(root, 'src/lib/storage/index.ts')).href, {
    namedExports: {
      getStorage: () => ({ async list() { return [] }, async delete() {} }),
      galleryPrefix: (o: string, g: string) => `u/${o}/g/${g}/`,
    },
  })
  mock.module('next/navigation', {
    namedExports: {
      redirect: (to: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url: to })
      },
    },
  })
  await installMocks()
  url = await startProxy()
})
beforeEach(() => {
  outbox.length = 0
  delete process.env.FREE_EXPIRY_MODE
  process.env.RETENTION_MODE = 'notify'
})

const redirected = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (err) {
    return (err as { url?: string }).url ?? `error: ${(err as Error).message}`
  }
  return 'no redirect'
}

let adminId = ''
function asAdmin() {
  if (!adminId) {
    adminId = pg(`select coalesce((select id::text from auth.users where email = 'admin@proiav.test'), '')`) || signUp({ email: 'admin@proiav.test' })
  }
  session.userId = adminId
}

function photographer(opts: { usedGb?: number } = {}) {
  const email = `partner-${Math.random().toString(36).slice(2, 10)}@test.local`
  const userId = signUp({ email })
  pg(`update public.profiles set display_name = 'Марта' where user_id = ${q(userId)}`)
  const slug = `g-${Math.random().toString(36).slice(2, 10)}`
  const galleryId = pg(`insert into public.galleries (owner_id, slug, title, is_published)
                        values (${q(userId)}, ${q(slug)}, 'Портфоліо', true) returning id`)
  if (opts.usedGb) {
    pg(`update public.profiles set storage_limit_bytes = ${1024 ** 4} , plan = 'pro', grace_until = null where user_id = ${q(userId)}`)
    pg(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
        values (${q(galleryId)}, ${q(userId)}, ${q(`u/${userId}/g/${galleryId}/o/big.jpg`)}, 'photo', 'image/jpeg', ${Math.round(opts.usedGb * 1024 ** 3)})`)
    pg(`update public.profiles set plan = 'free', storage_limit_bytes = 3221225472 where user_id = ${q(userId)}`)
  }
  return { userId, email, galleryId, slug }
}

async function save(userId: string, fields: Record<string, string>) {
  asAdmin()
  const { savePartnerPeriod } = await import('@/lib/actions/partners')
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return redirected(savePartnerPeriod('uk', userId, form))
}
const kyivToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })

async function cron(pathName: string) {
  const mod = await import(`@/app/api/cron/${pathName}/route`)
  const res = await mod.GET(new Request(`https://proiav.test/api/cron/${pathName}`, { headers: { authorization: 'Bearer cron-test' } }) as never)
  return { status: res.status as number, body: (await res.json()) as Record<string, unknown> }
}
const prof = (userId: string) =>
  pg(`select plan || '|' || storage_limit_bytes || '|' || coalesce(grace_until::text, '-') from public.profiles where user_id = ${q(userId)}`)

describe('партнерські акаунти: адмінка, крон, кінець, оплата', { skip }, () => {
  test('plan_storage_bytes() у SQL = plans.ts', () => {
    for (const id of Object.keys(GALLERY_PLANS) as (keyof typeof GALLERY_PLANS)[]) {
      assert.equal(Number(pg(`select public.plan_storage_bytes(${q(id)})`)), planStorageBytes(GALLERY_PLANS[id]), id)
    }
  })

  test('не адмін не може видати період', async () => {
    const p = photographer()
    const stranger = photographer()
    session.userId = stranger.userId
    const { savePartnerPeriod } = await import('@/lib/actions/partners')
    const form = new FormData()
    form.set('months', '3')
    assert.equal(await redirected(savePartnerPeriod('uk', p.userId, form)), '/uk/dashboard')
    assert.equal(pg(`select count(*) from public.partner_periods where user_id = ${q(p.userId)}`), '0')
  })

  test('«3 місяці» з сьогодні: Плюс 500 ГБ одразу, строк Free-галерей знято, бейдж «Партнер до»', async () => {
    const p = photographer()
    assert.notEqual(pg(`select coalesce(free_expires_at::text, '') from public.galleries where id = ${q(p.galleryId)}`), '')
    const to = await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3', note: 'Instagram, кейс' })
    assert.match(to, /\?partner=saved$/)
    const [plan, limit, graceUntil] = prof(p.userId).split('|')
    assert.equal(plan, 'plus')
    assert.equal(Number(limit), 500 * 1024 ** 3)
    const days = (new Date(graceUntil).getTime() - Date.now()) / DAY
    assert.ok(days > 88 && days < 93, String(days))
    assert.equal(pg(`select coalesce(free_expires_at::text, '') from public.galleries where id = ${q(p.galleryId)}`), '')
    assert.equal(pg(`select note from public.partner_periods where user_id = ${q(p.userId)}`), 'Instagram, кейс')

    const { data } = await userClient(url, p.userId).rpc('my_partner_until')
    assert.equal(new Date(data as string).getTime(), new Date(graceUntil).getTime())
    // Someone else sees no badge.
    const other = photographer()
    assert.equal((await userClient(url, other.userId).rpc('my_partner_until')).data, null)
    // New gallery during the period: no deadline.
    const g = pg(`insert into public.galleries (owner_id, slug, title) values (${q(p.userId)}, ${q(`n-${Date.now()}`)}, 'Нова') returning id`)
    assert.equal(pg(`select coalesce(free_expires_at::text, '') from public.galleries where id = ${q(g)}`), '')
    session.userId = null
  })

  test('довільна дата кінця; дата в минулому або раніше початку → помилка', async () => {
    const p = photographer()
    const end = new Date(Date.now() + 45 * DAY).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
    assert.match(await save(p.userId, { plan: 'pro', starts_at: kyivToday(), months: '0', ends_at: end }), /saved/)
    assert.equal(prof(p.userId).split('|')[0], 'pro')
    const q2 = photographer()
    assert.match(await save(q2.userId, { plan: 'plus', starts_at: kyivToday(), months: '0', ends_at: '2020-01-01' }), /bad_dates/)
    assert.equal(pg(`select count(*) from public.partner_periods where user_id = ${q(q2.userId)}`), '0')
  })

  test('початок у майбутньому: тариф не змінюється, доки крон не дійде до дати', async () => {
    const p = photographer()
    const start = new Date(Date.now() + 10 * DAY).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
    assert.match(await save(p.userId, { plan: 'plus', starts_at: start, months: '3' }), /saved/)
    assert.equal(prof(p.userId).split('|')[0], 'free')
    pg(`update public.partner_periods set starts_at = now() - interval '1 hour' where user_id = ${q(p.userId)}`)
    await cron('free-expiry')
    assert.equal(prof(p.userId).split('|')[0], 'plus')
  })

  test('активна підписка з автоплатежем → період не видається', async () => {
    const p = photographer()
    pg(`insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at, status)
        values (${q(p.userId)}, 'gallery', 'basic', 'month', 'monobank', 'tok', now() + interval '20 days', 'active')`)
    assert.match(await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3' }), /has_subscription/)
  })

  test('за 7 днів до кінця — один лист; retention-крон партнера не чіпає навіть понад 3 ГБ', async () => {
    const p = photographer({ usedGb: 5 })
    await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3' })
    pg(`update public.partner_periods set ends_at = now() + interval '6 days' where user_id = ${q(p.userId)}`)
    pg(`update public.profiles set grace_until = now() + interval '6 days' where user_id = ${q(p.userId)}`)

    await cron('storage-retention')
    assert.equal(outbox.filter((m) => m.to === p.email).length, 0, 'no «grace» letter for a partner')

    const first = await cron('free-expiry')
    assert.equal(first.status, 200)
    const mine = outbox.filter((m) => m.to === p.email)
    assert.equal(mine.length, 1)
    assert.match(mine[0].subject, /партнерський період закінчується/)
    outbox.length = 0
    await cron('free-expiry')
    assert.equal(outbox.filter((m) => m.to === p.email).length, 0)
  })

  test('кінець: Free 3 ГБ; наявні галереї — ще 30 днів; нові — 30 днів', async () => {
    const p = photographer({ usedGb: 5 })
    await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3' })
    pg(`update public.partner_periods set starts_at = now() - interval '90 days', ends_at = now() - interval '2 hours' where user_id = ${q(p.userId)}`)
    await cron('free-expiry')
    assert.equal(prof(p.userId), 'free|3221225472|-')
    assert.equal(
      pg(`select finish_reason from public.partner_periods where user_id = ${q(p.userId)}`),
      'ended'
    )
    const days = Number(pg(`select extract(epoch from free_expires_at - now()) / 86400 from public.galleries where id = ${q(p.galleryId)}`))
    assert.ok(days > 29.5 && days <= 30, String(days))
    const g = pg(`insert into public.galleries (owner_id, slug, title) values (${q(p.userId)}, ${q(`n-${Date.now()}`)}, 'Після') returning id`)
    assert.equal(pg(`select round(extract(epoch from free_expires_at - now()) / 86400) from public.galleries where id = ${q(g)}`), '30')
    assert.equal((await userClient(url, p.userId).rpc('my_partner_until')).data, null)
    // The galleries stay open for clients meanwhile.
    assert.equal(pg(`select coalesce(free_expired_at::text, '') from public.galleries where id = ${q(p.galleryId)}`), '')
  })

  test('«Завершити зараз» → одразу Free', async () => {
    const p = photographer()
    await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '6' })
    asAdmin()
    const { endPartnerPeriod } = await import('@/lib/actions/partners')
    assert.match(await redirected(endPartnerPeriod('uk', p.userId)), /partner=ended/)
    assert.equal(prof(p.userId).split('|')[0], 'free')
  })

  test('оплата під час періоду: оплачений тариф замінює партнерський', async () => {
    const p = photographer()
    await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3' })
    const { orderId } = pendingPayment({ userId: p.userId, plan: 'plus', amount: 519 })
    assert.equal(await deliverWebhook({ orderId, status: 'paid', cardToken: 'card-p' }), 200)
    assert.equal(prof(p.userId), 'plus|536870912000|-')
    assert.equal(pg(`select finish_reason from public.partner_periods where user_id = ${q(p.userId)}`), 'paid')
    await cron('free-expiry')
    assert.equal(prof(p.userId), 'plus|536870912000|-')
  })

  test('фотограф не читає partner_periods напряму (примітки — лише для адміна)', async () => {
    const p = photographer()
    await save(p.userId, { plan: 'plus', starts_at: kyivToday(), months: '3', note: 'секрет' })
    const { data } = await userClient(url, p.userId).from('partner_periods').select('note')
    assert.equal((data ?? []).length, 0)
  })
})

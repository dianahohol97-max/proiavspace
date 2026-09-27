/**
 * PR 2 — the plan lifecycle end to end (audit LC-01): /api/cron/storage-retention
 * against the real database behind PostgREST (tests/referrals/run.sh), with a
 * fake bucket and Brevo intercepted at the HTTP level.
 *
 *   grace e-mail → closure (clients locked out, owner not) → 30/7/1 reminders
 *   → deletion (bucket + rows) — plus payment reopening, failed charge,
 *   receipts, a failed read and a Brevo outage.
 *
 * Time is simulated by moving the stored timestamps back, not the clock.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { before, beforeEach, describe, mock, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import * as harness from '../referrals/harness'

const { anonClient, dbAvailable, deliverWebhook, installMocks, pendingPayment, pg, q, signUp, startProxy, userClient } =
  harness
const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'

// --- fake bucket -----------------------------------------------------------
const bucket = new Map<string, number>()
const storageUrl = pathToFileURL(path.resolve(__dirname, '../../src/lib/storage/index.ts')).href
let storageDown = false

// --- Brevo, intercepted at fetch -------------------------------------------
const brevo: { to: string; subject: string; text: string }[] = []
let brevoDown = false
/** After #170 the harness mocks lib/email itself; read its outbox then. */
const sent = () =>
  ((harness as unknown as { outbox?: typeof brevo }).outbox ?? brevo) as typeof brevo

let url = ''
before(async () => {
  if (skip) return
  mock.module(storageUrl, {
    namedExports: {
      getStorage: () => ({
        async list(prefix: string) {
          if (storageDown) throw new Error('B2 unavailable')
          return [...bucket.keys()]
            .filter((key) => key.startsWith(prefix))
            .map((key) => ({ key, sizeBytes: bucket.get(key)!, lastModified: new Date(0) }))
        },
        async delete(keys: string[]) {
          if (storageDown) throw new Error('B2 unavailable')
          for (const key of keys) bucket.delete(key)
        },
      }),
      galleryPrefix: (o: string, g: string) => `u/${o}/g/${g}/`,
    },
  })
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (target.startsWith('https://api.brevo.com/')) {
      if (brevoDown) return new Response('{"message":"down"}', { status: 503 })
      const body = JSON.parse(String(init?.body)) as { to: { email: string }[]; subject: string; textContent: string }
      brevo.push({ to: body.to[0].email, subject: body.subject, text: body.textContent })
      return new Response('{"messageId":"x"}', { status: 201 })
    }
    return realFetch(input, init)
  }) as typeof fetch
  await installMocks()
  // After installMocks — it clears BREVO_API_KEY for the referral tests.
  process.env.BREVO_API_KEY = 'test-brevo'
  process.env.EMAIL_FROM = 'проЯв <hello@proiav.space>'
  url = await startProxy()
})

beforeEach(() => {
  sent().length = 0
  brevoDown = false
  storageDown = false
  process.env.RETENTION_MODE = 'notify'
})

const GB = 1024 ** 3

/** A photographer on Базовий whose paid period ended `endedDaysAgo` days ago, 5 GB in two galleries. */
function lapsedAccount(opts: { endedDaysAgo?: number; usedGb?: number } = {}) {
  const email = `p-${Math.random().toString(36).slice(2, 10)}@test.local`
  const userId = signUp({ email })
  const ended = opts.endedDaysAgo ?? 0
  // Files go in while the plan is live (the quota trigger 0045 would refuse
  // them on an expired plan); the lapse date is set afterwards.
  pg(`update public.profiles set plan = 'basic', storage_limit_bytes = ${100 * GB},
        grace_until = null, display_name = 'Олена'
      where user_id = ${q(userId)}`)
  const galleries: { id: string; slug: string }[] = []
  for (let i = 0; i < 2; i++) {
    const slug = `g-${Math.random().toString(36).slice(2, 10)}`
    const id = pg(`insert into public.galleries (owner_id, slug, title, is_published)
                   values (${q(userId)}, ${q(slug)}, 'Весілля', true) returning id`)
    galleries.push({ id, slug })
    const key = `u/${userId}/g/${id}/o/photo-${i}.jpg`
    const bytes = Math.round(((opts.usedGb ?? 5) / 2) * GB)
    pg(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
        values (${q(id)}, ${q(userId)}, ${q(key)}, 'photo', 'image/jpeg', ${bytes})`)
    bucket.set(key, bytes)
  }
  pg(`update public.profiles set grace_until = now() + interval '${14 - ended} days' where user_id = ${q(userId)}`)
  const logo = `u/${userId}/brand/logo.png`
  bucket.set(logo, 100)
  return { userId, email, galleries, logo }
}

async function cron(query = '') {
  const { GET } = await import('@/app/api/cron/storage-retention/route')
  const res = await GET(
    new Request(`https://proiav.test/api/cron/storage-retention${query}`, {
      headers: { authorization: 'Bearer cron-test' },
    }) as never
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> & { planned: unknown[] } }
}

const notices = (userId: string) =>
  pg(`select coalesce(string_agg(kind, ',' order by kind), '') from public.lifecycle_notices where user_id = ${q(userId)}`)
const shiftNotices = (userId: string, days: number) =>
  pg(`update public.lifecycle_notices set sent_at = sent_at - interval '${days} days' where user_id = ${q(userId)}`)
const closedAt = (userId: string) =>
  pg(`select coalesce(gallery_closed_at::text, '') from public.profiles where user_id = ${q(userId)}`)
const anonSees = async (slug: string) =>
  ((await anonClient(url).from('galleries').select('id').eq('slug', slug)).data ?? []).length
const stateOf = async (slug: string) =>
  (await anonClient(url).rpc('public_gallery_state', { p_slug: slug })).data as string

describe('повний цикл: grace → закриття → нагадування → видалення', { skip }, () => {
  test('кожен крок у своєму порядку', async () => {
    const a = lapsedAccount()

    // Dry run: only a plan, nothing written, nothing sent.
    const dry = await cron('?dry=1')
    assert.equal(dry.body.mode, 'dry-run')
    assert.ok(
      (dry.body.planned as { userId: string; actions: string[] }[]).some(
        (p) => p.userId === a.userId && p.actions.includes('notify:grace_start')
      )
    )
    assert.equal(notices(a.userId), '')
    assert.equal(sent().length, 0)

    // Day 0: «тариф закінчився — 14 днів усе працює».
    const day0 = await cron()
    assert.equal(day0.status, 200, JSON.stringify(day0.body))
    assert.equal(day0.body.errors, 0, JSON.stringify(day0.body))
    assert.equal(notices(a.userId), 'grace_start')
    assert.equal(sent().filter((m) => m.to === a.email).length, 1)
    assert.match(sent()[0].subject, /закінчився — 14 днів усе працює як раніше/)
    assert.equal(closedAt(a.userId), '')
    assert.equal(await anonSees(a.galleries[0].slug), 1)

    // A second run the same day sends nothing new.
    await cron()
    assert.equal(sent().filter((m) => m.to === a.email).length, 1)

    // Day 14: grace over → letter 4, then closure.
    pg(`update public.profiles set grace_until = now() - interval '1 minute' where user_id = ${q(a.userId)}`)
    pg(`update public.lifecycle_notices set cycle = (select grace_until from public.profiles where user_id = ${q(a.userId)}) where user_id = ${q(a.userId)}`)
    shiftNotices(a.userId, 14)
    await cron()
    assert.notEqual(closedAt(a.userId), '')
    const closedMail = sent().find((m) => m.to === a.email && /галереї закриті для клієнтів/.test(m.subject))
    assert.ok(closedMail)
    assert.match(closedMail.text, /«Галерея тимчасово недоступна» —\nсвоєю мовою/)
    assert.match(closedMail.text, /Ваші 2 галереї/)

    // Clients are locked out, with the «тимчасово недоступна» state; the owner is not.
    assert.equal(await anonSees(a.galleries[0].slug), 0)
    assert.equal(await stateOf(a.galleries[0].slug), 'closed')
    const own = await userClient(url, a.userId).from('galleries').select('id')
    assert.equal(own.data?.length, 2)
    const assetsForAnon = await anonClient(url).from('assets').select('id').eq('owner_id', a.userId)
    assert.equal(assetsForAnon.data?.length ?? 0, 0)

    // Day 14 + 30: «через 30 днів».
    pg(`update public.profiles set gallery_closed_at = now() - interval '30 days' where user_id = ${q(a.userId)}`)
    await cron()
    assert.ok(sent().some((m) => m.to === a.email && /через 30 днів файли будуть видалені/.test(m.subject)))

    // Day 14 + 53: «через 7 днів».
    pg(`update public.profiles set gallery_closed_at = now() - interval '53 days' where user_id = ${q(a.userId)}`)
    await cron()
    assert.ok(sent().some((m) => m.to === a.email && /через 7 днів/.test(m.subject)))

    // Day 14 + 59: «завтра — останнє нагадування».
    pg(`update public.profiles set gallery_closed_at = now() - interval '59 days' where user_id = ${q(a.userId)}`)
    await cron()
    assert.ok(sent().some((m) => m.to === a.email && /завтра файли будуть видалені/.test(m.subject)))
    assert.equal(notices(a.userId), 'closed,delete_1,delete_30,delete_7,grace_start')

    // Day 14 + 60, but the «завтра» letter went out minutes ago → not yet.
    pg(`update public.profiles set gallery_closed_at = now() - interval '60 days 1 hour' where user_id = ${q(a.userId)}`)
    process.env.RETENTION_MODE = 'live'
    await cron()
    assert.equal(bucket.has(`u/${a.userId}/g/${a.galleries[0].id}/o/photo-0.jpg`), true)

    // A day later in «notify» mode deletion stays deferred.
    shiftNotices(a.userId, 1)
    process.env.RETENTION_MODE = 'notify'
    const deferred = await cron()
    assert.ok((deferred.body.deletionsDeferred as number) >= 1)
    assert.equal(bucket.has(`u/${a.userId}/g/${a.galleries[0].id}/o/photo-0.jpg`), true)

    // Live: files gone from the bucket (the logo stays), rows gone, account is Free.
    process.env.RETENTION_MODE = 'live'
    const live = await cron()
    assert.ok((live.body.deleted as number) >= 1)
    assert.equal([...bucket.keys()].filter((k) => k.startsWith(`u/${a.userId}/g/`)).length, 0)
    assert.equal(bucket.has(a.logo), true)
    assert.equal(pg(`select count(*) from public.assets where owner_id = ${q(a.userId)}`), '0')
    assert.equal(
      pg(`select plan || '|' || storage_used_bytes || '|' || coalesce(grace_until::text, '-') || '|' || coalesce(gallery_closed_at::text, '-')
          from public.profiles where user_id = ${q(a.userId)}`),
      'free|0|-|-'
    )
    assert.equal(pg(`select count(*) from public.galleries where owner_id = ${q(a.userId)} and is_published`), '0')
    assert.match(notices(a.userId), /deleted/)
  })
})

describe('окремі стани', { skip }, () => {
  test('вміщається в Free → просто стає Free, без листів і закриття', async () => {
    const a = lapsedAccount({ endedDaysAgo: 20, usedGb: 1 })
    await cron()
    assert.equal(pg(`select plan from public.profiles where user_id = ${q(a.userId)}`), 'free')
    assert.equal(sent().filter((m) => m.to === a.email).length, 0)
    assert.equal(await anonSees(a.galleries[0].slug), 1)
  })

  test('акаунт, що прострочився давно, не закривається без попередження', async () => {
    const a = lapsedAccount({ endedDaysAgo: 200 })
    await cron()
    assert.equal(closedAt(a.userId), '')
    assert.equal(notices(a.userId), 'grace_start')
    assert.match(sent().find((m) => m.to === a.email)!.text, /До \d{2}\.\d{2}\.\d{4} нічого не змінюється/)
  })

  test('оплата після закриття відкриває галереї одразу (webhook), крон прибирає позначку', async () => {
    const a = lapsedAccount({ endedDaysAgo: 30 })
    pg(`update public.profiles set gallery_closed_at = now() - interval '5 days' where user_id = ${q(a.userId)}`)
    assert.equal(await anonSees(a.galleries[0].slug), 0)
    const pay = pendingPayment({ userId: a.userId, amount: 129 })
    assert.equal(await deliverWebhook({ orderId: pay.orderId, status: 'paid' }), 200)
    assert.equal(await anonSees(a.galleries[0].slug), 1)
    assert.equal(closedAt(a.userId), '')
    // «Оплата пройшла» (лист 1).
    const receipt = sent().find((m) => m.to === a.email && /оплата 129 ₴ — тариф «Базовий»/.test(m.subject))
    assert.ok(receipt)
    assert.match(receipt.text, /рахунок для ФОП/)
  })

  test('невдале автосписання: лист 2, і крон не дублює його листом 3', async () => {
    const a = lapsedAccount({ endedDaysAgo: -30 }) // still paid
    pg(`update public.profiles set grace_until = null where user_id = ${q(a.userId)}`)
    const subId = pg(`insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at, status)
                      values (${q(a.userId)}, 'gallery', 'basic', 'month', 'monobank', 'tok', now(), 'active') returning id`)
    const pay = pendingPayment({ userId: a.userId, amount: 129, subscriptionId: subId })
    await deliverWebhook({ orderId: pay.orderId, status: 'failed' })
    const failed = sent().filter((m) => m.to === a.email)
    assert.equal(failed.length, 1)
    assert.match(failed[0].subject, /не вдалося списати 129 ₴ за тариф «Базовий»/)
    assert.equal(notices(a.userId), 'failed_charge')
    await cron()
    assert.equal(sent().filter((m) => m.to === a.email).length, 1)
  })

  test('помилка читання БД → 500, нічого не записано й не надіслано', async () => {
    const a = lapsedAccount()
    pg('revoke select on public.lifecycle_notices from service_role')
    try {
      const res = await cron()
      assert.equal(res.status, 500)
      assert.equal(res.body.error, 'db_read_failed')
    } finally {
      pg('grant select on public.lifecycle_notices to service_role')
    }
    assert.equal(notices(a.userId), '')
    assert.equal(sent().length, 0)
  })

  test('Brevo лежить → лист не записано, галереї не закриваються', async (t) => {
    if ((harness as unknown as { outbox?: unknown }).outbox) {
      t.skip('lib/email is mocked by the harness — Brevo is not on the wire')
      return
    }
    const a = lapsedAccount({ endedDaysAgo: 14 })
    pg(`insert into public.lifecycle_notices (user_id, cycle, kind, sent_at)
        select user_id, grace_until, 'grace_start', now() - interval '15 days' from public.profiles where user_id = ${q(a.userId)}`)
    pg(`update public.profiles set grace_until = now() - interval '1 minute' where user_id = ${q(a.userId)}`)
    pg(`update public.lifecycle_notices set cycle = (select grace_until from public.profiles where user_id = ${q(a.userId)}) where user_id = ${q(a.userId)}`)
    brevoDown = true
    const res = await cron()
    assert.ok((res.body.emailFailures as number) >= 1)
    assert.equal(closedAt(a.userId), '')
    assert.equal(notices(a.userId), 'grace_start')
  })

  test('B2 недоступний під час видалення → рядки й профіль не чіпаються', async () => {
    const a = lapsedAccount({ endedDaysAgo: 90 })
    pg(`update public.profiles set gallery_closed_at = now() - interval '61 days' where user_id = ${q(a.userId)}`)
    for (const kind of ['grace_start', 'closed', 'delete_30', 'delete_7', 'delete_1']) {
      pg(`insert into public.lifecycle_notices (user_id, cycle, kind, sent_at)
          select user_id, grace_until, ${q(kind)}, now() - interval '2 days' from public.profiles where user_id = ${q(a.userId)}`)
    }
    process.env.RETENTION_MODE = 'live'
    storageDown = true
    const res = await cron()
    assert.ok((res.body.errors as number) >= 1)
    assert.equal(pg(`select count(*) from public.assets where owner_id = ${q(a.userId)}`), '2')
    assert.notEqual(closedAt(a.userId), '')
  })

  test('без CRON_SECRET — 401', async () => {
    const { GET } = await import('@/app/api/cron/storage-retention/route')
    const res = await GET(new Request('https://proiav.test/api/cron/storage-retention') as never)
    assert.equal(res.status, 401)
  })
})

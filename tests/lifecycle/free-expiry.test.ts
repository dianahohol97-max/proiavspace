/**
 * Free plan: 30-day galleries (task 2, 28.09.2026) — rules (src/lib/free-expiry.ts)
 * and /api/cron/free-expiry against the real database behind PostgREST
 * (tests/referrals/run.sh), with a fake bucket and the harness's Brevo outbox.
 * Time is simulated by moving stored timestamps, not the clock.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { before, beforeEach, describe, mock, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import * as harness from '../referrals/harness'
import { DAY_MS, daysLeft, planFreeGallery, purgeDate, type FreeGallery } from '../../src/lib/free-expiry'
import { freeExpiryWarningEmail } from '../../src/lib/lifecycle-emails'

const { anonClient, dbAvailable, deliverWebhook, installMocks, mailer, outbox, pendingPayment, pg, q, session, signUp, startProxy, userClient } =
  harness
const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'
const root = path.resolve(__dirname, '../..')

// ---------------------------------------------------------------------------
// Rules (no database)
// ---------------------------------------------------------------------------
describe('правила 30 днів (planFreeGallery)', () => {
  const now = Date.parse('2026-10-10T03:00:00Z')
  const g = (over: Partial<FreeGallery> = {}): FreeGallery => ({
    galleryId: 'g',
    expiresAt: new Date(now + 20 * DAY_MS).toISOString(),
    expiredAt: null,
    assetCount: 10,
    ownerPaid: false,
    ...over,
  })

  test('більше 7 днів — нічого', () => {
    assert.deepEqual(planFreeGallery(g(), {}, now), { type: 'none' })
  })
  test('за 7 днів — лист d7, повторно — ні', () => {
    const gallery = g({ expiresAt: new Date(now + 7 * DAY_MS).toISOString() })
    assert.deepEqual(planFreeGallery(gallery, {}, now), { type: 'notify', kind: 'd7', alsoMark: [] })
    assert.deepEqual(planFreeGallery(gallery, { d7: 'x' }, now), { type: 'none' })
  })
  test('за 1 день — лист d1; якщо d7 пропущено, позначається без відправки', () => {
    const gallery = g({ expiresAt: new Date(now + 20 * 3600 * 1000).toISOString() })
    assert.deepEqual(planFreeGallery(gallery, { d7: 'x' }, now), { type: 'notify', kind: 'd1', alsoMark: [] })
    assert.deepEqual(planFreeGallery(gallery, {}, now), { type: 'notify', kind: 'd1', alsoMark: ['d7'] })
  })
  test('строк минув → закрити; порожня чернетка закривається без листів', () => {
    assert.deepEqual(planFreeGallery(g({ expiresAt: new Date(now - 1000).toISOString() }), {}, now), { type: 'expire' })
    assert.deepEqual(
      planFreeGallery(g({ assetCount: 0, expiresAt: new Date(now + 3 * DAY_MS).toISOString() }), {}, now),
      { type: 'none' }
    )
  })
  test('закрита < 7 днів — чекаємо; ≥ 7 днів — видалити файли', () => {
    const closed = new Date(now - 6 * DAY_MS).toISOString()
    assert.deepEqual(planFreeGallery(g({ expiredAt: closed }), {}, now), { type: 'none' })
    assert.deepEqual(planFreeGallery(g({ expiredAt: new Date(now - 7 * DAY_MS).toISOString() }), {}, now), { type: 'purge' })
    assert.equal(purgeDate(closed).getTime(), now + DAY_MS)
  })
  test('власник платить — ніколи нічого', () => {
    assert.deepEqual(planFreeGallery(g({ ownerPaid: true, expiredAt: new Date(0).toISOString() }), {}, now), { type: 'none' })
  })
  test('daysLeft округлює вгору і не йде в мінус', () => {
    assert.equal(daysLeft(new Date(now + 29.2 * DAY_MS).toISOString(), now), 30)
    assert.equal(daysLeft(new Date(now - DAY_MS).toISOString(), now), 0)
  })
  test('лист: дата закриття, «Базовий» 129 ₴, 7 днів до видалення, на «ви»', () => {
    const one = freeExpiryWarningEmail({ name: 'Олена', daysLeft: 7, galleries: [{ title: 'Весілля', closesAt: new Date('2026-10-17T10:00:00Z') }] })
    assert.match(one.subject, /«Весілля» закривається через 7 днів/)
    assert.match(one.text, /17\.10\.2026/)
    assert.match(one.text, /129 ₴/)
    assert.match(one.text, /через 7 днів після закриття файли видаляються/)
    assert.doesNotMatch(one.text, /\bти\b|\bтвої?\b/i)
    const two = freeExpiryWarningEmail({
      name: null,
      daysLeft: 1,
      galleries: [
        { title: 'A', closesAt: new Date() },
        { title: 'B', closesAt: new Date() },
      ],
    })
    assert.match(two.subject, /2 галереї закриваються завтра/)
  })
  test('крон щодня о 03:00 UTC у vercel.json', () => {
    const crons = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')).crons as { path: string; schedule: string }[]
    assert.deepEqual(crons.find((c) => c.path === '/api/cron/free-expiry'), { path: '/api/cron/free-expiry', schedule: '0 3 * * *' })
  })
})

// ---------------------------------------------------------------------------
// Database + cron
// ---------------------------------------------------------------------------
const bucket = new Map<string, number>()
let url = ''
before(async () => {
  if (skip) return
  mock.module(pathToFileURL(path.join(root, 'src/lib/storage/index.ts')).href, {
    namedExports: {
      getStorage: () => ({
        async list(prefix: string) {
          return [...bucket.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, sizeBytes: bucket.get(key)!, lastModified: new Date(0) }))
        },
        async delete(keys: string[]) {
          for (const key of keys) bucket.delete(key)
        },
        async head(key: string) {
          return bucket.has(key) ? { sizeBytes: bucket.get(key)!, contentType: 'image/jpeg' } : null
        },
      }),
      galleryPrefix: (o: string, g: string) => `u/${o}/g/${g}/`,
      isVariantName: () => true,
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
  mailer.down = false
  delete process.env.FREE_EXPIRY_MODE
})

async function cron(query = '') {
  const { GET } = await import('@/app/api/cron/free-expiry/route')
  const res = await GET(
    new Request(`https://proiav.test/api/cron/free-expiry${query}`, { headers: { authorization: 'Bearer cron-test' } }) as never
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

function freeUser(name = 'Олена') {
  const email = `free-${Math.random().toString(36).slice(2, 10)}@test.local`
  const userId = signUp({ email })
  pg(`update public.profiles set display_name = ${q(name)} where user_id = ${q(userId)}`)
  return { userId, email }
}

/** A published gallery with `files` photos (in the bucket and in assets). */
function gallery(userId: string, opts: { files?: number; title?: string } = {}) {
  const slug = `g-${Math.random().toString(36).slice(2, 10)}`
  const id = pg(`insert into public.galleries (owner_id, slug, title, is_published)
                 values (${q(userId)}, ${q(slug)}, ${q(opts.title ?? 'Весілля')}, true) returning id`)
  for (let i = 0; i < (opts.files ?? 2); i++) {
    const key = `u/${userId}/g/${id}/o/p${i}.jpg`
    const thumb = `u/${userId}/g/${id}/v/thumb/p${i}.jpg`
    pg(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, variants)
        values (${q(id)}, ${q(userId)}, ${q(key)}, 'photo', 'image/jpeg', 1000000, ${q(JSON.stringify({ thumb }))}::jsonb)`)
    bucket.set(key, 1000000)
    bucket.set(thumb, 1000)
  }
  return { id, slug }
}
const col = (id: string, c: string) => pg(`select coalesce(${c}::text, '') from public.galleries where id = ${q(id)}`)
const setDeadline = (id: string, interval: string) =>
  pg(`update public.galleries set free_expires_at = now() + interval ${q(interval)} where id = ${q(id)}`)

describe('30 днів Free: БД, крон, листи, оплата', { skip }, () => {
  test('нова галерея на Free: free_expires_at = +30 днів; на платному — без строку', async () => {
    const { userId } = freeUser()
    session.userId = userId
    const { createGallery } = await import('@/lib/actions/galleries')
    const form = new FormData()
    form.set('title', 'Хрестини')
    await assert.rejects(createGallery('uk', form))
    const days = pg(`select round(extract(epoch from free_expires_at - now()) / 86400) from public.galleries where owner_id = ${q(userId)}`)
    assert.equal(days, '30')

    const paid = freeUser()
    pg(`update public.profiles set plan = 'basic', grace_until = null where user_id = ${q(paid.userId)}`)
    const g = gallery(paid.userId)
    assert.equal(col(g.id, 'free_expires_at'), '')
    session.userId = null
  })

  test('фотограф не може зняти строк своїм клієнтом (PATCH / INSERT)', async () => {
    const { userId } = freeUser()
    const g = gallery(userId)
    const before = col(g.id, 'free_expires_at')
    const client = userClient(url, userId)
    await client.from('galleries').update({ free_expires_at: null, title: 'Нова назва' }).eq('id', g.id)
    assert.equal(col(g.id, 'free_expires_at'), before)
    assert.equal(col(g.id, 'title'), 'Нова назва')
    const { data } = await client
      .from('galleries')
      .insert({ owner_id: userId, slug: `x-${Date.now()}`, title: 'x', free_expires_at: '2099-01-01T00:00:00Z' })
      .select('free_expires_at')
      .single()
    assert.ok(new Date(data!.free_expires_at).getTime() < Date.now() + 31 * DAY_MS)
  })

  test('за 7 днів — один лист на власника з усіма галереями; повторний запуск листа не шле', async () => {
    const { userId, email } = freeUser()
    const a = gallery(userId, { title: 'Весілля Анни' })
    const b = gallery(userId, { title: 'Лав-сторі' })
    const empty = gallery(userId, { files: 0, title: 'Порожня' })
    for (const g of [a, b, empty]) setDeadline(g.id, '6 days 12 hours')
    const first = await cron()
    assert.equal(first.status, 200)
    const mine = outbox.filter((m) => m.to === email)
    assert.equal(mine.length, 1)
    assert.match(mine[0].subject, /2 галереї закриваються через 7 днів/)
    assert.match(mine[0].text, /Весілля Анни/)
    assert.match(mine[0].text, /Лав-сторі/)
    assert.doesNotMatch(mine[0].text, /Порожня/)
    outbox.length = 0
    await cron()
    assert.equal(outbox.filter((m) => m.to === email).length, 0)
  })

  test('за 1 день — лист «завтра»', async () => {
    const { userId, email } = freeUser()
    const g = gallery(userId, { title: 'Випускний' })
    setDeadline(g.id, '6 days')
    await cron()
    setDeadline(g.id, '20 hours')
    outbox.length = 0
    await cron()
    const mine = outbox.filter((m) => m.to === email)
    assert.equal(mine.length, 1)
    assert.match(mine[0].subject, /«Випускний» закривається завтра/)
  })

  test('Brevo лежить → журнал не пишеться, наступного дня лист іде', async () => {
    const { userId, email } = freeUser()
    const g = gallery(userId)
    setDeadline(g.id, '5 days')
    mailer.down = true
    const res = await cron()
    assert.ok((res.body.emailFailures as number) >= 1)
    assert.equal(pg(`select count(*) from public.free_expiry_notices where gallery_id = ${q(g.id)}`), '0')
    mailer.down = false
    await cron()
    assert.equal(outbox.filter((m) => m.to === email).length, 1)
  })

  test('строк минув → закрита: клієнт бачить «закрито», вибір і завантаження закриті, фотограф бачить', async () => {
    const { userId } = freeUser()
    const g = gallery(userId)
    const assetId = pg(`select id from public.assets where gallery_id = ${q(g.id)} limit 1`)
    setDeadline(g.id, '-1 hour')
    const res = await cron()
    assert.ok((res.body.expired as number) >= 1)
    assert.notEqual(col(g.id, 'free_expired_at'), '')

    const anon = anonClient(url)
    assert.equal(((await anon.from('galleries').select('id').eq('slug', g.slug)).data ?? []).length, 0)
    assert.equal(((await anon.from('assets').select('id').eq('gallery_id', g.id)).data ?? []).length, 0)
    assert.equal((await anon.rpc('public_gallery_state', { p_slug: g.slug })).data, 'expired')
    const pick = await anon.rpc('set_selection', { p_slug: g.slug, p_asset: assetId, p_kind: 'favorite', p_selected: true, p_token: 'client-token-123456' })
    assert.ok(pick.error)

    const owner = userClient(url, userId)
    assert.equal(((await owner.from('galleries').select('id').eq('id', g.id)).data ?? []).length, 1)
    const { authorizeUpload } = await import('@/lib/uploads')
    const gate = await authorizeUpload(owner, userId, { galleryId: g.id, contentType: 'image/jpeg', sizeBytes: 10 })
    assert.deepEqual(gate, { ok: false, status: 403, error: 'gallery_free_expired' })
  })

  test('закрита 7 днів → файли видалено з бакета і БД, місце звільнено; у режимі notify — ні', async () => {
    const { userId } = freeUser()
    const g = gallery(userId, { files: 3 })
    pg(`update public.galleries set free_expires_at = now() - interval '8 days', free_expired_at = now() - interval '7 days 1 hour' where id = ${q(g.id)}`)
    process.env.FREE_EXPIRY_MODE = 'notify'
    const deferred = await cron()
    assert.ok((deferred.body.purgesDeferred as number) >= 1)
    assert.equal(pg(`select count(*) from public.assets where gallery_id = ${q(g.id)}`), '3')

    delete process.env.FREE_EXPIRY_MODE
    await cron()
    assert.equal(pg(`select count(*) from public.assets where gallery_id = ${q(g.id)}`), '0')
    assert.equal([...bucket.keys()].filter((k) => k.includes(g.id)).length, 0)
    assert.notEqual(col(g.id, 'free_purged_at'), '')
    assert.equal(pg(`select storage_used_bytes from public.profiles where user_id = ${q(userId)}`), '0')
    // The client still gets «закрито», not «не знайдено».
    assert.equal((await anonClient(url).rpc('public_gallery_state', { p_slug: g.slug })).data, 'expired')
  })

  test('dry-run нічого не пише і не шле', async () => {
    const { userId } = freeUser()
    const g = gallery(userId)
    setDeadline(g.id, '-1 hour')
    const res = await cron('?dry=1')
    assert.equal(res.body.mode, 'dry-run')
    assert.equal(col(g.id, 'free_expired_at'), '')
  })

  test('оплата «Базовий» (вебхук Monobank) знімає строк з усіх галерей, зокрема закритої', async () => {
    const { userId } = freeUser()
    const open = gallery(userId)
    const closed = gallery(userId)
    pg(`update public.galleries set free_expires_at = now() - interval '1 day', free_expired_at = now() where id = ${q(closed.id)}`)
    const { orderId } = pendingPayment({ userId, amount: 129 })
    assert.equal(await deliverWebhook({ orderId, status: 'paid', cardToken: 'card-1' }), 200)
    for (const g of [open, closed]) {
      assert.equal(col(g.id, 'free_expires_at'), '')
      assert.equal(col(g.id, 'free_expired_at'), '')
    }
    assert.equal((await anonClient(url).rpc('public_gallery_state', { p_slug: closed.slug })).data, 'open')
    const later = gallery(userId)
    assert.equal(col(later.id, 'free_expires_at'), '')
  })

  test('промо за імпорт (Базовий на місяць) теж знімає строк', () => {
    const { userId } = freeUser()
    const g = gallery(userId)
    pg(`update public.profiles set plan = 'basic', grace_until = now() + interval '44 days' where user_id = ${q(userId)}`)
    assert.equal(col(g.id, 'free_expires_at'), '')
  })

  test('0050: наявні Free-галереї отримують 30 днів від дати накатки, платні — ні', () => {
    const free = freeUser()
    const g = gallery(free.userId)
    const paid = freeUser()
    pg(`update public.profiles set plan = 'plus', grace_until = null where user_id = ${q(paid.userId)}`)
    const p = gallery(paid.userId)
    pg(`update public.galleries set free_expires_at = null where id in (${q(g.id)}, ${q(p.id)})`)
    pg(readFileSync(path.join(root, 'supabase/migrations/0050_free_gallery_expiry_backfill.sql'), 'utf8'))
    assert.equal(pg(`select round(extract(epoch from free_expires_at - now()) / 86400) from public.galleries where id = ${q(g.id)}`), '30')
    assert.equal(col(p.id, 'free_expires_at'), '')
  })
})

/**
 * Сповіщення застосунку фотографа (Web Push, міграція 0068):
 *   - відправка (lib/push/send.ts) з моком push-сервісу й бази в памʼяті:
 *     ключі VAPID, увімкнені типи, дедуплікація, мова пристрою, мертві
 *     підписки (410), відкат «вже надіслано», якщо ніхто не отримав;
 *   - справжнє шифрування web-push (aes128gcm + VAPID) без мережі;
 *   - події: ключі дедуплікації, «скоро закриється», «місце закінчується»,
 *     свої перегляди фотографа не рахуються;
 *   - маршрут /api/push/subscribe з моком Supabase: хто може, що пишеться,
 *     перенесення підписки з іншого акаунта, без міграції / без ключів;
 *   - стрічка «Останні події від клієнтів».
 */
import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, describe, mock, test } from 'node:test'
import webpush from 'web-push'
import { notifyOwner, type PushSender, type PushStore, type StoredSubscription } from '@/lib/push/send'
import {
  closingDeadline,
  notifyBooking,
  notifyClientPick,
  notifyFirstView,
  notifyGalleryExpiring,
  notifyStorageIfLow,
} from '@/lib/push/events'
import { parsePreferencesPatch, parseSubscription, type PushKind } from '@/lib/push/kinds'
import { buildRecentEvents, timeAgo } from '@/lib/app/events'
import { offlinePhotoKey } from '@/lib/app/offline-pack'
import { dashboardManifest } from '@/lib/app/manifest'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'

const ROOT = join(__dirname, '..', '..')
const VAPID = webpush.generateVAPIDKeys()
const vapid = { publicKey: VAPID.publicKey, privateKey: VAPID.privateKey, subject: 'mailto:test@proiav.space' }

/** In-memory push_preferences / push_subscriptions / push_deliveries. */
function memoryStore(init: { prefs?: Partial<Record<PushKind, boolean>>; subs?: StoredSubscription[]; missingTable?: boolean } = {}) {
  const delivered = new Set<string>()
  const subs = [...(init.subs ?? [])]
  const touched: string[] = []
  const store: PushStore = {
    async isEnabled(_owner, kind) {
      if (init.missingTable) return 'missing_table'
      return init.prefs?.[kind] !== false
    },
    async subscriptions() {
      return subs
    },
    async claim(owner, kind, key) {
      const id = `${owner}|${kind}|${key}`
      if (delivered.has(id)) return false
      delivered.add(id)
      return true
    },
    async release(owner, kind, key) {
      delivered.delete(`${owner}|${kind}|${key}`)
    },
    async removeSubscription(id) {
      const index = subs.findIndex((s) => s.id === id)
      if (index >= 0) subs.splice(index, 1)
    },
    async touchSubscription(id) {
      touched.push(id)
    },
  }
  return { store, delivered, subs, touched }
}

const sub = (id: string, locale = 'uk'): StoredSubscription => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'B'.repeat(87),
  auth: 'a'.repeat(22),
  locale,
})

/** Fake push service: records every request, answers with a status per endpoint. */
function fakeSender(statusFor: (endpoint: string) => number = () => 201) {
  const sent: { endpoint: string; payload: Record<string, string>; options: webpush.RequestOptions }[] = []
  const sender: PushSender = async (subscription, payload, options) => {
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), options })
    const statusCode = statusFor(subscription.endpoint)
    if (statusCode >= 400) throw Object.assign(new Error('push service'), { statusCode })
    return { statusCode }
  }
  return { sender, sent }
}

const message = { message: () => ({ title: 'T', body: 'B', path: '/dashboard' }) }

describe('відправка (notifyOwner)', () => {
  test('без ключів VAPID — нічого не надсилається й не падає', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid: null, store, sender })
    assert.deepEqual(result, { status: 'skipped', reason: 'not_configured' })
    assert.equal(sent.length, 0)
  })

  test('до міграції 0068 — тихо пропускає', async () => {
    const { store } = memoryStore({ subs: [sub('a')], missingTable: true })
    const { sender, sent } = fakeSender()
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store, sender })
    assert.deepEqual(result, { status: 'skipped', reason: 'migration' })
    assert.equal(sent.length, 0)
  })

  test('тип вимкнений фотографом — не надсилається; інші типи — так', async () => {
    const { store } = memoryStore({ subs: [sub('a')], prefs: { client_picks: false } })
    const { sender, sent } = fakeSender()
    const off = await notifyOwner({ ownerId: 'o', kind: 'client_picks', dedupeKey: 'k', ...message }, { vapid, store, sender })
    assert.deepEqual(off, { status: 'skipped', reason: 'disabled' })
    const on = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store, sender })
    assert.equal(on.status, 'sent')
    assert.equal(sent.length, 1)
  })

  test('на кожен пристрій — його мовою, з посиланням у кабінет цією мовою', async () => {
    const { store, touched } = memoryStore({ subs: [sub('a', 'uk'), sub('b', 'en'), sub('c', 'pl')] })
    const { sender, sent } = fakeSender()
    const result = await notifyBooking(
      { id: 'slot-1', owner_id: 'o', starts_at: '2026-11-14T11:00:00' },
      '  Олена  ',
      { vapid, store, sender }
    )
    assert.deepEqual(result, { status: 'sent', delivered: 3, removed: 0, failed: 0 })
    const byEndpoint = Object.fromEntries(sent.map((s) => [s.endpoint.split('/').pop(), s]))
    assert.deepEqual(byEndpoint.a.payload, {
      title: 'Нова заявка на зйомку',
      body: 'Олена · 14.11, 11:00',
      url: '/uk/dashboard/booking',
      tag: 'booking:slot:slot-1',
      kind: 'booking',
    })
    assert.equal(byEndpoint.b.payload.title, 'New booking request')
    assert.equal(byEndpoint.b.payload.url, '/en/dashboard/booking')
    // Every dashboard language has its own text (full translations).
    assert.equal(byEndpoint.c.payload.title, 'Nowe zapytanie o sesję')
    assert.equal(byEndpoint.c.payload.url, '/pl/dashboard/booking')
    assert.equal(byEndpoint.a.options.urgency, 'high')
    assert.equal(byEndpoint.a.options.TTL, 86400)
    assert.deepEqual(byEndpoint.a.options.vapidDetails, vapid)
    assert.deepEqual(touched.sort(), ['a', 'b', 'c'])
  })

  test('одна подія — одне сповіщення (дедуплікація)', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const input = { ownerId: 'o', kind: 'first_view' as const, dedupeKey: 'gallery:g1', ...message }
    assert.equal((await notifyOwner(input, { vapid, store, sender })).status, 'sent')
    assert.deepEqual(await notifyOwner(input, { vapid, store, sender }), { status: 'skipped', reason: 'duplicate' })
    assert.equal(sent.length, 1)
  })

  test('підписка, яку браузер прибрав (410/404), видаляється', async () => {
    const { store, subs } = memoryStore({ subs: [sub('alive'), sub('gone'), sub('missing')] })
    const { sender } = fakeSender((endpoint) => (endpoint.endsWith('gone') ? 410 : endpoint.endsWith('missing') ? 404 : 201))
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store, sender })
    assert.deepEqual(result, { status: 'sent', delivered: 1, removed: 2, failed: 0 })
    assert.deepEqual(subs.map((s) => s.id), ['alive'])
  })

  test('ніхто не отримав (збій push-сервісу) — подію можна надіслати пізніше', async () => {
    const { store, delivered } = memoryStore({ subs: [sub('a')] })
    const { sender } = fakeSender(() => 500)
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store, sender })
    assert.deepEqual(result, { status: 'sent', delivered: 0, removed: 0, failed: 1 })
    assert.equal(delivered.size, 0)
  })

  test('немає підписок — нічого не записується в журнал', async () => {
    const { store, delivered } = memoryStore({ subs: [] })
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store })
    assert.deepEqual(result, { status: 'skipped', reason: 'no_subscriptions' })
    assert.equal(delivered.size, 0)
  })

  test('збій бази не ламає того, хто викликав', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    store.subscriptions = async () => {
      throw new Error('db down')
    }
    const errors = mock.method(console, 'error', () => {})
    const result = await notifyOwner({ ownerId: 'o', kind: 'booking', dedupeKey: 'k', ...message }, { vapid, store })
    errors.mock.restore()
    assert.equal(result.status, 'sent')
  })
})

describe('справжній web-push: шифрування й VAPID (без мережі)', () => {
  test('запит до push-сервісу: aes128gcm, підпис VAPID, TTL', () => {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
    }
    const details = webpush.generateRequestDetails(subscription, JSON.stringify({ title: 'T' }), {
      vapidDetails: vapid,
      TTL: 86400,
    })
    assert.equal(details.method, 'POST')
    assert.equal(details.endpoint, subscription.endpoint)
    assert.equal(details.headers['Content-Encoding'], 'aes128gcm')
    assert.equal(details.headers.TTL, 86400)
    assert.match(String(details.headers.Authorization), /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
    assert.ok(String(details.headers.Authorization).includes(VAPID.publicKey))
    assert.ok(details.body && details.body.length > 0)
    // The payload is encrypted, never sent in clear text.
    assert.ok(!Buffer.from(details.body!).toString('utf8').includes('"title"'))
  })
})

describe('події', () => {
  const gallery = { id: 'g1', owner_id: 'owner', title: 'Весілля' }
  /** Admin client that only answers the gallery lookup. */
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: gallery }) }) }),
    }),
  } as never

  test('вибір фото: одне сповіщення на галерею, тип позначки й годину', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const at = new Date('2026-11-07T10:15:00Z') // 12:15 in Kyiv
    await notifyClientPick('g1', 'favorite', { admin, vapid, store, sender, now: at })
    await notifyClientPick('g1', 'favorite', { admin, vapid, store, sender, now: new Date('2026-11-07T10:55:00Z') })
    await notifyClientPick('g1', 'retouch', { admin, vapid, store, sender, now: at })
    await notifyClientPick('g1', 'favorite', { admin, vapid, store, sender, now: new Date('2026-11-07T11:01:00Z') })
    assert.deepEqual(
      sent.map((s) => [s.payload.title, s.payload.tag]),
      [
        ['Клієнт обрав фото', 'client_picks:g1:favorite:2026-11-07T12'],
        ['Позначки на ретуш', 'client_picks:g1:retouch:2026-11-07T12'],
        ['Клієнт обрав фото', 'client_picks:g1:favorite:2026-11-07T13'],
      ]
    )
    assert.equal(sent[1].payload.body, '«Весілля»: клієнт позначив фото для ретуші')
    assert.equal(sent[0].payload.url, '/uk/dashboard/galleries/g1')
  })

  test('перший перегляд: власний перегляд фотографа не рахується, клієнтський — один раз', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const own = await notifyFirstView('g1', async () => 'owner', { admin, vapid, store, sender })
    assert.equal(own.status, 'skipped')
    assert.equal(sent.length, 0)
    const client = await notifyFirstView('g1', async () => null, { admin, vapid, store, sender })
    assert.equal(client.status, 'sent')
    let lookups = 0
    const again = await notifyFirstView(
      'g1',
      async () => {
        lookups += 1
        return null
      },
      { admin, vapid, store, sender }
    )
    assert.deepEqual(again, { status: 'skipped', reason: 'duplicate' })
    assert.equal(lookups, 0, 'auth lookup must not run once the first view is claimed')
    assert.equal(sent[0].payload.body, 'Клієнт уперше відкрив «Весілля»')
  })

  test('«скоро закриється»: найближчий із двох строків у межах 3 днів', () => {
    const now = new Date('2026-11-07T10:00:00Z')
    assert.equal(
      closingDeadline({ expires_at: '2026-11-09T10:00:00+00:00', free_expires_at: '2026-11-08T10:00:00+00:00', free_expired_at: null }, now),
      '2026-11-08T10:00:00+00:00'
    )
    assert.equal(closingDeadline({ expires_at: '2026-11-20T10:00:00+00:00', free_expires_at: null, free_expired_at: null }, now), null)
    assert.equal(closingDeadline({ expires_at: '2026-11-06T10:00:00+00:00', free_expires_at: null, free_expired_at: null }, now), null)
    // Already closed by the Free lifecycle: no reminder about that deadline.
    assert.equal(
      closingDeadline({ expires_at: null, free_expires_at: '2026-11-08T10:00:00+00:00', free_expired_at: '2026-11-07T09:00:00+00:00' }, now),
      null
    )
  })

  test('«скоро закриється»: текст із днями, одне на строк', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const now = new Date('2026-11-07T10:00:00Z')
    const g = { ...gallery, closes_at: '2026-11-09T08:00:00+00:00' }
    await notifyGalleryExpiring(g, { vapid, store, sender, now })
    await notifyGalleryExpiring(g, { vapid, store, sender, now: new Date('2026-11-08T10:00:00Z') })
    assert.equal(sent.length, 1)
    assert.equal(sent[0].payload.body, '«Весілля» закриється для клієнтів через 2 дні')
  })

  test('«місце закінчується»: від 90% ефективного ліміту, не частіше разу на місяць', async () => {
    const { store } = memoryStore({ subs: [sub('a')] })
    const { sender, sent } = fakeSender()
    const GB = 1024 ** 3
    const profile = { user_id: 'owner', plan: 'basic', grace_until: null, storage_limit_bytes: 1000 * GB, storage_used_bytes: 0 }
    const { planStorageBytes, effectiveGalleryPlan } = await import('@/lib/plans')
    const limit = Math.min(profile.storage_limit_bytes, planStorageBytes(effectiveGalleryPlan('basic', null)))
    assert.equal(await notifyStorageIfLow({ ...profile, storage_used_bytes: Math.floor(limit * 0.89) }, { vapid, store, sender }), null)
    const now = new Date('2026-11-07T10:00:00Z')
    const low = { ...profile, storage_used_bytes: Math.floor(limit * 0.95) }
    assert.equal((await notifyStorageIfLow(low, { vapid, store, sender, now }))?.status, 'sent')
    assert.equal((await notifyStorageIfLow(low, { vapid, store, sender, now }))?.status, 'skipped')
    assert.equal(sent.length, 1)
    assert.match(sent[0].payload.body, /^Зайнято 95%: /)
    assert.equal(sent[0].payload.url, '/uk/dashboard/billing')
  })
})

describe('вхідні дані', () => {
  test('підписка браузера: лише https endpoint і ключі в base64url', () => {
    const good = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }
    assert.deepEqual(parseSubscription(good), good)
    assert.equal(parseSubscription({ ...good, endpoint: 'http://evil.example/abc123456' }), null)
    assert.equal(parseSubscription({ ...good, keys: { p256dh: '<script>', auth: 'a'.repeat(22) } }), null)
    assert.equal(parseSubscription({ endpoint: good.endpoint }), null)
    assert.equal(parseSubscription(null), null)
  })

  test('налаштування: лише відомі типи й лише true/false', () => {
    assert.deepEqual(parsePreferencesPatch({ booking: false, owner_id: 'x', storage_low: 'yes' }), { booking: false })
    assert.equal(parsePreferencesPatch({ owner_id: 'x' }), null)
  })
})

describe('/api/push/subscribe (мок Supabase)', () => {
  type Call = { client: 'user' | 'admin'; op: string; args: unknown[] }
  let calls: Call[] = []
  let currentUser: { id: string } | null = { id: 'user-1' }
  let upsertError: { code?: string; message: string } | null = null

  function chain(client: 'user' | 'admin') {
    const builder: Record<string, unknown> = {}
    for (const op of ['from', 'delete', 'eq', 'neq', 'upsert', 'select']) {
      builder[op] = (...args: unknown[]) => {
        calls.push({ client, op, args })
        return builder
      }
    }
    builder.then = (resolve: (value: unknown) => void) =>
      resolve({ error: client === 'user' && calls.some((c) => c.op === 'upsert') ? upsertError : null })
    return builder
  }

  let POST: (request: Request) => Promise<Response>
  let DELETE: (request: Request) => Promise<Response>
  before(async () => {
    process.env.VAPID_PUBLIC_KEY = VAPID.publicKey
    process.env.VAPID_PRIVATE_KEY = VAPID.privateKey
    mock.module(pathToFileURL(join(ROOT, 'src/lib/supabase/server.ts')).href, {
      namedExports: {
        createSupabaseServerClient: () => ({
          auth: { getUser: async () => ({ data: { user: currentUser } }) },
          from: (table: string) => (chain('user').from as (t: string) => unknown)(table),
        }),
      },
    })
    mock.module(pathToFileURL(join(ROOT, 'src/lib/supabase/admin.ts')).href, {
      namedExports: {
        createSupabaseAdminClient: () => ({ from: (table: string) => (chain('admin').from as (t: string) => unknown)(table) }),
      },
    })
    const route = await import('@/app/api/push/subscribe/route')
    POST = route.POST as never
    DELETE = route.DELETE as never
  })
  after(() => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  })

  const body = {
    subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/dev-1', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } },
    locale: 'en',
  }
  const req = (method: string, payload: unknown) =>
    new Request('http://localhost/api/push/subscribe', {
      method,
      headers: { 'content-type': 'application/json', 'user-agent': 'iPhone' },
      body: JSON.stringify(payload),
    })

  test('зберігає підписку власника (RLS-клієнт) і забирає її в іншого акаунта (service role)', async () => {
    calls = []
    currentUser = { id: 'user-1' }
    upsertError = null
    const response = await POST(req('POST', body))
    assert.equal(response.status, 200)
    const admin = calls.filter((c) => c.client === 'admin').map((c) => [c.op, ...c.args])
    assert.deepEqual(admin, [
      ['from', 'push_subscriptions'],
      ['delete'],
      ['eq', 'endpoint', body.subscription.endpoint],
      ['neq', 'owner_id', 'user-1'],
    ])
    const upsert = calls.find((c) => c.client === 'user' && c.op === 'upsert')!
    assert.deepEqual(upsert.args, [
      {
        owner_id: 'user-1',
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        locale: 'en',
        user_agent: 'iPhone',
      },
      { onConflict: 'endpoint' },
    ])
  })

  test('без входу — 401, погане тіло — 400', async () => {
    currentUser = null
    assert.equal((await POST(req('POST', body))).status, 401)
    currentUser = { id: 'user-1' }
    assert.equal((await POST(req('POST', { subscription: { endpoint: 'nope' } }))).status, 400)
  })

  test('до міграції — 503 migration_required', async () => {
    calls = []
    upsertError = { code: 'PGRST205', message: 'Could not find the table in the schema cache' }
    const response = await POST(req('POST', body))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'migration_required' })
    upsertError = null
  })

  test('без ключів VAPID — 503 not_configured, у базу нічого не пишеться', async () => {
    calls = []
    const key = process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_PRIVATE_KEY
    const response = await POST(req('POST', body))
    process.env.VAPID_PRIVATE_KEY = key
    assert.equal(response.status, 503)
    assert.equal(calls.length, 0)
  })

  test('DELETE прибирає лише свою підписку', async () => {
    calls = []
    const response = await DELETE(req('DELETE', { endpoint: body.subscription.endpoint }))
    assert.equal(response.status, 200)
    assert.deepEqual(
      calls.map((c) => [c.client, c.op, ...c.args]),
      [
        ['user', 'from', 'push_subscriptions'],
        ['user', 'delete'],
        ['user', 'eq', 'owner_id', 'user-1'],
        ['user', 'eq', 'endpoint', body.subscription.endpoint],
      ]
    )
  })
})

describe('кабінет на телефоні', () => {
  test('«Останні події від клієнтів»: групування, лише свої галереї, новіші вгорі', () => {
    const titles = new Map([['g1', 'Весілля']])
    const events = buildRecentEvents(
      [
        { gallery_id: 'g1', asset_id: 'a1', kind: 'favorite', created_at: '2026-11-07T10:00:00Z' },
        { gallery_id: 'g1', asset_id: 'a2', kind: 'favorite', created_at: '2026-11-07T10:05:00Z' },
        { gallery_id: 'g1', asset_id: 'a2', kind: 'favorite', created_at: '2026-11-07T10:05:00Z' },
        { gallery_id: 'g1', asset_id: 'a1', kind: 'retouch', created_at: '2026-11-07T09:00:00Z' },
        { gallery_id: 'foreign', asset_id: 'x', kind: 'favorite', created_at: '2026-11-07T11:00:00Z' },
      ],
      titles,
      [{ id: 's1', client_name: 'Олена', starts_at: '2026-11-14T11:00:00', booked_at: '2026-11-07T10:30:00Z' }]
    )
    assert.deepEqual(
      events.map((e) => [e.kind, e.count ?? e.clientName, e.at]),
      [
        ['booking', 'Олена', '2026-11-07T10:30:00Z'],
        ['favorite', 2, '2026-11-07T10:05:00Z'],
        ['retouch', 1, '2026-11-07T09:00:00Z'],
      ]
    )
  })

  test('множина в подіях і сповіщеннях: 1 photo / 2 photos, 1 dzień / 5 dni', async () => {
    const { formatMessage } = await import('@/lib/i18n/format')
    const { pl } = await import('@/lib/i18n/dictionaries/pl')
    assert.equal(formatMessage(en.app.offlinePhotos, { n: 1 }, 'en'), '1 photo')
    assert.equal(formatMessage(en.app.offlinePhotos, { n: 12 }, 'en'), '12 photos')
    assert.equal(formatMessage(pl.app!.offlinePhotos!, { n: 22 }, 'pl'), '22 zdjęcia')
    assert.equal(formatMessage(pl.app!.offlinePhotos!, { n: 25 }, 'pl'), '25 zdjęć')
    assert.equal(formatMessage(uk.app.pushExpiringBody, { gallery: 'Г', n: 1 }, 'uk'), '«Г» закриється для клієнтів через 1 день')
    assert.equal(formatMessage(uk.app.pushExpiringBody, { gallery: 'Г', n: 5 }, 'uk'), '«Г» закриється для клієнтів через 5 днів')
  })

  test('час подій: щойно / хв / год / дн.', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    assert.equal(timeAgo('2026-11-07T11:59:40Z', now, uk.app), 'щойно')
    assert.equal(timeAgo('2026-11-07T11:57:00Z', now, uk.app), '3 хв тому')
    assert.equal(timeAgo('2026-11-07T07:00:00Z', now, uk.app), '5 год тому')
    assert.equal(timeAgo('2026-11-05T12:00:00Z', now, en.app, 'en'), '2 d ago')
  })

  test('офлайн-портфоліо бере лише мобільне прев’ю (або прев’ю), не оригінал', () => {
    assert.equal(offlinePhotoKey({ mobile: 'm', preview: 'p', thumb: 't' }), 'm')
    assert.equal(offlinePhotoKey({ preview: 'p', thumb: 't' }), 'p')
    assert.equal(offlinePhotoKey({ thumb: 't' }), null)
    assert.equal(offlinePhotoKey(null), null)
  })

  test('manifest: start_url /dashboard, standalone, іконки 192/512/maskable', () => {
    const m = dashboardManifest('uk', uk.app)
    assert.equal(m.start_url, '/dashboard')
    assert.equal(m.name, 'проЯв')
    assert.equal(m.display, 'standalone')
    assert.deepEqual(m.icons.map((i) => `${i.sizes}:${i.purpose}`), ['192x192:any', '512x512:any', '512x512:maskable', 'any:any'])
    assert.equal(dashboardManifest('de', en.app).shortcuts[1].url, '/dashboard/offline')
    assert.equal(dashboardManifest('uk', uk.app).shortcuts[0].name, 'Нова галерея')
  })

  test('нові рядки є в uk і en (інші 7 мов — i18n-parity.test.ts)', () => {
    assert.deepEqual(Object.keys(uk.app).sort(), Object.keys(en.app).sort())
    for (const [key, value] of Object.entries(en.app)) assert.ok(value.trim().length > 0, key)
  })
})

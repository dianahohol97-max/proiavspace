/**
 * Обране клієнта для Lightroom + лист «Ваші фото готові» (0066):
 * формат рядка для Lightroom Classic (Filename → Contains, «або»), дублікати,
 * порожній набір, назви з пробілами/комами, .txt/.csv; оригінальна назва
 * файлу зберігається при завантаженні (і завантаження не падає без 0066);
 * лист іде один раз (і при двох одночасних збереженнях), «Надіслати ще раз»;
 * міграція 0066 на локальному Postgres (без бінарників — пропуск).
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  pickLabels,
  assetOriginalName,
  buildClientPicks,
  lightroomFilterLine,
  picksCsv,
  picksTxt,
  stripExtension,
  type PickAsset,
} from '@/lib/gallery/client-picks'
import { uk as ukDict } from '@/lib/i18n/dictionaries/uk'
import { en as enDict } from '@/lib/i18n/dictionaries/en'
import {
  SEND_AGAIN_GAP_MS,
  parseClientEmail,
  readyEmailMessage,
  sendReadyEmailAgain,
  sendReadyEmailOnce,
  type ReadyEmailDeps,
  type ReadyEmailGallery,
} from '@/lib/gallery/ready-email'
import type { EmailInput } from '@/lib/email'
import { cleanSourceFileName, registerAsset } from '@/lib/uploads'
import { galleryPrefix } from '@/lib/storage'
import { GB, db, putObject, resetBackend, seedAccount, userClient } from './helpers/fake-backend'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

const PICK_LABELS_UK = pickLabels(ukDict.designer)
const PICK_LABELS_EN = pickLabels(enDict.designer)

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const asset = (id: string, name: string, extra: Partial<PickAsset> = {}): PickAsset => ({
  id,
  r2_key: `u/o/g/x/o/00000000-0000-0000-0000-000000000000-${name.replace(/[^\w.-]+/g, '_')}`,
  source_file_name: name,
  ...extra,
})
const fav = (asset_id: string, client = 'c1') => ({ asset_id, kind: 'favorite', client_token: client })
const ret = (asset_id: string, client = 'c1') => ({ asset_id, kind: 'retouch', client_token: client })

describe('рядок для Lightroom Classic (Library → Text → Filename → Contains)', () => {
  test('назви без розширення через кому, без пробілів, у порядку галереї', () => {
    const assets = [asset('a', 'IMG_0012.jpg'), asset('b', 'DSC_0101.JPG'), asset('c', 'IMG_0015.jpeg')]
    const picks = buildClientPicks(assets, [fav('c'), fav('a'), ret('b')])
    const line = lightroomFilterLine(picks)
    assert.equal(line.text, 'IMG_0012,DSC_0101,IMG_0015')
    assert.equal(line.count, 3)
    assert.deepEqual(line.skipped, [])
    assert.doesNotMatch(line.text, /\s/)
    assert.doesNotMatch(line.text, /\.(jpe?g|png)/i)
  })

  test('розширення: лише останнє, крапки в назві лишаються; без розширення — як є', () => {
    assert.equal(stripExtension('IMG_0012.jpg'), 'IMG_0012')
    assert.equal(stripExtension('photo.final.JPG'), 'photo.final')
    assert.equal(stripExtension('IMG_0012'), 'IMG_0012')
    assert.equal(stripExtension('IMG_0012.CR3'), 'IMG_0012')
    assert.equal(stripExtension('Весілля-001.heic'), 'Весілля-001')
  })

  test('дублікати: та сама назва двічі, різний регістр, той самий кадр у JPG і PNG → один раз', () => {
    const assets = [
      asset('a', 'IMG_0001.jpg'),
      asset('b', 'img_0001.JPG'),
      asset('c', 'IMG_0001.png'),
      asset('d', 'IMG_0002.jpg'),
    ]
    const selections = [fav('a'), fav('a', 'c2'), ret('a'), fav('b'), fav('c'), ret('d')]
    const line = lightroomFilterLine(buildClientPicks(assets, selections))
    assert.equal(line.text, 'IMG_0001,IMG_0002')
    assert.equal(line.count, 2)
  })

  test('порожній набір → порожній рядок, 0 назв; CSV лише із заголовком, TXT порожній', () => {
    const picks = buildClientPicks([asset('a', 'IMG_1.jpg')], [])
    assert.deepEqual(picks, [])
    assert.deepEqual(lightroomFilterLine(picks), { text: '', count: 0, skipped: [] })
    assert.equal(picksTxt(picks, PICK_LABELS_UK), '')
    assert.equal(picksCsv(picks, PICK_LABELS_UK), '﻿Файл,Позначка,Коментар\r\n')
    assert.deepEqual(lightroomFilterLine([]), { text: '', count: 0, skipped: [] })
  })

  test('назви з пробілом чи комою не йдуть у рядок (Lightroom розбив би їх), а показуються окремо', () => {
    const assets = [asset('a', 'Весілля 001.jpg'), asset('b', 'IMG_7.jpg'), asset('c', 'a,b.jpg')]
    const line = lightroomFilterLine(buildClientPicks(assets, [fav('a'), fav('b'), fav('c')]))
    assert.equal(line.text, 'IMG_7')
    assert.deepEqual(line.skipped, ['Весілля 001.jpg', 'a,b.jpg'])
  })

  test('кирилиця без пробілів іде в рядок як є', () => {
    const line = lightroomFilterLine([{ name: 'Весілля_001.jpg' }, { name: 'Олена-02.JPG' }])
    assert.equal(line.text, 'Весілля_001,Олена-02')
  })
})

describe('обране: що потрапляє у список', () => {
  test('лише сердечка й ретуш; кілька клієнтів рахуються окремо, один клієнт — раз', () => {
    const assets = [asset('a', 'A.jpg'), asset('b', 'B.jpg'), asset('c', 'C.jpg')]
    const picks = buildClientPicks(assets, [
      fav('a', 'x'),
      fav('a', 'y'),
      fav('a', 'y'),
      ret('a', 'x'),
      ret('b', 'x'),
      { asset_id: 'c', kind: 'something', client_token: 'x' },
    ])
    assert.deepEqual(
      picks.map((p) => [p.name, p.favorites, p.retouch]),
      [
        ['A.jpg', 2, 1],
        ['B.jpg', 0, 1],
      ]
    )
  })

  test('назва: source_file_name (0066) → original_name (zip) → з ключа сховища без uuid-префікса', () => {
    const key = 'u/1/g/2/o/3f2b8a1c-1111-4222-8333-444455556666-IMG_0042.jpg'
    assert.equal(assetOriginalName({ id: 'x', r2_key: key, source_file_name: 'IMG 0042.jpg' }), 'IMG 0042.jpg')
    assert.equal(assetOriginalName({ id: 'x', r2_key: key, original_name: 'Z.jpg' }), 'Z.jpg')
    assert.equal(assetOriginalName({ id: 'x', r2_key: key, source_file_name: null }), 'IMG_0042.jpg')
    assert.equal(assetOriginalName({ id: 'x', r2_key: key, source_file_name: '  ' }), 'IMG_0042.jpg')
  })

  test('TXT і CSV: назва з розширенням, позначка, коментар; CSV екранує коми й лапки, має BOM', () => {
    const picks = [
      { assetId: 'a', name: 'IMG_1.jpg', favorites: 1, retouch: 0, comments: [] },
      { assetId: 'b', name: 'IMG_2.jpg', favorites: 2, retouch: 1, comments: ['світліше, будь ласка', 'прибрати "пляму"'] },
      { assetId: 'c', name: 'a,b.jpg', favorites: 0, retouch: 1, comments: [] },
    ]
    assert.equal(
      picksTxt(picks, PICK_LABELS_UK),
      'IMG_1.jpg — сердечко\nIMG_2.jpg — сердечко ×2 + ретуш — світліше, будь ласка | прибрати "пляму"\na,b.jpg — ретуш\n'
    )
    const csv = picksCsv(picks, PICK_LABELS_UK)
    assert.ok(csv.startsWith('﻿'))
    assert.deepEqual(csv.slice(1).split('\r\n'), [
      'Файл,Позначка,Коментар',
      'IMG_1.jpg,сердечко,',
      'IMG_2.jpg,сердечко ×2 + ретуш,"світліше, будь ласка | прибрати ""пляму"""',
      '"a,b.jpg",ретуш,',
      '',
    ])
    assert.match(picksCsv(picks, PICK_LABELS_EN), /^﻿File,Mark,Comment\r\nIMG_1\.jpg,heart,/)
  })

  test('кабінет: блок обраного показує ретуш теж і бере назви з client-picks', () => {
    const page = source('src/app/[locale]/dashboard/galleries/[id]/page.tsx')
    assert.match(page, /buildClientPicks\(assets \?\? \[\], selections \?\? \[\]\)/)
    assert.match(page, /lightroomFilterLine\(picks\)/)
    assert.match(page, /<ClientPicksExport/)
    assert.doesNotMatch(page, /assetFileName/)
  })
})

describe('оригінальна назва файлу при завантаженні (assets.source_file_name)', () => {
  const client = () => userClient() as unknown as SupabaseClient
  beforeEach(resetBackend)

  test('назва з диска зберігається дослівно, навіть коли в ключі сховища вона санітизована', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-DSC_0012_1_.jpg`
    putObject(key, 1000)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      sourceFileName: 'DSC 0012 (1).jpg',
    })
    assert.equal(result.ok, true)
    assert.equal(db.assets[0].source_file_name, 'DSC 0012 (1).jpg')
  })

  test('без назви (старий клієнт) — рядок без поля, як раніше', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-a.jpg`
    putObject(key, 1000)
    await registerAsset(client(), userId, { galleryId, key, contentType: 'image/jpeg', sizeBytes: 1000 })
    assert.equal('source_file_name' in db.assets[0], false)
  })

  test('0066 ще не накочена (PGRST204) → asset реєструється без назви, завантаження не падає', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-a.jpg`
    putObject(key, 1000)
    const fakeFetch = globalThis.fetch
    let attempts = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(init?.body ?? '').includes('source_file_name')) {
        attempts++
        return new Response(
          JSON.stringify({ code: 'PGRST204', message: "Could not find the 'source_file_name' column of 'assets' in the schema cache" }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      }
      return fakeFetch(input, init)
    }) as typeof fetch
    try {
      const result = await registerAsset(client(), userId, {
        galleryId,
        key,
        contentType: 'image/jpeg',
        sizeBytes: 1000,
        sourceFileName: 'a.jpg',
      })
      assert.equal(result.ok, true)
      assert.equal(attempts, 1)
      assert.equal(db.assets.length, 1)
      assert.equal('source_file_name' in db.assets[0], false)
    } finally {
      globalThis.fetch = fakeFetch
    }
  })

  test('назва чиститься: без тек, без керівних символів, NFC, не довше 255', () => {
    assert.equal(cleanSourceFileName('folder/sub\\IMG_1.jpg'), 'IMG_1.jpg')
    assert.equal(cleanSourceFileName('IMG\u0000_1.jpg'), 'IMG_1.jpg')
    assert.equal(cleanSourceFileName('Й.jpg'.normalize('NFD')), 'Й.jpg')
    assert.equal(cleanSourceFileName('   '), null)
    assert.equal(cleanSourceFileName(undefined), null)
    assert.equal(Array.from(cleanSourceFileName('я'.repeat(400))!).length, 255)
  })

  test('браузер надсилає File.name в обох шляхах завантаження (PUT і multipart)', () => {
    const client = source('src/lib/upload/client.ts')
    assert.equal(client.match(/sourceFileName: file\.name/g)?.length, 2)
  })
})

// ---------------------------------------------------------------------------

function fakeReadyStore(initial: Partial<ReadyEmailGallery> = {}, opts: { sendOk?: boolean } = {}) {
  const gallery: ReadyEmailGallery = {
    id: 'g1',
    title: 'Весілля Олени й Тараса',
    slug: 'diana-vesillia-abc123',
    is_published: true,
    has_password: false,
    delivery_status: 'ready',
    client_email: 'olena@example.com',
    ready_email_sent_at: null,
    ...initial,
  }
  const sent: EmailInput[] = []
  let clock = new Date('2026-11-07T12:00:00Z')
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2))
  const deps: ReadyEmailDeps = {
    appUrl: 'https://proiav.space',
    photographer: { name: 'Діана Гоголь', email: 'diana@example.com' },
    now: () => clock,
    async load(id, owner) {
      await tick()
      return id === gallery.id && owner === 'owner' ? structuredClone(gallery) : null
    },
    async claim(id, expected, at) {
      await tick()
      // Compare-and-set in one step, like the UPDATE … WHERE in Postgres.
      if (id !== gallery.id || gallery.ready_email_sent_at !== expected) return false
      gallery.ready_email_sent_at = at
      return true
    },
    async release(id, at, previous) {
      await tick()
      if (gallery.ready_email_sent_at === at) gallery.ready_email_sent_at = previous
    },
    async send(input) {
      await tick()
      sent.push(input)
      return opts.sendOk ?? true
    },
  }
  return {
    deps,
    gallery,
    sent,
    advance(ms: number) {
      clock = new Date(clock.getTime() + ms)
    },
    setSendOk(ok: boolean) {
      opts.sendOk = ok
    },
  }
}

describe('лист «Ваші фото готові»: автоматично — рівно один раз', () => {
  test('перше «Готово» з адресою → лист; повторне збереження «Готово» → більше не шле', async () => {
    const s = fakeReadyStore()
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'sent')
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'already_sent')
    // «Готово» → «Обробка» → «Готово» знову: лист уже пішов.
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'already_sent')
    assert.equal(s.sent.length, 1)
    assert.equal(s.gallery.ready_email_sent_at, '2026-11-07T12:00:00.000Z')
  })

  test('два одночасні збереження (дві вкладки, подвійний клік) → один лист', async () => {
    const s = fakeReadyStore()
    const results = await Promise.all([
      sendReadyEmailOnce(s.deps, 'g1', 'owner'),
      sendReadyEmailOnce(s.deps, 'g1', 'owner'),
      sendReadyEmailOnce(s.deps, 'g1', 'owner'),
    ])
    assert.equal(results.filter((r) => r === 'sent').length, 1)
    assert.equal(s.sent.length, 1)
  })

  test('Brevo не прийняв → позначку знято, наступна спроба надсилає', async () => {
    const s = fakeReadyStore({}, { sendOk: false })
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'send_failed')
    assert.equal(s.gallery.ready_email_sent_at, null)
    s.setSendOk(true)
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'sent')
    assert.equal(s.sent.length, 2)
  })

  test('не шле: без адреси, статус не «Готово», галерея не опублікована, чужа галерея', async () => {
    for (const [patch, expected] of [
      [{ client_email: null }, 'no_email'],
      [{ delivery_status: 'editing' }, 'not_ready'],
      [{ delivery_status: null }, 'not_ready'],
      [{ is_published: false }, 'not_published'],
    ] as const) {
      const s = fakeReadyStore(patch)
      assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), expected)
      assert.equal(s.sent.length, 0)
      assert.equal(s.gallery.ready_email_sent_at, null)
    }
    const s = fakeReadyStore()
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'someone-else'), 'not_found')
    assert.equal(s.sent.length, 0)
  })

  test('лист: тема, посилання на галерею, відповідь іде фотографу, рядок про пароль', async () => {
    const s = fakeReadyStore({ has_password: true })
    await sendReadyEmailOnce(s.deps, 'g1', 'owner')
    const letter = s.sent[0]
    assert.equal(letter.to, 'olena@example.com')
    assert.equal(letter.subject, 'Ваші фото готові — Весілля Олени й Тараса')
    assert.equal(letter.replyTo, 'diana@example.com')
    assert.match(letter.text, /https:\/\/proiav\.space\/uk\/g\/diana-vesillia-abc123/)
    assert.match(letter.text, /Фотограф: Діана Гоголь/)
    assert.match(letter.text, /паролем/)
    assert.match(letter.html ?? '', /href="https:\/\/proiav\.space\/uk\/g\/diana-vesillia-abc123"/)
    const plain = readyEmailMessage({ galleryTitle: 'T', url: 'https://x/uk/g/s', photographerName: null, hasPassword: false })
    assert.doesNotMatch(plain.text, /паролем|Фотограф:/)
  })

  test('назва галереї з HTML у листі екранується', () => {
    const m = readyEmailMessage({ galleryTitle: '<b>x</b>', url: 'https://x/uk/g/s', photographerName: null, hasPassword: false })
    assert.doesNotMatch(m.html, /<b>x<\/b>/)
    assert.match(m.html, /&lt;b&gt;x&lt;\/b&gt;/)
  })
})

describe('«Надіслати ще раз»', () => {
  test('після автоматичного листа — ще раз можна, але не двічі за хвилину', async () => {
    const s = fakeReadyStore()
    await sendReadyEmailOnce(s.deps, 'g1', 'owner')
    assert.equal(await sendReadyEmailAgain(s.deps, 'g1', 'owner'), 'too_soon')
    s.advance(SEND_AGAIN_GAP_MS)
    assert.equal(await sendReadyEmailAgain(s.deps, 'g1', 'owner'), 'sent')
    assert.equal(s.sent.length, 2)
    assert.equal(s.gallery.ready_email_sent_at, '2026-11-07T12:01:00.000Z')
    // Ручне надсилання не відкриває шлях автоматичному.
    assert.equal(await sendReadyEmailOnce(s.deps, 'g1', 'owner'), 'already_sent')
  })

  test('подвійний клік «Надіслати ще раз» → один лист', async () => {
    const s = fakeReadyStore({ ready_email_sent_at: '2026-11-01T10:00:00.000Z' })
    const results = await Promise.all([sendReadyEmailAgain(s.deps, 'g1', 'owner'), sendReadyEmailAgain(s.deps, 'g1', 'owner')])
    assert.deepEqual(results.sort(), ['sent', 'too_soon'])
    assert.equal(s.sent.length, 1)
  })

  test('невдала ручна відправка повертає попередню дату', async () => {
    const s = fakeReadyStore({ ready_email_sent_at: '2026-11-01T10:00:00.000Z' }, { sendOk: false })
    assert.equal(await sendReadyEmailAgain(s.deps, 'g1', 'owner'), 'send_failed')
    assert.equal(s.gallery.ready_email_sent_at, '2026-11-01T10:00:00.000Z')
  })

  test('ручне надсилання теж лише для опублікованої «Готово» з адресою', async () => {
    assert.equal(await sendReadyEmailAgain(fakeReadyStore({ is_published: false }).deps, 'g1', 'owner'), 'not_published')
    assert.equal(await sendReadyEmailAgain(fakeReadyStore({ delivery_status: 'shot' }).deps, 'g1', 'owner'), 'not_ready')
    assert.equal(await sendReadyEmailAgain(fakeReadyStore({ client_email: null }).deps, 'g1', 'owner'), 'no_email')
  })
})

describe('адреса клієнта і точки, звідки йде лист', () => {
  test('parseClientEmail: обрізає пробіли, відкидає сміття', () => {
    assert.equal(parseClientEmail('  olena@example.com '), 'olena@example.com')
    assert.equal(parseClientEmail('olena@example'), null)
    assert.equal(parseClientEmail('olena example.com'), null)
    assert.equal(parseClientEmail(''), null)
    assert.equal(parseClientEmail(`${'a'.repeat(250)}@x.ua`), null)
    assert.equal(parseClientEmail(42), null)
  })

  test('лист іде зі збереження статусу лише для «Готово» і з публікації; не ламає збереження', () => {
    const actions = source('src/lib/actions/galleries.ts')
    assert.match(actions, /if \(deliveryStatus === 'ready'\) \{[\s\S]*?notifyClientIfReady\(supabase, user, galleryId\)/)
    assert.match(actions, /if \(published\) \{[\s\S]*?notifyClientIfReady\(supabase, user, galleryId\)/)
    const store = source('src/lib/gallery/ready-email-store.ts')
    assert.match(store, /export async function notifyClientIfReady[\s\S]*?try \{[\s\S]*?catch/)
  })

  test('адреса без згоди не зберігається (дія сервера)', () => {
    const action = source('src/lib/actions/client-email.ts')
    assert.match(action, /if \(email && !consent\) return \{ ok: false, error: 'consent' \}/)
  })
})

// Top level: describe bodies run after root hooks, so skip() sees the result.
let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())

describe('міграція 0066 на локальному Postgres', () => {
  const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

  function gallery() {
    const userId = pg!.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
    const galleryId = pg!.sql(`insert into public.galleries (owner_id, slug, title, is_published)
      values ('${userId}', 'g-' || gen_random_uuid(), 'T', true) returning id`)
    return { userId, galleryId }
  }

  test('накочується без помилок', { skip: skip() }, () => {
    assert.equal(pg!.failedMigrations['0066_client_picks_ready_email.sql'], undefined)
  })

  test('дві однакові source_file_name в одній галереї — можна (на відміну від original_name)', { skip: skip() }, () => {
    const { userId, galleryId } = gallery()
    const insert = (n: number) =>
      pg!.trySql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, source_file_name)
        values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/${n}.jpg', 'photo', 'image/jpeg', 1, 'IMG 0001.jpg')`)
    assert.equal(insert(1).ok, true)
    assert.equal(insert(2).ok, true, insert(2).out)
  })

  test('адреса клієнта: без згоди — ні, кривий формат — ні, нормальна зі згодою — так', { skip: skip() }, () => {
    const { galleryId } = gallery()
    assert.equal(pg!.trySql(`update public.galleries set client_email = 'a@b.ua' where id = '${galleryId}'`).ok, false)
    assert.equal(
      pg!.trySql(`update public.galleries set client_email = 'not-an-email', client_email_consent_at = now() where id = '${galleryId}'`).ok,
      false
    )
    assert.equal(
      pg!.trySql(`update public.galleries set client_email = 'a@b.ua', client_email_consent_at = now() where id = '${galleryId}'`).ok,
      true
    )
  })

  test('anon і authenticated не читають адресу клієнта й дату листа', { skip: skip() }, () => {
    const { galleryId } = gallery()
    for (const role of ['anon', 'authenticated']) {
      for (const column of ['client_email', 'client_email_consent_at', 'ready_email_sent_at']) {
        const r = pg!.trySql(`begin; set local role ${role}; select ${column} from public.galleries where id = '${galleryId}'; commit;`)
        assert.equal(r.ok, false, `${role} читає ${column}`)
        assert.match(r.out, /permission denied/)
      }
      // А те, що публічна галерея читала, читається й далі.
      const ok = pg!.trySql(`begin; set local role ${role}; select id, title, delivery_status from public.galleries where id = '${galleryId}'; commit;`)
      assert.equal(ok.ok, true, ok.out)
    }
  })
})

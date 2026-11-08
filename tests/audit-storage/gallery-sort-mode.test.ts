/**
 * feat/gallery-sort-mode: режим порядку галереї (galleries.sort_mode, 0071).
 *   - 'manual': нові фото — у кінець (а не на початок, як було після
 *     сортування чи zip-імпорту: дефолтна position = 0);
 *   - 'taken_at': після партії завантажень / zip-імпорту галерея
 *     пересортовується, нові кадри стають між сусідами за часом зйомки,
 *     фото без дати — у кінці;
 *   - без міграції: усе 'manual', нічого не падає.
 * Серверний код — проти фейкового бекенда й заглушок клієнта; SQL — на
 * локальному Postgres (без бінарників ці тести пропускаються).
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSortMode, readGallerySortMode, resortAfterUpload } from '@/lib/gallery/sortMode'
import { registerAsset } from '@/lib/uploads'
import { galleryPrefix } from '@/lib/storage'
import { MB, db, putObject, resetBackend, schema, seedAccount, userClient } from './helpers/fake-backend'
import { startLocalPg, type LocalPg } from './helpers/local-pg'
import { readFileSync } from 'node:fs'

/** A Supabase client stub: galleries.sort_mode read + the sort RPC. */
function stubClient(opts: { sortMode?: string; columnMissing?: boolean; rpcFails?: boolean }) {
  const calls: { fn: string; args: unknown }[] = []
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            opts.columnMissing
              ? { data: null, error: { code: '42703', message: 'column galleries.sort_mode does not exist' } }
              : { data: { sort_mode: opts.sortMode ?? 'manual' }, error: null },
        }),
      }),
    }),
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args })
      return opts.rpcFails ? { data: null, error: { message: 'boom' } } : { data: 3, error: null }
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('режим порядку: читання і пересортування після завантаження', () => {
  test('лише «taken_at» — порядок за зйомкою; усе інше — ручний', () => {
    assert.equal(parseSortMode('taken_at'), 'taken_at')
    for (const v of ['manual', 'taken', null, undefined, 42]) assert.equal(parseSortMode(v), 'manual')
  })

  test('без міграції 0071 (колонки нема) — «manual», без винятку', async () => {
    const { client } = stubClient({ columnMissing: true })
    assert.deepEqual(await readGallerySortMode(client, 'g'), { mode: 'manual', stored: false })
  })

  test('«taken_at»: після партії викликаємо sort_gallery_assets(taken)', async () => {
    const { client, calls } = stubClient({ sortMode: 'taken_at' })
    assert.deepEqual(await resortAfterUpload(client, 'g1'), { mode: 'taken_at', resorted: true })
    assert.deepEqual(calls, [{ fn: 'sort_gallery_assets', args: { p_gallery: 'g1', p_mode: 'taken' } }])
  })

  test('«manual»: нічого не пересортовуємо (нові фото вже в кінці)', async () => {
    const { client, calls } = stubClient({ sortMode: 'manual' })
    assert.deepEqual(await resortAfterUpload(client, 'g1'), { mode: 'manual', resorted: false })
    assert.equal(calls.length, 0)
  })

  test('без колонки — теж ручний, RPC не викликається', async () => {
    const { client, calls } = stubClient({ columnMissing: true })
    assert.equal((await resortAfterUpload(client, 'g1')).resorted, false)
    assert.equal(calls.length, 0)
  })

  test('збій пересортування не ламає завантаження', async () => {
    const { client } = stubClient({ sortMode: 'taken_at', rpcFails: true })
    assert.deepEqual(await resortAfterUpload(client, 'g1'), { mode: 'taken_at', resorted: false })
  })

  test('Uploader і zip-імпорт викликають пересортування', () => {
    assert.match(readFileSync('src/components/Uploader.tsx', 'utf8'), /onBatchDone\(\)/)
    assert.match(readFileSync('src/app/[locale]/dashboard/galleries/[id]/page.tsx', 'utf8'), /onBatchDone=\{afterUploadBatch\.bind/)
    assert.match(readFileSync('src/app/api/import/finish/route.ts', 'utf8'), /resortAfterUpload\(supabase, galleryId\)/)
  })
})

describe('тексти «Порядок» — 9 мов', () => {
  const keys = ['sortTitle', 'sortByTaken', 'sortByUpload', 'sortModeTaken', 'sortModeManual', 'sortCoverage',
    'sortWorking', 'sortDoneTaken', 'sortDoneManual', 'sortModeNotSaved', 'sortNotReady', 'sortFailed']
  for (const locale of ['uk', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'ro']) {
    test(locale, async () => {
      const module = (await import(`@/lib/i18n/dictionaries/${locale}`)) as Record<string, { galleryManage?: Record<string, string> }>
      const dict = Object.values(module)[0]
      const texts = keys.map((key) => dict.galleryManage?.[key])
      for (const [i, text] of texts.entries()) assert.ok(text && text.trim().length > 1, `${locale}.${keys[i]}`)
      assert.match(dict.galleryManage!.sortCoverage, /\{n\}.*\{total\}|\{total\}.*\{n\}/)
      // власний переклад, а не копія англійської (крім самої en)
      if (locale !== 'en') {
        const en = ((await import('@/lib/i18n/dictionaries/en')) as { en: { galleryManage: Record<string, string> } }).en
        assert.notEqual(dict.galleryManage!.sortModeManual, en.galleryManage.sortModeManual)
      }
    })
  }
})

describe('нові фото — у кінець галереї, а не на початок', () => {
  beforeEach(resetBackend)
  const client = () => userClient() as unknown as SupabaseClient
  const account = () => seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * 1024 * MB })
  const upload = async (userId: string, galleryId: string, extra: Record<string, unknown> = {}) => {
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-a.jpg`
    putObject(key, 1 * MB)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
      ...extra,
    })
    assert.equal(result.ok, true, JSON.stringify(result))
    return db.assets.at(-1)!
  }
  const existing = (userId: string, galleryId: string, positions: number[], importId: string | null = null) => {
    for (const position of positions) {
      db.assets.push({ id: crypto.randomUUID(), gallery_id: galleryId, owner_id: userId, position, import_id: importId, size_bytes: 1 })
    }
  }

  test('після сортування (позиції 1..3) нове фото отримує 4, а не 0', async () => {
    const { userId, galleryId } = account()
    existing(userId, galleryId, [1, 2, 3])
    assert.equal((await upload(userId, galleryId)).position, 4)
    assert.equal((await upload(userId, galleryId)).position, 5)
  })

  test('порожня галерея — 1; галерея зі старими «нулями» — 1, тобто після них', async () => {
    const a = account()
    assert.equal((await upload(a.userId, a.galleryId)).position, 1)
    const b = account()
    existing(b.userId, b.galleryId, [0, 0, 0])
    assert.equal((await upload(b.userId, b.galleryId)).position, 1)
  })

  test('сусідня галерея не впливає', async () => {
    const a = account()
    const b = account()
    existing(b.userId, b.galleryId, [1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.equal((await upload(a.userId, a.galleryId)).position, 1)
  })

  test('zip-імпорт: свій порядок назв після того, що вже було в галереї', async () => {
    const { userId, galleryId } = account()
    existing(userId, galleryId, [1, 2, 3])
    const importId = crypto.randomUUID()
    db.gallery_imports.push({ id: importId, owner_id: userId, status: 'running' })
    // файли імпорту завершуються не по порядку — позиції все одно за назвами
    const third = await upload(userId, galleryId, { importId, position: 3, originalName: 'c.jpg' })
    const first = await upload(userId, galleryId, { importId, position: 1, originalName: 'a.jpg' })
    const second = await upload(userId, galleryId, { importId, position: 2, originalName: 'b.jpg' })
    assert.deepEqual([first.position, second.position, third.position], [4, 5, 6])
  })

  test('якщо прочитати позиції не вдалося — як раніше (0), завантаження не падає', async () => {
    const { userId, galleryId } = account()
    existing(userId, galleryId, [1, 2])
    schema.assetsReadFails = true
    assert.equal((await upload(userId, galleryId)).position, 0)
  })
})

let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())
const noPg = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

describe('0071: galleries.sort_mode і sort_gallery_assets', () => {
  function account() {
    const db = pg!
    const userId = db.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
    const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title, is_published)
      values ('${userId}', 'g-' || gen_random_uuid(), 'T', true) returning id`)
    /** The app's plain upload: position = max + 1 (uploads.ts nextPosition). */
    const upload = (name: string, taken: string | null, created: string) =>
      db.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, taken_at, created_at, position)
        values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/${name}', 'photo', 'image/jpeg', 1,
        ${taken ? `'${taken}'` : 'null'}, '${created}',
        (select coalesce(max(position), 0) + 1 from public.assets where gallery_id = '${galleryId}')) returning id`)
    return { userId, galleryId, upload }
  }
  const as = (role: 'anon' | 'authenticated', userId: string | null, query: string) =>
    pg!.trySql(`begin; set local role ${role};
      ${userId ? `select set_config('request.jwt.claim.sub', '${userId}', true);` : ''}
      ${query}; commit;`)
  const order = (galleryId: string) =>
    pg!.sql(`select string_agg(r2_key, ',' order by position, created_at) from public.assets where gallery_id = '${galleryId}'`)
      .split(',')
      .map((key) => key.split('/').pop())
      .join(',')
  const mode = (galleryId: string) => pg!.sql(`select sort_mode from public.galleries where id = '${galleryId}'`)

  test('міграція накочується; за замовчуванням «manual»; інші значення відкидаються', { skip: noPg() }, () => {
    assert.equal(pg!.failedMigrations['0071_gallery_sort_mode.sql'], undefined)
    const a = account()
    assert.equal(mode(a.galleryId), 'manual')
    const bad = pg!.trySql(`update public.galleries set sort_mode = 'random' where id = '${a.galleryId}'`)
    assert.ok(!bad.ok && /galleries_sort_mode_check/.test(bad.out), bad.out)
  })

  test('колонку видно і анонімам (колонкові гранти galleries): select * не ламається', { skip: noPg() }, () => {
    const a = account()
    const anon = as('anon', null, `select sort_mode from public.galleries where id = '${a.galleryId}'`)
    assert.ok(anon.ok, anon.out)
    const owner = as('authenticated', a.userId, `select sort_mode from public.galleries where id = '${a.galleryId}'`)
    assert.ok(owner.ok, owner.out)
  })

  test('«за часом зйомки» вмикає режим; дозавантажений кадр із середини дня стає між сусідами; без дати — у кінці', { skip: noPg() }, () => {
    const a = account()
    a.upload('09-00', '2026-06-01T09:00:00Z', '2026-06-02T10:00:00Z')
    a.upload('18-00', '2026-06-01T18:00:00Z', '2026-06-02T10:00:01Z')
    a.upload('no-date', null, '2026-06-02T10:00:02Z')
    a.upload('12-00', '2026-06-01T12:00:00Z', '2026-06-02T10:00:03Z')
    const sorted = as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(sorted.ok, sorted.out)
    assert.equal(mode(a.galleryId), 'taken_at')
    assert.equal(order(a.galleryId), '09-00,12-00,18-00,no-date')

    // Дозавантаження: спершу в кінець (max + 1), після партії — пересортування.
    a.upload('15-00', '2026-06-01T15:00:00Z', '2026-06-03T08:00:00Z')
    a.upload('later-no-date', null, '2026-06-03T08:00:01Z')
    assert.equal(order(a.galleryId), '09-00,12-00,18-00,no-date,15-00,later-no-date')
    assert.ok(as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`).ok)
    assert.equal(order(a.galleryId), '09-00,12-00,15-00,18-00,no-date,later-no-date')
  })

  test('«за часом завантаження» повертає «manual»; нові фото — у кінець', { skip: noPg() }, () => {
    const a = account()
    a.upload('b', '2026-06-01T12:00:00Z', '2026-06-02T10:00:00Z')
    a.upload('a', '2026-06-01T09:00:00Z', '2026-06-02T10:00:01Z')
    assert.ok(as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`).ok)
    assert.equal(order(a.galleryId), 'a,b')
    assert.ok(as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'uploaded')`).ok)
    assert.equal(mode(a.galleryId), 'manual')
    assert.equal(order(a.galleryId), 'b,a')
    a.upload('c-early', '2026-06-01T06:00:00Z', '2026-06-03T10:00:00Z')
    assert.equal(order(a.galleryId), 'b,a,c-early')
  })

  test('чужа галерея й анонім режим не змінюють', { skip: noPg() }, () => {
    const a = account()
    const b = account()
    const foreign = as('authenticated', b.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(!foreign.ok && /gallery_not_found/.test(foreign.out), foreign.out)
    const anon = as('anon', null, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(!anon.ok && /permission denied/.test(anon.out), anon.out)
    assert.equal(mode(a.galleryId), 'manual')
  })
})

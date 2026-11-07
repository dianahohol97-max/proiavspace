/**
 * feat/gallery-grid: розкладка «Рядки» (justified), дата зйомки з EXIF,
 * орієнтація й HEIC-прев’ю. Чиста математика й серверний шлях реєстрації
 * (фейковий бекенд), а також міграція 0061 на локальному Postgres (без
 * Postgres-бінарників ці тести пропускаються).
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ROW_HEIGHT_PHONE,
  ROW_HEIGHT_TABLET,
  gridColumns,
  headCount,
  justifyRows,
  rowAspect,
  rowDesktopHeight,
  rowTargetHeight,
  rowsHeadEnd,
  rowsHeight,
} from '@/components/gallery/gridLayout'
import { exifDateToIso, heifExifTiff, isValidTakenAt, orientationSwapsSides, pickPhotoExif } from '@/lib/images/exif'
import exifr from 'exifr'
import { isWebDisplayable, looksLikeHeic, orientationTransform } from '@/lib/images/variants'
import { mimeFromName } from '@/lib/import/zip-plan'
import { LAYOUT_CHOICES, parseGalleryStyle } from '@/lib/gallery/style'
import { isMissingColumn, parseRegisterAssetInput, registerAsset } from '@/lib/uploads'
import { galleryPrefix } from '@/lib/storage'
import { MB, db, putObject, resetBackend, schema, seedAccount, userClient } from './helpers/fake-backend'
import { startLocalPg, type LocalPg } from './helpers/local-pg'
import { readFileSync } from 'node:fs'

const L = 3 / 2 // landscape, width ÷ height
const P = 2 / 3 // portrait

describe('«Рядки»: justifyRows', () => {
  test('повні рядки заповнюють ширину рівно, усі плитки рядка однієї висоти', () => {
    const aspects = [L, L, P, L, P, P, L, L, L, P, L, 1]
    const width = 1216
    const gap = 14
    const rows = justifyRows(aspects, width, 240, gap)
    assert.equal(rows[0].start, 0)
    assert.equal(rows.at(-1)!.end, aspects.length)
    for (let k = 0; k < rows.length; k++) {
      const row = rows[k]
      if (k > 0) assert.equal(row.start, rows[k - 1].end, 'рядки йдуть підряд, без пропусків')
      const widths = aspects.slice(row.start, row.end).map((a) => a * row.height)
      const used = widths.reduce((s, w) => s + w, 0) + gap * (widths.length - 1)
      if (!row.last) assert.ok(Math.abs(used - width) < 1e-6, `рядок ${k}: ${used} ≠ ${width}`)
      else assert.ok(used <= width + 1e-6)
    }
  })

  test('розриви рядків — як у CSS flex-wrap (база = аспект × цільова висота)', () => {
    // 3 ландшафти по 360 + 2 проміжки = 1108 ≤ 1216, четвертий уже не влазить
    const rows = justifyRows([L, L, L, L, L, L, L], 1216, 240, 14)
    assert.deepEqual(
      rows.map((r) => [r.start, r.end]),
      [
        [0, 3],
        [3, 6],
        [6, 7],
      ]
    )
    // висота розтягнутого рядка: (1216 − 28) ÷ 4.5
    assert.ok(Math.abs(rows[0].height - 1188 / 4.5) < 1e-9)
  })

  test('останній рядок не розтягується: цільова висота, ліворуч', () => {
    const rows = justifyRows([L, L, L, L], 1216, 240, 14)
    assert.equal(rows.at(-1)!.last, true)
    assert.equal(rows.at(-1)!.height, 240)
    assert.equal(rows.filter((r) => r.last).length, 1)
  })

  test('панорама ширша за екран стискається до ширини (без обрізання)', () => {
    const rows = justifyRows([L, 6, L], 362, 100, 14)
    const pano = rows.find((r) => r.start === 1)!
    assert.equal(pano.end, 2)
    assert.ok(Math.abs(pano.height * 6 - 362) < 1e-9)
  })

  test('фото без розмірів — слот 4:5, порожній список і нульова ширина не падають', () => {
    assert.equal(rowAspect(null, null), 4 / 5)
    assert.equal(rowAspect(2000, 1000), 2)
    assert.deepEqual(justifyRows([], 1000, 240, 14), [])
    assert.deepEqual(justifyRows([L], 0, 240, 14), [])
    const rows = justifyRows([0, NaN as unknown as number], 1000, 240, 14)
    assert.equal(rows.length, 1)
    assert.ok(Number.isFinite(rows[0].height))
  })

  test('висота сітки = рядки + проміжки між ними', () => {
    const rows = justifyRows([L, L, L, L], 1216, 240, 14)
    assert.equal(rowsHeight(rows, 14), rows[0].height + rows[1].height + 14)
    assert.equal(rowsHeight([], 14), 0)
  })

  test('голова з сервера доростає до кінця свого рядка', () => {
    const rows = justifyRows([L, L, L, L, L, L, L], 1216, 240, 14)
    assert.equal(rowsHeadEnd(rows, 4), 6)
    assert.equal(rowsHeadEnd(rows, 3), 3)
    assert.equal(rowsHeadEnd(rows, 7), 7)
    assert.equal(rowsHeadEnd(rows, 0), 0)
  })

  test('цільова висота рядка: телефон / планшет / десктоп за «колонками»', () => {
    assert.equal(rowTargetHeight(3, 390), ROW_HEIGHT_PHONE)
    assert.equal(rowTargetHeight(3, 800), ROW_HEIGHT_TABLET)
    assert.equal(rowTargetHeight(2, 1280), rowDesktopHeight(2))
    assert.ok(rowDesktopHeight(2) > rowDesktopHeight(3) && rowDesktopHeight(3) > rowDesktopHeight(4))
    // Телефон: два ландшафти в рядок навіть на 360 px (контент 332 px)
    assert.ok(2 * L * ROW_HEIGHT_PHONE + 14 <= 332)
  })

  test('ті самі числа в CSS (--g-row-h), інакше голова і хвіст розійдуться', () => {
    const css = readFileSync('src/components/gallery/GalleryExperience.module.css', 'utf8')
    assert.match(css, new RegExp(`max-width: 900px\\) \\{ \\.gridRows \\{ --g-row-h: ${ROW_HEIGHT_TABLET}px`))
    assert.match(css, new RegExp(`max-width: 560px\\) \\{ \\.gridRows \\{ --g-row-h: ${ROW_HEIGHT_PHONE}px`))
    assert.match(css, new RegExp(`--g-row-h-d, ${rowDesktopHeight(3)}px`))
  })

  test('голова «Рядків» як у мозаїки (24 плитки), sizes як у мозаїки', () => {
    assert.equal(headCount('rows', 3, 1500), 24)
    assert.equal(headCount('rows', 3, 10), 10)
    assert.equal(gridColumns('rows', 3, 400), 1)
    assert.equal(gridColumns('rows', 4, 1280), 4)
  })

  test('«Рядки» — ще одна розкладка на вибір, решта на місці', () => {
    assert.deepEqual(
      LAYOUT_CHOICES.map((l) => l.value),
      ['masonry', 'square', 'portrait', 'collage', 'editorial', 'rows']
    )
    assert.equal(parseGalleryStyle({ layout: 'rows' }).layout, 'rows')
    assert.equal(parseGalleryStyle({ layout: 'justified' }).layout, undefined)
  })
})

describe('EXIF: дата зйомки', () => {
  test('DateTimeOriginal → настінний час як UTC, із частками секунди', () => {
    assert.equal(exifDateToIso('2026:06:01 14:03:22'), '2026-06-01T14:03:22.000Z')
    assert.equal(exifDateToIso('2026:06:01 14:03:22', '12'), '2026-06-01T14:03:22.120Z')
    assert.equal(exifDateToIso('2026:06:01 14:03:22', '045'), '2026-06-01T14:03:22.045Z')
  })

  test('сміття й незаведений годинник відкидаються', () => {
    for (const bad of ['0000:00:00 00:00:00', '2026:02:31 10:00:00', '2026:13:01 10:00:00', '1970:01:01 00:00:00', '', 'вчора', 42, null]) {
      assert.equal(exifDateToIso(bad), null, String(bad))
    }
  })

  test('зсув часового поясу не впливає: Canon без зсуву і iPhone з +03:00 стають підряд', () => {
    const canon = pickPhotoExif({ DateTimeOriginal: '2026:06:01 14:03:22' })
    const iphone = pickPhotoExif({ DateTimeOriginal: '2026:06:01 14:03:25', OffsetTimeOriginal: '+03:00' })
    assert.ok(Date.parse(canon.takenAt!) < Date.parse(iphone.takenAt!))
    const order = [iphone, canon].sort((a, b) => Date.parse(a.takenAt!) - Date.parse(b.takenAt!))
    assert.equal(order[0], canon)
  })

  test('без DateTimeOriginal — CreateDate; ModifyDate (час експорту) — ні', () => {
    assert.equal(pickPhotoExif({ CreateDate: '2025:09:10 08:00:00' }).takenAt, '2025-09-10T08:00:00.000Z')
    assert.equal(pickPhotoExif({ ModifyDate: '2026:11:01 22:00:00' }).takenAt, null)
    assert.deepEqual(pickPhotoExif(undefined), { takenAt: null, orientation: null })
  })

  test('орієнтація і сирий розмір', () => {
    const exif = pickPhotoExif({ Orientation: 6, ExifImageWidth: 4032, ExifImageHeight: 3024 })
    assert.equal(exif.orientation, 6)
    assert.equal(exif.rawWidth, 4032)
    assert.equal(pickPhotoExif({ Orientation: 9 }).orientation, null)
    assert.equal(orientationSwapsSides(6), true)
    assert.equal(orientationSwapsSides(3), false)
  })

  test('сервер приймає лише правдоподібний takenAt', () => {
    assert.equal(isValidTakenAt('2026-06-01T14:03:22.120Z'), true)
    assert.equal(isValidTakenAt('1900-01-01T00:00:00Z'), false)
    assert.equal(isValidTakenAt('не дата'), false)
    assert.equal(isValidTakenAt(12345), false)
    const base = { galleryId: 'g', key: 'k', contentType: 'image/jpeg', sizeBytes: 1 }
    assert.ok(parseRegisterAssetInput({ ...base, takenAt: '2026-06-01T14:03:22Z' }))
    assert.equal(parseRegisterAssetInput({ ...base, takenAt: 'drop table' }), null)
  })
})

describe('орієнтація з EXIF у прев’ю', () => {
  // Куди потрапляє верхній лівий кут збереженого кадру (W×H — розмір прев’ю).
  const corner = (o: number, w: number, h: number) => {
    const [a, b, c, d, e, f] = orientationTransform(o, w, h)
    const map = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f]
    return map(0, 0)
  }
  test('8 орієнтацій EXIF: кадр стає рівно в полотно', () => {
    const W = 300
    const H = 200
    assert.deepEqual(corner(1, W, H), [0, 0])
    assert.deepEqual(corner(2, W, H), [W, 0])
    assert.deepEqual(corner(3, W, H), [W, H])
    assert.deepEqual(corner(4, W, H), [0, H])
    assert.deepEqual(corner(5, W, H), [0, 0])
    assert.deepEqual(corner(6, W, H), [W, 0]) // поворот на 90° за годинниковою
    assert.deepEqual(corner(7, W, H), [W, H])
    assert.deepEqual(corner(8, W, H), [0, H]) // поворот на 90° проти
    // протилежний кут збереженого кадру (H×W для 5–8) лягає в протилежний кут
    for (const o of [5, 6, 7, 8]) {
      const [a, b, c, d, e, f] = orientationTransform(o, W, H)
      const x = a * H + c * W + e
      const y = b * H + d * W + f
      assert.ok(x >= -1e-9 && x <= W + 1e-9 && y >= -1e-9 && y <= H + 1e-9, `o=${o}`)
      assert.notDeepEqual([x, y], corner(o, W, H))
    }
  })
})

describe('HEIC', () => {
  const brand = (b: string) => new Uint8Array([0, 0, 0, 24, ...Array.from(`ftyp${b}`, (ch) => ch.charCodeAt(0))])
  test('впізнаємо за типом, розширенням і брендом файлу (Chrome на Windows дає порожній тип)', () => {
    assert.equal(looksLikeHeic('image/heic', 'a.jpg'), true)
    assert.equal(looksLikeHeic('', 'IMG_0001.HEIC'), true)
    assert.equal(looksLikeHeic('', 'noext', brand('heic')), true)
    assert.equal(looksLikeHeic('', 'noext', brand('mif1')), true)
    assert.equal(looksLikeHeic('', 'noext', brand('isom')), false)
    assert.equal(looksLikeHeic('image/jpeg', 'a.jpg'), false)
    assert.equal(mimeFromName('IMG_0001.HEIC'), 'image/heic')
  })
  test('EXIF із HEIC (контейнер від libheif, де exifr збивається) читаємо самі', async () => {
    const file = readFileSync('tests/e2e/fixtures/iphone.heic')
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
    const tiff = heifExifTiff(buffer)
    assert.ok(tiff)
    const tags = await exifr.parse(tiff, { reviveValues: false, translateValues: false })
    assert.equal(pickPhotoExif(tags).takenAt, '2026-06-01T14:03:22.120Z')
    // не HEIF / обрізаний файл — null, без винятків
    assert.equal(heifExifTiff(new Uint8Array([1, 2, 3]).buffer), null)
    assert.equal(heifExifTiff(buffer.slice(0, 300)), null)
    const jpeg = readFileSync('tests/e2e/fixtures/canon-rotated.jpg')
    assert.equal(heifExifTiff(jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength)), null)
  })
  test('прев’ю обов’язкове для форматів, яких браузер не покаже', () => {
    assert.equal(isWebDisplayable('image/jpeg'), true)
    assert.equal(isWebDisplayable('image/heic'), false)
    assert.equal(isWebDisplayable('image/tiff'), false)
  })
  test('heic-to (LGPL) підключається лише динамічно, як окремий модуль', () => {
    const src = readFileSync('src/lib/images/variants.ts', 'utf8')
    assert.match(src, /await import\('heic-to\/next'\)/)
    assert.doesNotMatch(src, /^import .*heic-to/m)
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    assert.match(pkg.dependencies['heic-to'], /^\d+\.\d+\.\d+$/, 'точна версія')
    assert.match(pkg.dependencies.exifr, /^\d+\.\d+\.\d+$/)
    assert.match(readFileSync('docs/THIRD_PARTY_NOTICES.md', 'utf8'), /heic-to[\s\S]*LGPL-3\.0/)
  })
})

describe('реєстрація фото з датою зйомки', () => {
  beforeEach(resetBackend)
  const client = () => userClient() as unknown as SupabaseClient
  const upload = (userId: string, galleryId: string) => {
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-a.heic`
    putObject(key, 2 * MB, 'image/heic')
    return key
  }

  test('taken_at потрапляє в рядок assets', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * 1024 * MB })
    const key = upload(userId, galleryId)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/heic',
      sizeBytes: 2 * MB,
      takenAt: '2026-06-01T14:03:22.120Z',
    })
    assert.equal(result.ok, true)
    assert.equal(db.assets[0].taken_at, '2026-06-01T14:03:22.120Z')
    assert.equal(db.assets[0].kind, 'photo')
  })

  test('до міграції 0061 (колонки нема) фото все одно реєструється, без дати', async () => {
    schema.assetsTakenAt = false
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * 1024 * MB })
    const result = await registerAsset(client(), userId, {
      galleryId,
      key: upload(userId, galleryId),
      contentType: 'image/heic',
      sizeBytes: 2 * MB,
      takenAt: '2026-06-01T14:03:22.120Z',
    })
    assert.equal(result.ok, true)
    assert.equal(db.assets.length, 1)
    assert.equal('taken_at' in db.assets[0], false)
  })

  test('isMissingColumn: лише «нема колонки», інші помилки не ховаємо', () => {
    assert.equal(isMissingColumn({ code: 'PGRST204', message: "Could not find the 'taken_at' column" }, 'taken_at'), true)
    assert.equal(isMissingColumn({ code: '42703', message: 'column "taken_at" does not exist' }, 'taken_at'), true)
    assert.equal(isMissingColumn({ code: 'P0001', message: 'storage_quota_exceeded' }, 'taken_at'), false)
    assert.equal(isMissingColumn(null, 'taken_at'), false)
  })
})

let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())
const noPg = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

describe('0061: taken_at і sort_gallery_assets', () => {
  function account() {
    const db = pg!
    const userId = db.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
    const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title, is_published)
      values ('${userId}', 'g-' || gen_random_uuid(), 'T', true) returning id`)
    const add = (name: string, taken: string | null, created: string) =>
      db.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, taken_at, created_at)
        values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/${name}', 'photo', 'image/jpeg', 1,
        ${taken ? `'${taken}'` : 'null'}, '${created}') returning id`)
    return { userId, galleryId, add }
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

  test('міграція накочується без помилок', { skip: noPg() }, () => {
    assert.equal(pg!.failedMigrations['0061_asset_taken_at.sql'], undefined)
    assert.equal(pg!.sql(`select data_type from information_schema.columns where table_name = 'assets' and column_name = 'taken_at'`), 'timestamp with time zone')
  })

  test('власниця впорядковує за часом зйомки (дві камери), без дати — у кінці; і назад', { skip: noPg() }, () => {
    const a = account()
    // завантажено: спершу вся камера A, потім уся камера B, потім відео без дати
    a.add('canon-1', '2026-06-01T14:00:00Z', '2026-06-02T10:00:00Z')
    a.add('canon-2', '2026-06-01T15:00:00Z', '2026-06-02T10:00:01Z')
    a.add('iphone-1', '2026-06-01T14:30:00Z', '2026-06-02T10:00:02Z')
    a.add('video', null, '2026-06-02T10:00:03Z')
    a.add('iphone-2', '2026-06-01T13:00:00Z', '2026-06-02T10:00:04Z')
    const sorted = as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(sorted.ok, sorted.out)
    assert.equal(order(a.galleryId), 'iphone-2,canon-1,iphone-1,canon-2,video')
    assert.ok(as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'uploaded')`).ok)
    assert.equal(order(a.galleryId), 'canon-1,canon-2,iphone-1,video,iphone-2')
  })

  test('чужа галерея, анонім і невідомий режим — відмова', { skip: noPg() }, () => {
    const a = account()
    const b = account()
    a.add('x', null, '2026-06-02T10:00:00Z')
    const foreign = as('authenticated', b.userId, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(!foreign.ok && /gallery_not_found/.test(foreign.out), foreign.out)
    const anon = as('anon', null, `select public.sort_gallery_assets('${a.galleryId}', 'taken')`)
    assert.ok(!anon.ok && /permission denied/.test(anon.out), anon.out)
    const bad = as('authenticated', a.userId, `select public.sort_gallery_assets('${a.galleryId}', 'random')`)
    assert.ok(!bad.ok && /invalid_sort_mode/.test(bad.out), bad.out)
  })
})

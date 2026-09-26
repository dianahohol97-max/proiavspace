/**
 * PR 1 — правила крону /api/cron/storage-cleanup (ST-02 / ST-03): що
 * вважається сиротою й коли її можна видаляти. Чисті функції з
 * src/lib/storage/cleanup.ts, без бакета.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import {
  ORPHAN_GRACE_MS,
  isMediaKey,
  orphanKeys,
  referencedKeys,
  staleMultipartUploads,
} from '@/lib/storage/cleanup'

const NOW = Date.parse('2026-09-26T12:00:00Z')
const old = new Date(NOW - ORPHAN_GRACE_MS - 60_000)
const fresh = new Date(NOW - 5 * 60_000)
const obj = (key: string, lastModified: Date | null, sizeBytes = 1) => ({ key, lastModified, sizeBytes })

describe('що взагалі підлягає прибиранню', () => {
  test('лише медіа галерей і портфоліо; лого, social, бекапи — ніколи', () => {
    assert.equal(isMediaKey('u/U/g/G/o/x.jpg'), true)
    assert.equal(isMediaKey('u/U/g/G/v/x-preview.jpg'), true)
    assert.equal(isMediaKey('u/U/portfolio/x.jpg'), true)
    assert.equal(isMediaKey('u/U/portfolio/v/x-thumb.jpg'), true)
    assert.equal(isMediaKey('u/U/brand/logo.png'), false)
    assert.equal(isMediaKey('u/U/social/P/video.mp4'), false)
    assert.equal(isMediaKey('db/proiav-2026.dump'), false)
    assert.equal(isMediaKey('u/U/g/'), false)
  })
})

describe('сироти', () => {
  test('незареєстрований об’єкт старше доби — видаляється; свіжий — ні (завантаження ще триває)', () => {
    const referenced = new Set<string>()
    const keys = orphanKeys([obj('u/U/g/G/o/old.jpg', old), obj('u/U/g/G/o/fresh.jpg', fresh)], referenced, NOW)
    assert.deepEqual(keys, ['u/U/g/G/o/old.jpg'])
  })

  test('зареєстрований об’єкт і його варіанти лишаються, хоч би якими старими були', () => {
    const referenced = referencedKeys([
      { r2_key: 'u/U/g/G/o/a.jpg', variants: { preview: 'u/U/g/G/v/a-preview.jpg', thumb: 'u/U/g/G/v/a-thumb.jpg' } },
      { r2_key: 'u/U/portfolio/p.jpg', variants: null },
    ])
    const keys = orphanKeys(
      [
        obj('u/U/g/G/o/a.jpg', old),
        obj('u/U/g/G/v/a-preview.jpg', old),
        obj('u/U/g/G/v/a-thumb.jpg', old),
        obj('u/U/portfolio/p.jpg', old),
        obj('u/U/g/G/v/lost-poster.jpg', old),
      ],
      referenced,
      NOW
    )
    assert.deepEqual(keys, ['u/U/g/G/v/lost-poster.jpg'])
  })

  test('об’єкт без дати вважається старим (не лишаємо назавжди)', () => {
    assert.deepEqual(orphanKeys([obj('u/U/g/G/o/nodate.jpg', null)], new Set(), NOW), ['u/U/g/G/o/nodate.jpg'])
  })

  test('ключі поза медіа-префіксами не потрапляють у список навіть без посилань', () => {
    assert.deepEqual(orphanKeys([obj('u/U/brand/logo.png', old), obj('u/U/social/P/video.mp4', old)], new Set(), NOW), [])
  })
})

describe('незавершені multipart', () => {
  test('старші за добу — abort; свіжі — лишаються', () => {
    const stale = staleMultipartUploads(
      [
        { key: 'u/U/g/G/o/big.mp4', uploadId: '1', initiated: old },
        { key: 'u/U/g/G/o/now.mp4', uploadId: '2', initiated: fresh },
        { key: 'u/U/g/G/o/unknown.mp4', uploadId: '3', initiated: null },
      ],
      NOW
    )
    assert.deepEqual(stale.map((u) => u.uploadId), ['1', '3'])
  })
})

describe('маршрут крону', () => {
  const route = readFileSync(join(__dirname, '..', '..', 'src/app/api/cron/storage-cleanup/route.ts'), 'utf8')
  test('захищений CRON_SECRET, читає лише під u/, зупиняється при помилці читання БД', () => {
    assert.match(route, /CRON_SECRET/)
    assert.match(route, /storage\.list\('u\/'\)/)
    assert.match(route, /db_read_failed/)
  })
})

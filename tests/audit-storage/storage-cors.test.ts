/**
 * /api/admin/storage-cors: повний набір CORS-правил бакета одним викликом,
 * ідемпотентно. Без мережі — фейковий клієнт S3.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, test } from 'node:test'
import { DESIRED_CORS_RULES, PRODUCTION_ORIGINS, applyStorageCors, sameCorsRules, type CorsClient, type CorsRule } from '../../src/lib/storage/cors'

const ROOT = resolve(__dirname, '..', '..')

function fakeBucket(initial: unknown[] | null) {
  let stored = initial
  const calls = { get: 0, put: 0 }
  const client: CorsClient = {
    async get() {
      calls.get++
      return stored as Awaited<ReturnType<CorsClient['get']>>
    },
    async put(rules: CorsRule[]) {
      calls.put++
      // B2 hands rules back with its own IDs and in its own order.
      stored = [...rules].reverse().map((r, i) => ({ ID: `s3-cors-rule-${i}`, ...r, AllowedMethods: [...r.AllowedMethods].reverse() }))
    },
  }
  return { client, calls, stored: () => stored }
}

describe('CORS бакета: повний набір правил', () => {
  test('завантаження: PUT з ETag у ExposeHeaders (докачування частинами), ті самі origin-и, що й раніше', () => {
    const put = DESIRED_CORS_RULES.find((r) => r.AllowedMethods.includes('PUT'))!
    assert.ok(put.ExposeHeaders.includes('ETag'))
    assert.deepEqual(put.AllowedHeaders, ['*'])
    for (const o of ['https://proiav.space', 'https://www.proiav.space', 'https://*.vercel.app', 'http://localhost:3000']) {
      assert.ok(put.AllowedOrigins.includes(o), o)
    }
  })

  test('читання: GET/HEAD лише з https://proiav.space і https://www.proiav.space', () => {
    const read = DESIRED_CORS_RULES.find((r) => r.AllowedMethods.includes('GET'))!
    assert.deepEqual([...read.AllowedMethods].sort(), ['GET', 'HEAD'])
    assert.deepEqual(read.AllowedOrigins, PRODUCTION_ORIGINS)
    assert.deepEqual(PRODUCTION_ORIGINS, ['https://proiav.space', 'https://www.proiav.space'])
    // No trailing slashes: B2 compares origins literally.
    for (const r of DESIRED_CORS_RULES) for (const o of r.AllowedOrigins) assert.doesNotMatch(o, /\/$/)
  })

  test('перший виклик записує, повторний нічого не змінює (ідемпотентно)', async () => {
    const old = [{ AllowedOrigins: ['https://proiav.space'], AllowedMethods: ['GET', 'PUT', 'HEAD'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }]
    const bucket = fakeBucket(old)
    const first = await applyStorageCors(bucket.client)
    assert.equal(first.changed, true)
    assert.deepEqual(first.before, old)
    assert.ok(sameCorsRules(first.after!, DESIRED_CORS_RULES))
    assert.equal(bucket.calls.put, 1)

    const second = await applyStorageCors(bucket.client)
    assert.equal(second.changed, false)
    assert.equal(bucket.calls.put, 1, 'повтор не пише в бакет')
    assert.deepEqual(second.before, second.after)
  })

  test('правил ще немає або їх не прочитати — записує повний набір', async () => {
    const bucket = fakeBucket(null)
    const r = await applyStorageCors(bucket.client)
    assert.equal(r.before, null)
    assert.equal(r.changed, true)
    assert.ok(sameCorsRules(bucket.stored() as CorsRule[], DESIRED_CORS_RULES))
  })

  test('порівняння не залежить від порядку, регістру й ID, але помічає зміну origin-а', () => {
    const shuffled = [...DESIRED_CORS_RULES].reverse().map((r) => ({ ID: 'x', ...r, ExposeHeaders: r.ExposeHeaders.map((h) => h.toLowerCase()) }))
    assert.ok(sameCorsRules(shuffled, DESIRED_CORS_RULES))
    const changed = DESIRED_CORS_RULES.map((r) => ({ ...r, AllowedOrigins: r.AllowedOrigins.filter((o) => o !== 'https://www.proiav.space') }))
    assert.equal(sameCorsRules(changed, DESIRED_CORS_RULES), false)
  })

  test('маршрут адмінки бере правила з lib/storage/cors і лишається лише для адмінів', () => {
    const route = readFileSync(join(ROOT, 'src/app/api/admin/storage-cors/route.ts'), 'utf8')
    assert.match(route, /applyStorageCors\(client\)/)
    assert.match(route, /isAdminEmail\(user\.email\)/)
    assert.doesNotMatch(route, /AllowedMethods:/, 'жодних захардкоджених правил у маршруті')
  })
})

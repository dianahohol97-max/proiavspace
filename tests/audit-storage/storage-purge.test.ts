/**
 * LC-02 — обробник черги storage_purge_queue (міграція 0057): захист
 * префіксів, ліміти, повторні спроби, відсутня таблиця, dry-run, видалення
 * всіх версій у B2. Бакет і база — фейки в пам'яті; S3-клієнт B2 підмінено.
 */
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import { S3Client } from '@aws-sdk/client-s3'
import {
  MAX_ATTEMPTS,
  asPurgeStorage,
  coveredBy,
  isMissingTableError,
  purgeDryRun,
  purgeStorageQueue,
  unsafeReason,
  type ObjectVersion,
  type PurgeQueue,
  type PurgeRow,
  type PurgeStorage,
} from '@/lib/storage/purge'
import { supabasePurgeQueue } from '@/lib/storage/purge-queue'
import { B2Provider } from '@/lib/storage/R2Provider'

const A = '11111111-2222-4333-8444-555555555555'
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

/* ---- fakes --------------------------------------------------------------- */

class FakeBucket implements PurgeStorage {
  /** key → versionIds, in the order S3 lists them. */
  versions = new Map<string, string[]>()
  multipart: { key: string; uploadId: string }[] = []
  deleted: ObjectVersion[] = []
  aborted: string[] = []
  listCalls: string[] = []
  failDeleteFor: string | null = null
  /** Keys the bucket "lists" no matter the prefix (a misbehaving backend). */
  extraListed: ObjectVersion[] = []

  put(key: string, n = 1) {
    const ids = this.versions.get(key) ?? []
    for (let i = 0; i < n; i++) ids.push(`v${ids.length + 1}`)
    this.versions.set(key, ids)
  }
  all(): ObjectVersion[] {
    return [...this.versions.keys()].sort().flatMap((key) => this.versions.get(key)!.map((versionId) => ({ key, versionId })))
  }
  async listObjectVersions(prefix: string, o: { maxKeys: number; keyMarker?: string; versionIdMarker?: string }) {
    this.listCalls.push(prefix)
    let items = this.all().filter((v) => v.key.startsWith(prefix))
    if (o.keyMarker) {
      const at = items.findIndex((v) => v.key === o.keyMarker && v.versionId === o.versionIdMarker)
      items = items.slice(at + 1)
    }
    const page = [...items.slice(0, o.maxKeys), ...this.extraListed]
    const truncated = items.length > o.maxKeys
    const last = items[o.maxKeys - 1]
    return {
      versions: page,
      truncated,
      nextKeyMarker: truncated ? last.key : undefined,
      nextVersionIdMarker: truncated ? (last.versionId ?? undefined) : undefined,
    }
  }
  async deleteObjectVersions(list: ObjectVersion[]) {
    if (this.failDeleteFor && list.some((v) => v.key.startsWith(this.failDeleteFor!))) {
      throw new Error('B2 refused 1 of 1 deletes (AccessDenied)')
    }
    for (const v of list) {
      const ids = (this.versions.get(v.key) ?? []).filter((id) => id !== v.versionId)
      if (ids.length) this.versions.set(v.key, ids)
      else this.versions.delete(v.key)
      this.deleted.push(v)
    }
  }
  async listMultipartUploads(prefix: string) {
    return this.multipart.filter((u) => u.key.startsWith(prefix))
  }
  async abortMultipartUpload(key: string, uploadId: string) {
    this.aborted.push(`${key}#${uploadId}`)
    this.multipart = this.multipart.filter((u) => u.uploadId !== uploadId)
  }
}

type QRow = PurgeRow & { purged_at: string | null; last_error: string | null }

class FakeQueue implements PurgeQueue {
  rows: QRow[] = []
  missing = false
  lastLimit = 0
  writes = 0
  add(key: string, kind: 'object' | 'prefix', owner: string | null = A, attempts = 0) {
    this.rows.push({ id: this.rows.length + 1, key, kind, owner_id: owner, attempts, purged_at: null, last_error: null })
  }
  async fetchPending(limit: number, maxAttempts: number) {
    if (this.missing) return { missingTable: true as const }
    this.lastLimit = limit
    return {
      rows: this.rows
        .filter((r) => r.purged_at === null && r.attempts < maxAttempts)
        .slice(0, limit)
        .map(({ id, key, kind, owner_id, attempts }) => ({ id, key, kind, owner_id, attempts })),
    }
  }
  async countStuck(maxAttempts: number) {
    return this.rows.filter((r) => r.purged_at === null && r.attempts >= maxAttempts).length
  }
  async markPurged(id: number) {
    this.writes++
    const r = this.rows.find((x) => x.id === id)!
    r.purged_at = 'now'
    r.last_error = null
  }
  async markFailed(id: number, attempts: number, error: string) {
    this.writes++
    const r = this.rows.find((x) => x.id === id)!
    r.attempts = attempts
    r.last_error = error
  }
}

const quiet = { log: () => {} }

/* ---- key rules ----------------------------------------------------------- */

describe('захист префіксів', () => {
  test('дозволено лише u/<uuid>/… ; порожнє, корінь, u/, чужий uuid — ні', () => {
    assert.equal(unsafeReason({ key: `u/${A}/`, kind: 'prefix', owner_id: A }), null)
    assert.equal(unsafeReason({ key: `u/${A}/g/x/o/1.jpg`, kind: 'object', owner_id: A }), null)
    assert.equal(unsafeReason({ key: `u/${A}/g/x/`, kind: 'prefix', owner_id: null }), null)

    for (const key of ['', ' ', '/', 'u/', 'u//', 'u', `u/${A}`, 'u/not-a-uuid/', 'db/', `x/${A}/`, `/u/${A}/`, ` u/${A}/`]) {
      assert.notEqual(unsafeReason({ key, kind: 'prefix', owner_id: null }), null, `prefix ${JSON.stringify(key)} must be refused`)
    }
    for (const key of ['', `u/${A}/`, `u/${A}`, `u/${A}//x.jpg`, `u/${A}/../${B}/x.jpg`, `u/${A}/./x.jpg`, `u/${A}/g/*`, 'db/dump.sql']) {
      assert.notEqual(unsafeReason({ key, kind: 'object', owner_id: null }), null, `object ${JSON.stringify(key)} must be refused`)
    }
  })

  test('ключ іншого акаунта за owner_id — відмова; невідомий kind — відмова', () => {
    assert.match(unsafeReason({ key: `u/${B}/x.jpg`, kind: 'object', owner_id: A })!, /another account/)
    assert.match(unsafeReason({ key: `u/${B}/`, kind: 'prefix', owner_id: A })!, /another account/)
    assert.notEqual(unsafeReason({ key: `u/${A}/x`, kind: 'bucket' as never, owner_id: A }), null)
  })

  test('покриття: object — лише точний ключ; prefix — лише те, що глибше', () => {
    assert.equal(coveredBy({ key: `u/${A}/a.jpg`, kind: 'object' }, `u/${A}/a.jpg`), true)
    assert.equal(coveredBy({ key: `u/${A}/a.jpg`, kind: 'object' }, `u/${A}/a.jpg.bak`), false)
    assert.equal(coveredBy({ key: `u/${A}/`, kind: 'prefix' }, `u/${A}/x`), true)
    assert.equal(coveredBy({ key: `u/${A}/`, kind: 'prefix' }, `u/${A}/`), false)
    assert.equal(coveredBy({ key: `u/${A}/`, kind: 'prefix' }, `u/${B}/x`), false)
  })

  test('небезпечний запис не доходить до бакета і паркується на MAX спроб', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/x.jpg`)
    q.add('', 'prefix', null)
    q.add('u/', 'prefix', null)
    q.add(`u/${B}/x.jpg`, 'object', A)
    const reports: unknown[] = []
    const sum = await purgeStorageQueue(q, s, { dryRun: false, report: (e) => reports.push(e), ...quiet })
    assert.equal(sum.rejected, 3)
    assert.equal(s.listCalls.length, 0)
    assert.equal(s.deleted.length, 0)
    assert.ok(q.rows.every((r) => r.attempts === MAX_ATTEMPTS && /unsafe key refused/.test(r.last_error!)))
    assert.equal(sum.stuck, 3)
    assert.equal(reports.length, 3)
  })

  test('бакет повернув ключ поза записом — ігнорується; небезпечний ключ під префіксом — помилка, нічого не видалено', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/a.jpg`)
    s.extraListed = [{ key: `u/${B}/other.jpg`, versionId: 'v1' }]
    q.add(`u/${A}/`, 'prefix')
    await purgeStorageQueue(q, s, { dryRun: false, ...quiet })
    assert.deepEqual(s.deleted.map((v) => v.key), [`u/${A}/a.jpg`])

    const q2 = new FakeQueue()
    const s2 = new FakeBucket()
    s2.put(`u/${A}/a.jpg`)
    s2.extraListed = [{ key: `u/${A}/../${B}/x.jpg`, versionId: 'v1' }]
    q2.add(`u/${A}/`, 'prefix')
    const sum = await purgeStorageQueue(q2, s2, { dryRun: false, ...quiet })
    assert.equal(sum.failed, 1)
    assert.equal(s2.deleted.length, 0)
    assert.match(q2.rows[0].last_error!, /unsafe key/)
  })
})

/* ---- live deletion ------------------------------------------------------- */

describe('видалення (live)', () => {
  test('object: усі версії точного ключа, не сусідній a.jpg.bak; запис позначено виконаним', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/g/G/o/a.jpg`, 3)
    s.put(`u/${A}/g/G/o/a.jpg.bak`)
    q.add(`u/${A}/g/G/o/a.jpg`, 'object')
    const sum = await purgeStorageQueue(q, s, { dryRun: false, ...quiet })
    assert.equal(sum.purged, 1)
    assert.equal(sum.versionsDeleted, 3)
    assert.equal(s.versions.has(`u/${A}/g/G/o/a.jpg`), false)
    assert.equal(s.versions.has(`u/${A}/g/G/o/a.jpg.bak`), true)
    assert.equal(q.rows[0].purged_at, 'now')
  })

  test('prefix: усе під u/<id>/ разом із версіями й незавершеними multipart; чужий акаунт цілий', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/brand/logo.png`, 2)
    s.put(`u/${A}/social/P/video.mp4`)
    s.put(`u/${B}/brand/logo.png`)
    s.multipart = [
      { key: `u/${A}/g/G/o/big.mp4`, uploadId: 'm1' },
      { key: `u/${B}/g/G/o/big.mp4`, uploadId: 'm2' },
    ]
    q.add(`u/${A}/`, 'prefix')
    const sum = await purgeStorageQueue(q, s, { dryRun: false, ...quiet })
    assert.equal(sum.purged, 1)
    assert.equal(sum.versionsDeleted, 3)
    assert.equal(sum.multipartAborted, 1)
    assert.deepEqual([...s.versions.keys()], [`u/${B}/brand/logo.png`])
    assert.deepEqual(s.aborted, [`u/${A}/g/G/o/big.mp4#m1`])
  })

  test('уже відсутній об’єкт — просто позначається виконаним', async () => {
    const q = new FakeQueue()
    q.add(`u/${A}/gone.jpg`, 'object')
    const sum = await purgeStorageQueue(q, new FakeBucket(), { dryRun: false, ...quiet })
    assert.equal(sum.purged, 1)
  })
})

/* ---- limits -------------------------------------------------------------- */

describe('ліміти за запуск', () => {
  test('maxRows іде в запит черги; maxDeletes обриває префікс, запис лишається і дочищається наступним запуском', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    for (let i = 0; i < 5; i++) s.put(`u/${A}/f${i}.jpg`)
    s.put(`u/${A}/z.jpg`)
    q.add(`u/${A}/`, 'prefix')
    q.add(`u/${A}/z.jpg`, 'object')

    const first = await purgeStorageQueue(q, s, { dryRun: false, maxRows: 10, maxDeletes: 3, ...quiet })
    assert.equal(q.lastLimit, 10)
    assert.equal(first.versionsDeleted, 3)
    assert.equal(first.partial, 1)
    assert.equal(first.purged, 0)
    assert.equal(first.truncated, true)
    assert.equal(q.rows[0].purged_at, null)
    assert.equal(q.rows[0].attempts, 0, 'нестача бюджету — не помилка')
    assert.equal(s.listCalls.length, 1, 'на другий запис бюджету не лишилось')

    const second = await purgeStorageQueue(q, s, { dryRun: false, maxDeletes: 100, ...quiet })
    assert.equal(second.purged, 2)
    assert.equal(s.versions.size, 0)
  })

  test('пагінація версій: понад 1000 версій під префіксом — усі видалені за один запуск', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    for (let i = 0; i < 1500; i++) s.put(`u/${A}/f${String(i).padStart(4, '0')}.jpg`)
    q.add(`u/${A}/`, 'prefix')
    const sum = await purgeStorageQueue(q, s, { dryRun: false, ...quiet })
    assert.equal(sum.versionsDeleted, 1500)
    assert.equal(sum.purged, 1)
  })

  test('рядків рівно maxRows — truncated', async () => {
    const q = new FakeQueue()
    for (let i = 0; i < 3; i++) q.add(`u/${A}/x${i}.jpg`, 'object')
    const sum = await purgeStorageQueue(q, new FakeBucket(), { dryRun: false, maxRows: 2, ...quiet })
    assert.equal(sum.rows, 2)
    assert.equal(sum.truncated, true)
    assert.equal(q.rows[2].purged_at, null)
  })
})

/* ---- retries ------------------------------------------------------------- */

describe('повторні спроби', () => {
  test('помилка B2 → attempts+1, last_error, Sentry; інші записи обробляються далі', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/bad.jpg`)
    s.put(`u/${A}/ok.jpg`)
    s.failDeleteFor = `u/${A}/bad`
    q.add(`u/${A}/bad.jpg`, 'object')
    q.add(`u/${A}/ok.jpg`, 'object')
    const reports: Record<string, unknown>[] = []
    const sum = await purgeStorageQueue(q, s, { dryRun: false, report: (_e, c) => reports.push(c), ...quiet })
    assert.equal(sum.failed, 1)
    assert.equal(sum.purged, 1)
    assert.equal(q.rows[0].attempts, 1)
    assert.match(q.rows[0].last_error!, /AccessDenied/)
    assert.equal(reports.length, 1)
    assert.equal(reports[0].attempts, 1)
  })

  test('після MAX спроб запис більше не чіпається і рахується як застряглий', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/bad.jpg`)
    s.failDeleteFor = `u/${A}/bad`
    q.add(`u/${A}/bad.jpg`, 'object', A, MAX_ATTEMPTS - 1)
    const last = await purgeStorageQueue(q, s, { dryRun: false, ...quiet })
    assert.equal(q.rows[0].attempts, MAX_ATTEMPTS)
    assert.equal(last.stuck, 1)

    s.listCalls = []
    const logs: string[] = []
    const next = await purgeStorageQueue(q, s, { dryRun: false, log: (m) => logs.push(m) })
    assert.equal(next.rows, 0)
    assert.equal(s.listCalls.length, 0)
    assert.equal(next.stuck, 1)
    assert.ok(logs.some((l) => /gave up after/.test(l)))
  })
})

/* ---- missing table ------------------------------------------------------- */

describe('таблиці ще немає (0057 не застосована)', () => {
  test('тихий вихід: skipped, без бакета, без помилок і Sentry', async () => {
    const q = new FakeQueue()
    q.missing = true
    const s = new FakeBucket()
    const reports: unknown[] = []
    const sum = await purgeStorageQueue(q, s, { dryRun: false, report: (e) => reports.push(e), ...quiet })
    assert.equal(sum.skipped, 'queue_table_missing')
    assert.equal(s.listCalls.length, 0)
    assert.equal(reports.length, 0)
  })

  test('розпізнавання помилки PostgREST/Postgres', () => {
    assert.equal(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.storage_purge_queue' in the schema cache" }), true)
    assert.equal(isMissingTableError({ code: '42P01', message: 'relation "public.storage_purge_queue" does not exist' }), true)
    assert.equal(isMissingTableError({ message: 'relation "storage_purge_queue" does not exist' }), true)
    assert.equal(isMissingTableError({ code: '57014', message: 'canceling statement due to statement timeout' }), false)
    assert.equal(isMissingTableError(null), false)
  })

  test('адаптер Supabase: PGRST205 → missingTable; інша помилка — виняток', async () => {
    const fakeAdmin = (error: { code: string; message: string }) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'lt', 'order', 'limit']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error })
      return { from: () => chain } as never
    }
    const missing = await supabasePurgeQueue(fakeAdmin({ code: 'PGRST205', message: 'Could not find the table' })).fetchPending(10, 5)
    assert.deepEqual(missing, { missingTable: true })
    await assert.rejects(
      supabasePurgeQueue(fakeAdmin({ code: '57014', message: 'timeout' })).fetchPending(10, 5),
      /read failed/
    )
  })
})

/* ---- dry-run ------------------------------------------------------------- */

describe('dry-run', () => {
  test('за замовчуванням увімкнений; live лише з STORAGE_PURGE_MODE=live; ?dry=1 перемагає', () => {
    assert.equal(purgeDryRun(undefined, false), true)
    assert.equal(purgeDryRun('', false), true)
    assert.equal(purgeDryRun('LIVE', false), true)
    assert.equal(purgeDryRun('true', false), true)
    assert.equal(purgeDryRun('live', false), false)
    assert.equal(purgeDryRun('live', true), true)
  })

  test('лише логує: нічого не видалено, нічого не записано в чергу', async () => {
    const q = new FakeQueue()
    const s = new FakeBucket()
    s.put(`u/${A}/a.jpg`, 2)
    s.multipart = [{ key: `u/${A}/big.mp4`, uploadId: 'm1' }]
    q.add(`u/${A}/`, 'prefix')
    q.add('', 'prefix', null)
    const logs: string[] = []
    const sum = await purgeStorageQueue(q, s, { dryRun: true, log: (m) => logs.push(m) })
    assert.equal(sum.mode, 'dry-run')
    assert.equal(sum.versionsWouldDelete, 2)
    assert.equal(sum.versionsDeleted, 0)
    assert.equal(s.deleted.length, 0)
    assert.equal(s.aborted.length, 0)
    assert.equal(q.writes, 0)
    assert.ok(logs.some((l) => l.includes('would delete 2 version(s)')))
    assert.ok(logs.some((l) => l.includes(`u/${A}/a.jpg @v1`)))
  })
})

/* ---- B2 provider (S3 client mocked) ------------------------------------- */

describe('B2: версії файлів', () => {
  const realSend = S3Client.prototype.send
  after(() => {
    S3Client.prototype.send = realSend
  })
  const b2 = () => new B2Provider({ region: 'eu-central-003', keyId: 'k', applicationKey: 's', bucket: 'b' })

  test('listObjectVersions повертає і версії, і hide-маркери, з маркерами продовження', async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = []
    S3Client.prototype.send = (async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, input: command.input })
      return {
        Versions: [{ Key: `u/${A}/a.jpg`, VersionId: '4_z1' }],
        DeleteMarkers: [{ Key: `u/${A}/a.jpg`, VersionId: '4_z2' }],
        IsTruncated: true,
        NextKeyMarker: `u/${A}/a.jpg`,
        NextVersionIdMarker: '4_z2',
      }
    }) as never
    const page = await b2().listObjectVersions(`u/${A}/`, { maxKeys: 500 })
    assert.equal(sent[0].name, 'ListObjectVersionsCommand')
    assert.equal(sent[0].input.Prefix, `u/${A}/`)
    assert.equal(sent[0].input.MaxKeys, 500)
    assert.deepEqual(page.versions, [
      { key: `u/${A}/a.jpg`, versionId: '4_z1' },
      { key: `u/${A}/a.jpg`, versionId: '4_z2' },
    ])
    assert.equal(page.truncated, true)
    assert.equal(page.nextVersionIdMarker, '4_z2')
  })

  test('deleteObjectVersions шле VersionId і падає, якщо B2 відмовив хоч одному', async () => {
    const inputs: Record<string, unknown>[] = []
    let errors: unknown[] = []
    S3Client.prototype.send = (async (command: { input: Record<string, unknown> }) => {
      inputs.push(command.input)
      return { Errors: errors }
    }) as never
    await b2().deleteObjectVersions([{ key: `u/${A}/a.jpg`, versionId: '4_z1' }])
    assert.deepEqual((inputs[0].Delete as { Objects: unknown[] }).Objects, [{ Key: `u/${A}/a.jpg`, VersionId: '4_z1' }])

    errors = [{ Key: `u/${A}/a.jpg`, Code: 'AccessDenied', Message: 'file is locked' }]
    await assert.rejects(b2().deleteObjectVersions([{ key: `u/${A}/a.jpg`, versionId: '4_z1' }]), /refused 1 of 1.*AccessDenied/)
  })

  test('провайдер придатний для обробника; без методів версій — явна помилка', () => {
    assert.doesNotThrow(() => asPurgeStorage(b2()))
    assert.throws(() => asPurgeStorage({}), /cannot list\/delete object versions/)
  })
})

/* ---- cron route ---------------------------------------------------------- */

describe('маршрут /api/cron/storage-purge', () => {
  const realFetch = globalThis.fetch
  after(() => {
    globalThis.fetch = realFetch
  })

  test('без CRON_SECRET у заголовку — 401; без таблиці — 200 skipped, B2 не викликається', async () => {
    process.env.CRON_SECRET = 'test-cron'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake-supabase.local'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
    process.env.STORAGE_PROVIDER = 'b2'
    process.env.B2_REGION = 'eu-central-003'
    process.env.B2_KEY_ID = 'k'
    process.env.B2_APPLICATION_KEY = 's'
    process.env.B2_BUCKET = 'b'
    delete process.env.STORAGE_PURGE_MODE
    const realSend = S3Client.prototype.send
    let s3Calls = 0
    S3Client.prototype.send = (async () => {
      s3Calls++
      return {}
    }) as never
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.storage_purge_queue' in the schema cache" }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch
    try {
      const { GET } = await import('@/app/api/cron/storage-purge/route')
      const { NextRequest } = await import('next/server')
      const denied = await GET(new NextRequest('http://x/api/cron/storage-purge'))
      assert.equal(denied.status, 401)

      const res = await GET(
        new NextRequest('http://x/api/cron/storage-purge', { headers: { authorization: 'Bearer test-cron' } })
      )
      assert.equal(res.status, 200)
      const body = (await res.json()) as { skipped?: string; mode: string }
      assert.equal(body.skipped, 'queue_table_missing')
      assert.equal(body.mode, 'dry-run')
      assert.equal(s3Calls, 0)
    } finally {
      S3Client.prototype.send = realSend
    }
  })
})

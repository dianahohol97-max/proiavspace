/**
 * In-memory stand-ins for the three things the upload path talks to:
 *   - the user's cookie-scoped Supabase client (passed in explicitly),
 *   - the service-role Supabase client (plain fetch to PostgREST — we
 *     intercept globalThis.fetch),
 *   - S3-compatible storage (B2) — we patch S3Client.prototype.send.
 * Nothing leaves the process. Every read waits a few ms so that concurrent
 * requests interleave the way they do on Vercel (read → read → insert).
 */
import { S3Client } from '@aws-sdk/client-s3'

export const FAKE_SUPABASE_URL = 'http://fake-supabase.local'

process.env.STORAGE_PROVIDER = 'b2'
process.env.B2_REGION = 'eu-central-003'
process.env.B2_KEY_ID = 'test-key-id'
process.env.B2_APPLICATION_KEY = 'test-app-key'
process.env.B2_BUCKET = 'test-bucket'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
delete process.env.MEDIA_CDN_URL

export const GB = 1024 * 1024 * 1024
export const MB = 1024 * 1024

type Row = Record<string, unknown>

export interface FakeDb {
  profiles: Row[]
  galleries: Row[]
  assets: Row[]
  gallery_imports: Row[]
}

export const db: FakeDb = { profiles: [], galleries: [], assets: [], gallery_imports: [] }

/** key → what "B2" holds. */
export const bucket = new Map<string, { sizeBytes: number; contentType: string }>()
export const deletedKeys: string[] = []

export function resetBackend(): void {
  db.profiles.length = 0
  db.galleries.length = 0
  db.assets.length = 0
  db.gallery_imports.length = 0
  bucket.clear()
  deletedKeys.length = 0
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 3))

/** The assets_storage_accounting trigger from migration 0001. */
function applyStorageDelta(asset: Row, sign: 1 | -1): void {
  const profile = db.profiles.find((p) => p.user_id === asset.owner_id)
  if (!profile) return
  const next = (profile.storage_used_bytes as number) + sign * (asset.size_bytes as number)
  profile.storage_used_bytes = Math.max(next, 0)
}

// ---- user client (the subset of the PostgREST builder the code uses) ------

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: [string, unknown][] = []
  constructor(private readonly table: keyof FakeDb) {}
  select(): this {
    return this
  }
  eq(column: string, value: unknown): this {
    this.filters.push([column, value])
    return this
  }
  private rows(): Row[] {
    return db[this.table].filter((row) => this.filters.every(([c, v]) => row[c] === v))
  }
  async single(): Promise<{ data: Row | null; error: unknown }> {
    await tick()
    const rows = this.rows()
    return rows.length === 1
      ? { data: structuredClone(rows[0]), error: null }
      : { data: null, error: { code: 'PGRST116' } }
  }
  async maybeSingle(): Promise<{ data: Row | null; error: unknown }> {
    await tick()
    const rows = this.rows()
    return { data: rows[0] ? structuredClone(rows[0]) : null, error: null }
  }
  then<A, B>(
    ok?: ((value: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    fail?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return tick()
      .then(() => ({ data: structuredClone(this.rows()), error: null }))
      .then(ok, fail)
  }
}

export function userClient(): { from(table: keyof FakeDb): Query } {
  return { from: (table) => new Query(table) }
}

// ---- service-role client: intercept PostgREST inserts into assets ---------

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== FAKE_SUPABASE_URL) return realFetch(input, init)
  await tick()
  const method = (init?.method ?? 'GET').toUpperCase()
  if (url.pathname === '/rest/v1/assets' && method === 'POST') {
    const body = JSON.parse(String(init?.body)) as Row | Row[]
    const row = Array.isArray(body) ? body[0] : body
    const clash =
      row.import_id &&
      db.assets.some((a) => a.gallery_id === row.gallery_id && a.original_name === row.original_name)
    if (clash) {
      return new Response(JSON.stringify({ code: '23505', message: 'duplicate key' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    }
    // enforce_storage_quota (migration 0045): the check and the insert are one
    // atomic step under the profile's row lock — nothing interleaves here.
    const profile = db.profiles.find((p) => p.user_id === row.owner_id)
    if (profile) {
      const graceOver =
        typeof profile.grace_until === 'string' && new Date(profile.grace_until).getTime() < Date.now()
      const limit = graceOver
        ? Math.min(profile.storage_limit_bytes as number, 3 * GB)
        : (profile.storage_limit_bytes as number)
      if ((profile.storage_used_bytes as number) + (row.size_bytes as number) > limit) {
        return new Response(JSON.stringify({ code: 'P0001', message: 'storage_quota_exceeded' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
    const inserted = { id: crypto.randomUUID(), ...row }
    db.assets.push(inserted)
    applyStorageDelta(inserted, 1)
    return new Response(JSON.stringify({ id: inserted.id }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ message: `fake: unhandled ${method} ${url.pathname}` }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}) as typeof fetch

// ---- storage: patch the S3 client ------------------------------------------

S3Client.prototype.send = async function send(command: {
  constructor: { name: string }
  input: Record<string, unknown>
}) {
  await tick()
  const name = command.constructor.name
  if (name === 'HeadObjectCommand') {
    const object = bucket.get(command.input.Key as string)
    if (!object) {
      throw Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } })
    }
    return { ContentLength: object.sizeBytes, ContentType: object.contentType }
  }
  if (name === 'DeleteObjectsCommand') {
    const objects = (command.input.Delete as { Objects: { Key: string }[] }).Objects
    for (const { Key } of objects) {
      bucket.delete(Key)
      deletedKeys.push(Key)
    }
    return {}
  }
  throw new Error(`fake S3: unhandled ${name}`)
} as unknown as S3Client['send']

// ---- fixtures ---------------------------------------------------------------

export function seedAccount(opts: {
  plan: string
  usedBytes: number
  limitBytes: number
  graceUntil?: string | null
}): { userId: string; galleryId: string } {
  const userId = crypto.randomUUID()
  const galleryId = crypto.randomUUID()
  db.profiles.push({
    user_id: userId,
    plan: opts.plan,
    storage_used_bytes: opts.usedBytes,
    storage_limit_bytes: opts.limitBytes,
    grace_until: opts.graceUntil ?? null,
  })
  db.galleries.push({ id: galleryId, owner_id: userId })
  return { userId, galleryId }
}

/** What the browser does after a presign: PUT the bytes straight into B2. */
export function putObject(key: string, sizeBytes: number, contentType = 'image/jpeg'): void {
  bucket.set(key, { sizeBytes, contentType })
}

export function usedBytes(userId: string): number {
  return db.profiles.find((p) => p.user_id === userId)?.storage_used_bytes as number
}

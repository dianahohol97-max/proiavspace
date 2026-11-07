/**
 * Альбоми × Backblaze B2: експорт отримує підписані B2-посилання на
 * ОРИГІНАЛИ (S3 SigV4, бакет proiav-media, us-east-005), ніколи не CDN, без
 * примусового «attachment» — інакше fetch() у браузері не зможе зібрати
 * розворот. Сам CORS бакета перевіряється руками (docs/albums/B2-CORS.md).
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, describe, mock, test } from 'node:test'

const ROOT = resolve(__dirname, '..', '..')
const ENV = {
  STORAGE_PROVIDER: 'b2',
  B2_REGION: 'us-east-005',
  B2_KEY_ID: '005fakekeyid0000000000001',
  B2_APPLICATION_KEY: 'K005fakeapplicationkeyfakeapplicationkey',
  B2_BUCKET: 'proiav-media',
  // CDN configured: originals must still bypass it.
  MEDIA_CDN_URL: 'https://media.proiav.space',
}
const saved: Record<string, string | undefined> = {}

const USER = '11111111-1111-4111-8111-111111111111'
const PROJECT = '22222222-2222-4222-8222-222222222222'
const GALLERY = '33333333-3333-4333-8333-333333333333'
const A1 = '44444444-4444-4444-8444-444444444444'
const A2 = '55555555-5555-4555-8555-555555555555'
const FOREIGN = '66666666-6666-4666-8666-666666666666'
const key = (id: string) => `u/${USER}/g/${GALLERY}/o/${id}-IMG_0001.jpg`

/** Minimal chainable stand-in for the user's Supabase client (RLS is tested in albums-db). */
function fakeSupabase() {
  const calls: { table: string; filters: [string, unknown][] }[] = []
  const builder = (table: string) => {
    const filters: [string, unknown][] = []
    calls.push({ table, filters })
    const result = () => {
      if (table === 'album_projects') return { data: { gallery_id: GALLERY }, error: null }
      if (table === 'assets') {
        const ids = (filters.find(([f]) => f === 'in:id')?.[1] as string[]) ?? []
        // RLS + gallery filter: a foreign id simply does not come back.
        return { data: ids.filter((id) => id !== FOREIGN).map((id) => ({ id, r2_key: key(id) })), error: null }
      }
      return { data: null, error: null }
    }
    const b = {
      select: () => b,
      eq: (f: string, v: unknown) => (filters.push([f, v]), b),
      in: (f: string, v: unknown) => (filters.push([`in:${f}`, v]), b),
      returns: () => b,
      maybeSingle: () => Promise.resolve(result()),
      then: (ok: (r: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, fail),
    }
    return b
  }
  return {
    calls,
    client: { auth: { getUser: async () => ({ data: { user: { id: USER } } }) }, from: builder },
  }
}

let fake: ReturnType<typeof fakeSupabase>
let signAlbumOriginals: typeof import('../../src/lib/actions/albums').signAlbumOriginals

before(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k]
    process.env[k] = v
  }
  fake = fakeSupabase()
  mock.module(pathToFileURL(resolve(ROOT, 'src/lib/supabase/server.ts')).href, {
    namedExports: { createSupabaseServerClient: () => fake.client },
  })
  mock.module('next/navigation', { namedExports: { redirect: () => { throw new Error('redirect') } } })
  ;({ signAlbumOriginals } = await import('../../src/lib/actions/albums'))
})
after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('альбоми: оригінали з B2 для експорту', () => {
  test('посилання — підписаний B2 S3 URL на оригінал, не CDN, без attachment', async () => {
    const r = await signAlbumOriginals(PROJECT, [A1, A2])
    assert.ok(r.ok, JSON.stringify(r))
    if (!r.ok) return
    assert.deepEqual(Object.keys(r.data).sort(), [A1, A2].sort())
    for (const id of [A1, A2]) {
      const url: URL = new URL(r.data[id]!)
      assert.equal(url.protocol, 'https:')
      // Virtual-hosted style on the B2 S3 endpoint of the bucket's region.
      assert.equal(url.host, 'proiav-media.s3.us-east-005.backblazeb2.com')
      assert.equal(decodeURIComponent(url.pathname.slice(1)), key(id))
      assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
      assert.match(url.searchParams.get('X-Amz-Credential') ?? '', /^005fakekeyid0000000000001\/\d{8}\/us-east-005\/s3\/aws4_request$/)
      assert.equal(url.searchParams.get('X-Amz-Expires'), String(15 * 60))
      assert.ok(url.searchParams.get('X-Amz-Signature'))
      assert.equal(url.searchParams.get('response-content-disposition'), null, 'attachment ламає fetch() не гірше за CORS')
      assert.ok(!r.data[id]!.startsWith(ENV.MEDIA_CDN_URL), 'оригінали ніколи не йдуть через CDN')
    }
  })

  test('лише фото галереї цього альбому і лише свої: чужий id не підписується', async () => {
    const r = await signAlbumOriginals(PROJECT, [A1, FOREIGN, 'not-a-uuid'])
    assert.ok(r.ok)
    if (!r.ok) return
    assert.deepEqual(Object.keys(r.data), [A1])
    const assetsCall = fake.calls.filter((c) => c.table === 'assets').pop()!
    assert.deepEqual(
      assetsCall.filters.filter(([f]) => f === 'owner_id' || f === 'gallery_id'),
      [['owner_id', USER], ['gallery_id', GALLERY]]
    )
  })
})

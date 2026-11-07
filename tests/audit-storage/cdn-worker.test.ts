/**
 * CDN-Worker (ops/cdn-worker): віддає лише варіанти /v/, оригінали й решта — 404;
 * сам підписує запит до приватного B2 (SigV4) і просить Cloudflare кешувати.
 */
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { handle, isServableKey, presignGet, signingWindowStart, type Env } from '../../ops/cdn-worker/src/index'
import { S3CompatProvider } from '@/lib/storage/R2Provider'

const U = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'
const G = '6fa459ea-ee8a-3ca4-894e-db77e160355e'
const V = '550e8400-e29b-41d4-a716-446655440000'

const env: Env = {
  B2_BUCKET: 'proiav-media',
  B2_REGION: 'us-east-005',
  B2_KEY_ID: '005readonlykeyid',
  B2_APPLICATION_KEY: 'K005readonlysecret',
}
const ctx = { waitUntil: () => {} }
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.MEDIA_CDN_URL
})

function stubOrigin(status = 200, body = 'jpegbytes') {
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(status === 200 ? body : 'x', {
      status,
      headers: { 'Content-Type': 'image/jpeg', ETag: '"abc"', 'CF-Cache-Status': 'MISS' },
    })
  }) as typeof fetch
  return calls
}

const get = (path: string, init?: RequestInit) => handle(new Request(`https://proiav-media.x.workers.dev/${path}`, init), env, ctx)

describe('CDN-Worker: які ключі віддає', () => {
  test('прев’ю, тумби й постери галереї та портфоліо — так', () => {
    for (const v of ['preview', 'thumb', 'poster', 'mobile']) {
      assert.ok(isServableKey(`u/${U}/g/${G}/v/${V}-${v}.jpg`), v)
      assert.ok(isServableKey(`u/${U}/portfolio/v/${V}-${v}.jpg`), v)
    }
  })

  test('легке прев’ю для телефонів …-mobile.webp — так; інші .webp і чужі розширення — ні', () => {
    assert.ok(isServableKey(`u/${U}/g/${G}/v/${V}-mobile.webp`))
    assert.ok(isServableKey(`u/${U}/portfolio/v/${V}-mobile.webp`))
    for (const key of [
      `u/${U}/g/${G}/v/${V}-preview.webp`,
      `u/${U}/g/${G}/v/${V}-thumb.webp`,
      `u/${U}/g/${G}/o/${V}-mobile.webp`,
      `u/${U}/g/${G}/v/${V}-mobile.png`,
      `u/${U}/g/${G}/v/${V}-mobile.webp.jpg/x`,
      `u/${U}/g/${G}/v/${V}-mobile.webpx`,
    ]) {
      assert.equal(isServableKey(key), false, key)
    }
  })

  test('mobile.webp віддається з типом із B2 (image/webp) і довгим кешем', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url))
      return new Response('webpbytes', { status: 200, headers: { 'Content-Type': 'image/webp', ETag: '"w"' } })
    }) as typeof fetch
    const res = await get(`u/${U}/g/${G}/v/${V}-mobile.webp`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Content-Type'), 'image/webp')
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
    assert.equal(new URL(calls[0]).pathname, `/proiav-media/u/${U}/g/${G}/v/${V}-mobile.webp`)
  })


  test('оригінали /o/, лого, відео для соцмереж, оригінали портфоліо, обхід шляху — ні', () => {
    for (const key of [
      `u/${U}/g/${G}/o/${V}-IMG_0001.jpg`,
      `u/${U}/g/${G}/o/${V}-preview.jpg`,
      `u/${U}/brand/${V}-logo.png`,
      `u/${U}/social/p1/video.mp4`,
      `u/${U}/portfolio/${V}-photo.jpg`,
      `u/${U}/g/${G}/v/../o/${V}-preview.jpg`,
      `u/${U}/g/${G}/v/${V}-original.jpg`,
      `u/${U}/g/${G}/v/${V}-preview.jpg/extra`,
      `x/${U}/g/${G}/v/${V}-preview.jpg`,
      '',
    ]) {
      assert.equal(isServableKey(key), false, key)
    }
  })

  test('запит на оригінал отримує 404 і не йде в B2', async () => {
    const calls = stubOrigin()
    for (const path of [`u/${U}/g/${G}/o/${V}-IMG.jpg`, `u/${U}/g/${G}/v/..%2Fo%2F${V}-preview.jpg`, 'favicon.ico', '']) {
      const res = await get(path)
      assert.equal(res.status, 404, path)
    }
    assert.equal(calls.length, 0)
  })

  test('POST/PUT/DELETE — 405', async () => {
    stubOrigin()
    const res = await get(`u/${U}/g/${G}/v/${V}-preview.jpg`, { method: 'DELETE' })
    assert.equal(res.status, 405)
  })
})

describe('CDN-Worker: підпис і кеш', () => {
  test('SigV4 збігається з AWS SDK (той самий підпис, що в застосунку)', async () => {
    const signingDate = new Date('2026-11-02T00:00:00Z')
    const key = `u/${U}/g/${G}/v/${V}-preview.jpg`
    const ours = await presignGet({
      endpoint: 'https://s3.us-east-005.backblazeb2.com',
      path: `/proiav-media/${key}`,
      region: 'us-east-005',
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
      signingDate,
      expiresSeconds: 604800,
      // What the SDK adds on top of the bare SigV4 presign — signed the same way.
      extraQuery: [
        ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
        ['x-amz-checksum-mode', 'ENABLED'],
        ['x-id', 'GetObject'],
      ],
    })
    const client = new S3Client({
      region: 'us-east-005',
      endpoint: 'https://s3.us-east-005.backblazeb2.com',
      forcePathStyle: true,
      credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APPLICATION_KEY },
    })
    const sdk = await getSignedUrl(client, new GetObjectCommand({ Bucket: 'proiav-media', Key: key }), {
      expiresIn: 604800,
      signingDate,
    })
    const sig = (u: string) => new URL(u).searchParams.get('X-Amz-Signature')
    assert.equal(sig(ours), sig(sdk))
    assert.equal(new URL(ours).pathname, new URL(sdk).pathname)
  })

  test('SigV4: еталонний приклад з документації AWS', async () => {
    const url = await presignGet({
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      signingDate: new Date('2013-05-24T00:00:00Z'),
      expiresSeconds: 86400,
    })
    assert.equal(
      new URL(url).searchParams.get('X-Amz-Signature'),
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    )
  })

  test('URL до B2 однаковий упродовж 6-денного вікна — ключ кешу Cloudflare стабільний', async () => {
    const base = Date.UTC(2026, 10, 3, 12)
    const a = signingWindowStart(base).getTime()
    const b = signingWindowStart(base + 60 * 60 * 1000).getTime()
    assert.equal(a, b)
    assert.ok(base - a < 6 * 24 * 3600 * 1000)
  })

  test('варіант: підписаний запит у приватний B2, cacheEverything, довгий кеш у браузері', async () => {
    const calls = stubOrigin()
    const res = await get(`u/${U}/g/${G}/v/${V}-thumb.jpg?bust=${Math.random()}`)
    assert.equal(res.status, 200)
    assert.equal(await res.text(), 'jpegbytes')
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
    assert.equal(res.headers.get('Content-Type'), 'image/jpeg')
    assert.equal(calls.length, 1)
    const origin = new URL(calls[0].url)
    assert.equal(origin.host, 's3.us-east-005.backblazeb2.com')
    assert.equal(origin.pathname, `/proiav-media/u/${U}/g/${G}/v/${V}-thumb.jpg`)
    assert.ok(origin.searchParams.get('X-Amz-Signature'))
    assert.equal(origin.searchParams.get('bust'), null, 'query з запиту клієнта не потрапляє в ключ кешу')
    const cf = (calls[0].init as { cf?: { cacheEverything?: boolean } }).cf
    assert.equal(cf?.cacheEverything, true)
  })

  test('відсутній у B2 файл — 404 з коротким кешем; збій B2 — 502 без кешу', async () => {
    stubOrigin(404)
    const missing = await get(`u/${U}/g/${G}/v/${V}-preview.jpg`)
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('Cache-Control'), 'public, max-age=60')
    stubOrigin(503)
    const broken = await get(`u/${U}/g/${G}/v/${V}-preview.jpg`)
    assert.equal(broken.status, 502)
    assert.equal(broken.headers.get('Cache-Control'), 'no-store')
  })

  test('If-None-Match → 304', async () => {
    stubOrigin()
    const res = await get(`u/${U}/g/${G}/v/${V}-preview.jpg`, { headers: { 'If-None-Match': '"abc"' } })
    assert.equal(res.status, 304)
  })
})

describe('застосунок з MEDIA_CDN_URL', () => {
  const provider = () =>
    new S3CompatProvider({
      endpoint: 'https://s3.us-east-005.backblazeb2.com',
      region: 'us-east-005',
      accessKeyId: 'k',
      secretAccessKey: 's',
      bucket: 'b',
    })

  test('варіанти /v/ — через CDN', async () => {
    process.env.MEDIA_CDN_URL = 'https://proiav-media.x.workers.dev/'
    const key = `u/${U}/g/${G}/v/${V}-preview.jpg`
    assert.equal(await provider().getSignedReadUrl(key), `https://proiav-media.x.workers.dev/${key}`)
    const pkey = `u/${U}/portfolio/v/${V}-thumb.jpg`
    assert.equal(await provider().getSignedReadUrl(pkey), `https://proiav-media.x.workers.dev/${pkey}`)
    const mkey = `u/${U}/g/${G}/v/${V}-mobile.webp`
    assert.equal(await provider().getSignedReadUrl(mkey), `https://proiav-media.x.workers.dev/${mkey}`)
  })

  test('оригінали, лого, відео для соцмереж, оригінали портфоліо — підписані посилання на B2', async () => {
    process.env.MEDIA_CDN_URL = 'https://proiav-media.x.workers.dev'
    for (const key of [
      `u/${U}/g/${G}/o/${V}-IMG.jpg`,
      `u/${U}/brand/${V}-logo.png`,
      `u/${U}/social/p1/video.mp4`,
      `u/${U}/portfolio/${V}-photo.jpg`,
    ]) {
      const url = await provider().getSignedReadUrl(key)
      assert.match(url, /^https:\/\/s3\.us-east-005\.backblazeb2\.com\/.*X-Amz-Signature=/, key)
    }
  })

  test('завантаження варіанта з downloadFileName — теж підписане', async () => {
    process.env.MEDIA_CDN_URL = 'https://proiav-media.x.workers.dev'
    const url = await provider().getSignedReadUrl(`u/${U}/g/${G}/v/${V}-preview.jpg`, { downloadFileName: 'a.jpg' })
    assert.match(url, /X-Amz-Signature=/)
  })
})

describe('CDN-Worker: готовий worker.js для дашборду', () => {
  test('ops/cdn-worker/dist/worker.js зібраний з поточного src/index.ts', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    // @ts-expect-error — plain .mjs build script without types
    const { buildWorker } = await import('../../ops/cdn-worker/build.mjs')
    const committed = readFileSync(join(__dirname, '..', '..', 'ops', 'cdn-worker', 'dist', 'worker.js'), 'utf8')
    assert.equal(committed, buildWorker(), 'перезбери: node ops/cdn-worker/build.mjs')
  })
})

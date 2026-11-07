/**
 * Блок 3 (очима клієнта) + 1.1 presign: як видаються URL на файли, пароль
 * галереї, архів «завантажити все». Мережі не потрібно: presign — це
 * локальний підпис, zip збирається в пам'яті (fetch підмінено).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { BlobReader, ZipReader } from '@zip.js/zip.js'
import { buildZipBlob, splitIntoParts, writeZipToStream } from '@/lib/gallery/archive'
import { B2Provider } from '@/lib/storage/R2Provider'

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

process.env.GALLERY_UNLOCK_SECRET = 'test-unlock-secret'

function provider() {
  return new B2Provider({
    region: 'eu-central-003',
    keyId: 'test-key-id',
    applicationKey: 'test-app-key',
    bucket: 'test-bucket',
  })
}

describe('presigned URL (B2, S3 SigV4)', () => {
  test('ST-02: presigned PUT підписує розмір (content-length) — PUT іншого розміру B2 відхилить', async () => {
    const { url } = await provider().getUploadUrl({
      key: 'u/a/g/b/o/x.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024 * 1024,
    })
    const signed = new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? ''
    assert.match(signed, /content-length/, `SignedHeaders=${signed}`)
  })

  test('ST-02: обидва presign-роути передають sizeBytes у getUploadUrl', () => {
    for (const route of ['src/app/api/uploads/presign/route.ts', 'src/app/api/portfolio/presign/route.ts']) {
      assert.match(source(route), /getUploadUrl\(\{[^}]*sizeBytes: body\.sizeBytes/, route)
    }
  })

  test('presigned PUT живе 10 хв', async () => {
    const { url } = await provider().getUploadUrl({ key: 'k', contentType: 'image/jpeg' })
    assert.equal(new URL(url).searchParams.get('X-Amz-Expires'), '600')
  })

  test('«Завантажити оригінал»: підписаний URL на 5 хв з Content-Disposition: attachment', async () => {
    delete process.env.MEDIA_CDN_URL
    const url = new URL(
      await provider().getSignedReadUrl('u/a/g/b/o/uuid-IMG.jpg', {
        expiresInSeconds: 5 * 60,
        downloadFileName: 'IMG.jpg',
      })
    )
    assert.equal(url.searchParams.get('X-Amz-Expires'), '300')
    assert.match(url.searchParams.get('response-content-disposition') ?? '', /attachment/)
  })

  test('без MEDIA_CDN_URL прев’ю в галереї — підписані на 1 год (у проді змінна не задана)', async () => {
    delete process.env.MEDIA_CDN_URL
    const url = new URL(await provider().getSignedReadUrl('u/a/g/b/v/p.jpg', { expiresInSeconds: 3600 }))
    assert.equal(url.searchParams.get('X-Amz-Expires'), '3600')
  })

  test('прев’ю: той самий URL при кожному рендері в межах вікна — браузер бере з кешу, а не качає з B2 знову', async () => {
    delete process.env.MEDIA_CDN_URL
    const a = await provider().getSignedReadUrl('u/a/g/b/v/p.jpg', { expiresInSeconds: 3600 })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const b = await provider().getSignedReadUrl('u/a/g/b/v/p.jpg', { expiresInSeconds: 3600 })
    // Межа 15-хв вікна могла випасти рівно між викликами — тоді ще раз.
    const c = a === b ? b : await provider().getSignedReadUrl('u/a/g/b/v/p.jpg', { expiresInSeconds: 3600 })
    assert.equal(b, c)
    assert.equal(new URL(b).searchParams.get('response-cache-control'), 'private, max-age=2700')
  })

  test('прев’ю: підписане не раніше ніж 1/4 TTL тому — URL живе щонайменше 45 хв', async () => {
    const url = new URL(await provider().getSignedReadUrl('u/a/g/b/v/p.jpg', { expiresInSeconds: 3600 }))
    const d = url.searchParams.get('X-Amz-Date') ?? ''
    const signedAt = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13), +d.slice(13, 15))
    const left = signedAt + 3600 * 1000 - Date.now()
    assert.ok(left >= 45 * 60 * 1000 - 1000, `лишилось ${Math.round(left / 1000)} с`)
  })

  test('[CL-04] з MEDIA_CDN_URL оригінали для архіву мають лишатися підписаними й короткоживучими', async () => {
    process.env.MEDIA_CDN_URL = 'https://cdn.example'
    try {
      // Саме так кличе /api/galleries/[slug]/archive-urls: оригінал, 15 хв, без downloadFileName.
      const url = await provider().getSignedReadUrl('u/a/g/b/o/uuid-IMG.jpg', { expiresInSeconds: 15 * 60 })
      assert.match(
        url,
        /X-Amz-Signature=/,
        `отримали ${url}: вічне публічне посилання на оригінал (і трафік через платний CDN)`
      )
    } finally {
      delete process.env.MEDIA_CDN_URL
    }
  })
})

describe('галерея з паролем', () => {
  test('cookie розблокування = HMAC(galleryId, хеш пароля), підробити без секрету не можна', async () => {
    const { unlockCookieValue } = await import('@/lib/gallery-access')
    const a = unlockCookieValue('11111111-1111-1111-1111-111111111111', 'hash-1')
    const b = unlockCookieValue('22222222-2222-2222-2222-222222222222', 'hash-1')
    assert.match(a, /^[0-9a-f]{64}$/)
    assert.notEqual(a, b)
  })

  test('scrypt: правильний пароль проходить, неправильний — ні', async () => {
    const { hashPassword, verifyPassword } = await import('@/lib/password')
    const stored = hashPassword('Весілля2026')
    assert.equal(verifyPassword('Весілля2026', stored), true)
    assert.equal(verifyPassword('весілля2026', stored), false)
  })

  test('[CL-05] зміна пароля галереї відкликає видані cookie', async () => {
    const { unlockCookieValue } = await import('@/lib/gallery-access')
    const id = '11111111-1111-1111-1111-111111111111'
    // Той самий id, інший хеш (новий пароль) → старе cookie вже не підходить.
    assert.notEqual(unlockCookieValue(id, 'scrypt$old'), unlockCookieValue(id, 'scrypt$new'))
    const route = source('src/app/api/galleries/[slug]/unlock/route.ts')
    assert.match(route, /unlockCookieValue\([^)]*password_hash/, 'cookie не прив’язане до хешу пароля')
    const access = source('src/lib/gallery-access.ts')
    assert.match(access, /select\('password_hash'\)/, 'перевірка cookie не читає поточний хеш')
  })

  test('[RL-01] перебір пароля: /unlock має обмеження частоти (Vercel Firewall)', () => {
    // Рішення: rate limit на рівні Vercel Firewall (план Pro), не в коді.
    // Правила лежать у ops/vercel-firewall-rules.json; що вони застосовані в
    // проді — у ручному чек-листі PR 2.
    const { rules } = JSON.parse(source('ops/vercel-firewall-rules.json')) as {
      rules: {
        active: boolean
        conditionGroup: { conditions: { type: string; op: string; value: string }[] }[]
        action: { mitigate: { action: string; rateLimit: { limit: number; window: number; keys: string[] } } }
      }[]
    }
    const limitFor = (path: string, method = 'POST') =>
      rules.find(
        (r) =>
          r.active &&
          r.action.mitigate.action === 'rate_limit' &&
          r.action.mitigate.rateLimit.keys.includes('ip') &&
          r.conditionGroup.some((g) =>
            g.conditions.every((c) =>
              c.type === 'path'
                ? c.op === 're'
                  ? new RegExp(c.value).test(path)
                  : c.op === 'pre'
                    ? path.startsWith(c.value)
                    : c.op === 'eq' && path === c.value
                : c.type === 'method'
                  ? c.value === method
                  : false
            )
          )
      )?.action.mitigate.rateLimit
    const unlock = limitFor('/api/galleries/vesillia-2026/unlock')
    assert.ok(unlock, 'немає правила для /unlock')
    assert.ok(unlock.limit / unlock.window <= 20 / 60, 'ліміт для /unlock завеликий')
    assert.ok(limitFor('/api/uploads/presign'), 'немає правила для /api/uploads/*')
    assert.ok(limitFor('/api/booking/book'), 'немає правила для форми бронювання')
    assert.ok(limitFor('/api/sites/lead'), 'немає правила для форми сайту')
  })
})

describe('архів «завантажити все» (zip.js у браузері)', () => {
  const bytes = (n: number, fill = 7) => new Uint8Array(new ArrayBuffer(n)).fill(fill)
  const fakeFetch = (bodies: Record<string, Uint8Array<ArrayBuffer>>) => async (url: string) =>
    new Response(bodies[url])

  test('кілька файлів — коректний zip, читається назад з тими самими байтами', async () => {
    const files = ['001-a.jpg', '002-b.jpg', '003-c.mp4'].map((name, i) => ({ name, url: `u${i}` }))
    let done = 0
    const blob = await buildZipBlob(
      files,
      () => done++,
      fakeFetch({ u0: bytes(1024, 1), u1: bytes(2048, 2), u2: bytes(10, 3) })
    )
    assert.equal(done, 3)
    const entries = await new ZipReader(new BlobReader(blob)).getEntries()
    assert.deepEqual(entries.map((e) => e.filename), ['001-a.jpg', '002-b.jpg', '003-c.mp4'])
    assert.deepEqual(entries.map((e) => e.uncompressedSize), [1024, 2048, 10])
  })

  test('частини для Safari/Firefox/телефонів: не більше ліміту, великий файл — окремо', () => {
    const f = (name: string, size: number) => ({ name, url: name, size })
    const parts = splitIntoParts([f('a', 300), f('b', 300), f('c', 900), f('d', 100), f('e', 100)], 500)
    assert.deepEqual(parts.map((p) => p.map((x) => x.name)), [['a'], ['b'], ['c'], ['d', 'e']])
    assert.deepEqual(splitIntoParts([], 500), [])
  })

  test(
    '[CL-01] галерея > 4 ГБ: zip має лишатися читабельним (ZIP64)',
    { timeout: 240_000 },
    async () => {
      // Типова весільна галерея — 10–30 ГБ оригіналів. Женемо 4 ГБ + 1 байт
      // нулів потоком (нічого не тримаємо в пам'яті, крім хвоста).
      const block = new Uint8Array(64 * 1024 * 1024)
      const bigStream = () => {
        let left = 4 * 1024 ** 3 + 1
        return new ReadableStream<Uint8Array>({
          pull(controller) {
            if (left <= 0) return controller.close()
            const n = Math.min(left, block.length)
            controller.enqueue(n === block.length ? block : block.subarray(0, n))
            left -= n
          },
        })
      }
      let total = 0
      let tail = Buffer.alloc(0)
      const sink = new WritableStream<Uint8Array>({
        write(chunk) {
          total += chunk.length
          tail = Buffer.concat([tail, Buffer.from(chunk)]).subarray(-4096)
        },
      })
      const fetcher = async (url: string) =>
        url === 'big' ? new Response(bigStream()) : new Response(bytes(10))
      await writeZipToStream(
        [
          { name: '001-video.mp4', url: 'big' },
          { name: '002-photo.jpg', url: 'small' },
        ],
        sink,
        () => {},
        fetcher
      )

      // ZIP64: справжні зсуви лежать у zip64-записі кінця центрального каталогу.
      const zip64Eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]))
      assert.ok(zip64Eocd >= 0, 'немає zip64 end of central directory — архів понад 4 ГБ битий')
      const cdSize = Number(tail.readBigUInt64LE(zip64Eocd + 40))
      const cdOffset = Number(tail.readBigUInt64LE(zip64Eocd + 48))
      const zip64EocdAbsolute = total - tail.length + zip64Eocd
      assert.equal(cdOffset + cdSize, zip64EocdAbsolute, 'зсув центрального каталогу не збігається — архів битий')
      assert.ok(cdOffset > 4 * 1024 ** 3, 'каталог має лежати за межею 4 ГБ')
    }
  )

  test('[CL-02] без showSaveFilePicker (Safari, Firefox, мобільні) архів не має збиратися цілком у RAM', () => {
    const ui = source('src/components/gallery/GalleryExperience.tsx')
    assert.equal(
      /chunks\.push\(chunk\)[\s\S]{0,200}new Blob\(chunks/.test(ui),
      false,
      'fallback складає весь zip у масив chunks → 10–30 ГБ у пам’яті вкладки'
    )
    assert.match(ui, /splitIntoParts\(/, 'без save-file stream архів має йти частинами')
  })

  test('[CL-03] посилання архіву мають жити довше, ніж качається велика галерея', () => {
    const route = source('src/app/api/galleries/[slug]/archive-urls/route.ts')
    const ttl = Number(/getSignedReadUrl\([^)]*expiresInSeconds:\s*([\d\s*]+)/.exec(route)?.[1]?.split('*').reduce((a, b) => a * Number(b), 1))
    // 2 500 фото × 12 МБ на 50 Мбіт/с ≈ 80 хв; файли качаються послідовно,
    // а всі URL видаються разом на старті.
    const secondsNeeded = (2500 * 12 * 8) / 50
    assert.ok(ttl >= secondsNeeded, `TTL ${ttl} с < потрібних ~${Math.round(secondsNeeded)} с — хвіст архіву отримає 403`)
  })
})

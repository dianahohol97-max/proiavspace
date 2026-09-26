/**
 * Блок 3 (очима клієнта) + 1.1 presign: як видаються URL на файли, пароль
 * галереї, архів «завантажити все». Мережі не потрібно: presign — це
 * локальний підпис, zip збирається в пам'яті.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { Zip, ZipPassThrough } from 'fflate'
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
  test('cookie розблокування = HMAC(galleryId), підробити без секрету не можна', async () => {
    const { unlockCookieValue } = await import('@/lib/gallery-access')
    const a = unlockCookieValue('11111111-1111-1111-1111-111111111111')
    const b = unlockCookieValue('22222222-2222-2222-2222-222222222222')
    assert.match(a, /^[0-9a-f]{64}$/)
    assert.notEqual(a, b)
  })

  test('scrypt: правильний пароль проходить, неправильний — ні', async () => {
    const { hashPassword, verifyPassword } = await import('@/lib/password')
    const stored = hashPassword('Весілля2026')
    assert.equal(verifyPassword('Весілля2026', stored), true)
    assert.equal(verifyPassword('весілля2026', stored), false)
  })

  test('[CL-05] зміна пароля галереї має відкликати видані cookie (зараз вони живуть 30 днів)', async () => {
    const { unlockCookieValue } = await import('@/lib/gallery-access')
    const route = source('src/app/api/galleries/[slug]/unlock/route.ts')
    // Значення cookie залежить лише від id галереї — пароль/хеш у підпис не входить.
    assert.equal(unlockCookieValue.length, 1)
    assert.match(route, /password_hash[^\n]*unlockCookieValue|unlockCookieValue\([^)]*hash/, 'cookie не прив’язане до хешу пароля')
  })

  test('[RL-01] перебір пароля: /unlock має обмеження частоти', () => {
    const route = source('src/app/api/galleries/[slug]/unlock/route.ts')
    assert.match(route, /rate|limit|attempt/i, 'кожна спроба — повний scrypt (~50 мс CPU) без ліміту')
  })
})

describe('архів «завантажити все» (fflate у браузері)', () => {
  test('кілька файлів — коректний zip (сигнатури, кількість записів)', () => {
    const chunks: Uint8Array[] = []
    const zip = new Zip((error, chunk) => {
      if (error) throw error
      chunks.push(chunk)
    })
    for (const name of ['001-a.jpg', '002-b.jpg', '003-c.mp4']) {
      const entry = new ZipPassThrough(name)
      zip.add(entry)
      entry.push(new Uint8Array(1024).fill(7), true)
    }
    zip.end()
    const out = Buffer.concat(chunks)
    const eocd = out.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    assert.ok(eocd > 0)
    assert.equal(out.readUInt16LE(eocd + 10), 3)
  })

  test(
    '[CL-01] галерея > 4 ГБ: zip має лишатися читабельним (ZIP64)',
    { timeout: 120_000 },
    () => {
      // Типова весільна галерея — 10–30 ГБ оригіналів. Женемо 4 ГБ + 1 байт
      // нулів потоком (нічого не тримаємо в пам'яті, крім хвоста).
      let total = 0
      let tail = Buffer.alloc(0)
      const zip = new Zip((error, chunk) => {
        if (error) throw error
        total += chunk.length
        tail = Buffer.concat([tail, Buffer.from(chunk)]).subarray(-4096)
      })
      const big = new ZipPassThrough('001-video.mp4')
      zip.add(big)
      const block = new Uint8Array(64 * 1024 * 1024)
      let left = 4 * 1024 ** 3 + 1
      while (left > 0) {
        const n = Math.min(left, block.length)
        big.push(n === block.length ? block : block.subarray(0, n))
        left -= n
      }
      big.push(new Uint8Array(0), true)
      const small = new ZipPassThrough('002-photo.jpg')
      zip.add(small)
      small.push(new Uint8Array(10), true)
      zip.end()

      const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
      const cdSize = tail.readUInt32LE(eocd + 12)
      const cdOffsetRecorded = tail.readUInt32LE(eocd + 16)
      const cdOffsetReal = total - 22 - cdSize
      assert.equal(
        cdOffsetRecorded,
        cdOffsetReal,
        `у zip записано зсув ${cdOffsetRecorded}, справжній ${cdOffsetReal} — 32-бітне переповнення, архів битий`
      )
    }
  )

  test('[CL-02] без showSaveFilePicker (Safari, Firefox, мобільні) архів не має збиратися цілком у RAM', () => {
    const ui = source('src/components/gallery/GalleryExperience.tsx')
    assert.equal(
      /chunks\.push\(chunk\)[\s\S]{0,200}new Blob\(chunks/.test(ui),
      false,
      'fallback складає весь zip у масив chunks → 10–30 ГБ у пам’яті вкладки'
    )
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

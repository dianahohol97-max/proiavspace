/**
 * Легкий варіант `mobile` для ПОРТФОЛІО сайту (Реліз 4, «Тиша»): той самий
 * WebP ~1080 px (JPEG, де браузер не вміє WebP), що й у галереях, у
 * portfolio_assets.variants (jsonb) — без міграції. Перевіряємо: ключі під
 * …/portfolio/v/ і їх пускає CDN Worker; complete приймає mobile і лише свої
 * ключі; облік місця рахує тільки оригінал; видалення фото і крон очищення
 * прибирають mobile так само, як preview; сайт віддає «mobile 1080w, preview 2048w».
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import { isServableKey } from '../../ops/cdn-worker/src/index'
import { mobilePreviewSrcSet, renditionWidth } from '@/lib/images/srcset'
import { parsePortfolioComplete, portfolioAssetRow } from '@/lib/portfolio-upload'
import {
  portfolioDeleteKeys,
  portfolioKeysOwned,
  portfolioPrefix,
  portfolioVariantKey,
} from '@/lib/storage'
import { isMediaKey, orphanKeys, referencedKeys } from '@/lib/storage/cleanup'

const U = '6f1c2b8e-4a1d-4c3e-9b7a-1f2e3d4c5b6a'
const MB = 1024 * 1024
const root = path.resolve(__dirname, '../..')
const source = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

describe('ключі mobile у портфоліо', () => {
  test('…/portfolio/v/<uuid>-mobile.webp, або .jpg без WebP-кодера', () => {
    assert.match(portfolioVariantKey(U, 'mobile', 'image/webp'), new RegExp(`^u/${U}/portfolio/v/[0-9a-f-]{36}-mobile\\.webp$`))
    assert.match(portfolioVariantKey(U, 'mobile', 'image/jpeg'), new RegExp(`^u/${U}/portfolio/v/[0-9a-f-]{36}-mobile\\.jpg$`))
    assert.match(portfolioVariantKey(U, 'preview'), /-preview\.jpg$/)
  })

  test('CDN Worker пускає mobile портфоліо (webp і jpg); оригінали портфоліо — ні', () => {
    assert.ok(isServableKey(portfolioVariantKey(U, 'mobile', 'image/webp')))
    assert.ok(isServableKey(portfolioVariantKey(U, 'mobile', 'image/jpeg')))
    assert.ok(isServableKey(portfolioVariantKey(U, 'preview', 'image/jpeg')))
    assert.equal(isServableKey(`${portfolioPrefix(U)}${crypto.randomUUID()}-IMG.jpg`), false)
  })

  test('presign портфоліо будує ключ варіанта через portfolioVariantKey', () => {
    assert.match(source('src/app/api/portfolio/presign/route.ts'), /portfolioVariantKey\(user\.id, body\.variant/)
  })

  test('клієнт завантаження портфоліо просить mobile і шле його з власним типом', () => {
    const editor = source('src/components/site-editor/SiteEditor.tsx')
    assert.match(editor, /generateImageVariants\(file, undefined, \{ mobile: true \}\)/)
    assert.match(editor, /presign\(rendition\.name, rendition\.blob, rendition\.contentType\)/)
    assert.match(editor, /'Content-Type': rendition\.contentType/)
  })
})

describe('complete портфоліо з mobile', () => {
  const variants = {
    preview: portfolioVariantKey(U, 'preview', 'image/jpeg'),
    thumb: portfolioVariantKey(U, 'thumb', 'image/jpeg'),
    mobile: portfolioVariantKey(U, 'mobile', 'image/webp'),
  }
  const original = `${portfolioPrefix(U)}${crypto.randomUUID()}-IMG.jpg`

  test('приймає variants.mobile; невідомі назви — ні', () => {
    const base = { key: original, contentType: 'image/jpeg', sizeBytes: 9 * MB }
    assert.ok(parsePortfolioComplete({ ...base, variants }))
    assert.equal(parsePortfolioComplete({ ...base, variants: { huge: 'x' } }), null)
  })

  test('mobile під чужим префіксом — відмова (key_mismatch)', () => {
    assert.ok(portfolioKeysOwned(U, original, variants))
    const foreign = portfolioVariantKey('someone-else', 'mobile', 'image/webp')
    assert.equal(portfolioKeysOwned(U, original, { ...variants, mobile: foreign }), false)
  })

  test('облік місця: у рядку лише розмір оригіналу, mobile — просто ключ у variants', () => {
    const row = portfolioAssetRow(U, { key: original, contentType: 'image/jpeg', sizeBytes: 9 * MB, variants })
    assert.equal(row.size_bytes, 9 * MB)
    assert.deepEqual(row.variants, variants)
    assert.equal(row.owner_id, U)
  })
})

describe('видалення і очищення з mobile портфоліо', () => {
  const old = new Date(Date.now() - 3 * 24 * 3600 * 1000)

  test('видалення фото: оригінал + preview + thumb + mobile; нічого поза префіксом власника', () => {
    const asset = {
      r2_key: `${portfolioPrefix(U)}1-IMG.jpg`,
      variants: {
        preview: `${portfolioPrefix(U)}v/1-preview.jpg`,
        thumb: `${portfolioPrefix(U)}v/1-thumb.jpg`,
        mobile: `${portfolioPrefix(U)}v/1-mobile.webp`,
        evil: 'u/victim/portfolio/v/9-mobile.webp',
      },
    }
    const keys = portfolioDeleteKeys(U, asset)
    assert.ok(keys.includes(asset.variants.mobile))
    assert.equal(keys.length, 4)
    assert.equal(keys.includes(asset.variants.evil), false)
    assert.match(source('src/lib/actions/portfolio.ts'), /portfolioDeleteKeys\(user\.id, asset\)/)
  })

  test('крон: mobile, на який посилається portfolio_assets, лишається; осиротілий — видаляється', () => {
    const live = `${portfolioPrefix(U)}v/1-mobile.webp`
    const orphan = `${portfolioPrefix(U)}v/2-mobile.webp`
    assert.ok(isMediaKey(orphan))
    const refs = referencedKeys([{ r2_key: `${portfolioPrefix(U)}1-a.jpg`, variants: { preview: 'p', mobile: live } }])
    assert.deepEqual(
      orphanKeys(
        [
          { key: live, sizeBytes: 1, lastModified: old },
          { key: orphan, sizeBytes: 1, lastModified: old },
        ],
        refs
      ),
      [orphan]
    )
    // Крон читає обидві таблиці, тож referencedKeys бачить і portfolio_assets.
    assert.match(source('src/app/api/cron/storage-cleanup/route.ts'), /'assets', 'portfolio_assets'/)
  })

  test('видалення акаунта (retention) бере весь u/<id>/portfolio/ — mobile теж', () => {
    assert.ok(portfolioVariantKey(U, 'mobile', 'image/webp').startsWith(portfolioPrefix(U)))
    assert.match(source('src/app/api/cron/storage-retention/route.ts'), /`u\/\$\{userId\}\/portfolio\/`/)
  })
})

describe('srcset на сайті', () => {
  test('mobile 1080w + preview 2048w за справжніми ширинами; без mobile — нічого', () => {
    assert.equal(
      mobilePreviewSrcSet({ mobileUrl: 'm', previewUrl: 'p', width: 6000, height: 4000 }),
      'm 1080w, p 2048w'
    )
    // вертикальний кадр: найдовша сторона 1080 → ширина 720
    assert.equal(
      mobilePreviewSrcSet({ mobileUrl: 'm', previewUrl: 'p', width: 4000, height: 6000 }),
      'm 720w, p 1365w'
    )
    assert.equal(mobilePreviewSrcSet({ mobileUrl: null, previewUrl: 'p' }), undefined)
    // маленький оригінал: обидва варіанти однакові — лишається лише легкий
    assert.equal(mobilePreviewSrcSet({ mobileUrl: 'm', previewUrl: 'p', width: 900, height: 600 }), 'm 900w')
    assert.equal(renditionWidth(1080, null, null), 1080)
  })
})

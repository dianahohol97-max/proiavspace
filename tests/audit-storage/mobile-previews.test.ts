/**
 * Легке прев’ю для телефонів (docs/MOBILE_PREVIEWS.md): варіант `mobile`
 * (WebP ~1080 px) живе в тому самому `assets.variants` (jsonb), що й preview,
 * тож без міграції. Тут перевіряємо, що з ним облік місця, перевірки complete,
 * крон очищення й видалення галереї працюють так само, як з preview/thumb.
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseRegisterAssetInput, registerAsset } from '@/lib/uploads'
import {
  galleryPrefix,
  isVariantContentType,
  isVariantName,
  variantExtension,
  variantKey,
} from '@/lib/storage'
import { isMediaKey, orphanKeys, referencedKeys } from '@/lib/storage/cleanup'
import {
  GB,
  MB,
  bucket,
  db,
  deletedKeys,
  putObject,
  resetBackend,
  seedAccount,
  userClient,
  usedBytes,
} from './helpers/fake-backend'

const client = () => userClient() as unknown as SupabaseClient
const KB = 1024

beforeEach(resetBackend)

function upload(userId: string, galleryId: string, originalBytes: number, mobileBytes = 150 * KB) {
  const prefix = galleryPrefix(userId, galleryId)
  const key = `${prefix}o/${crypto.randomUUID()}-IMG.jpg`
  const variants = {
    preview: variantKey(userId, galleryId, 'preview', 'image/jpeg'),
    thumb: variantKey(userId, galleryId, 'thumb', 'image/jpeg'),
    mobile: variantKey(userId, galleryId, 'mobile', 'image/webp'),
  }
  putObject(key, originalBytes)
  putObject(variants.preview, 700 * KB)
  putObject(variants.thumb, 60 * KB)
  putObject(variants.mobile, mobileBytes, 'image/webp')
  return { key, variants }
}

describe('ключі варіанта mobile', () => {
  test('mobile — відома назва варіанта; ключ під …/v/ з розширенням за типом', () => {
    assert.ok(isVariantName('mobile'))
    const webp = variantKey('U', 'G', 'mobile', 'image/webp')
    const jpeg = variantKey('U', 'G', 'mobile', 'image/jpeg')
    assert.match(webp, /^u\/U\/g\/G\/v\/[0-9a-f-]{36}-mobile\.webp$/)
    // Safari без WebP-кодера: той самий варіант, але JPEG.
    assert.match(jpeg, /^u\/U\/g\/G\/v\/[0-9a-f-]{36}-mobile\.jpg$/)
    // Старі варіанти не змінились.
    assert.match(variantKey('U', 'G', 'preview'), /-preview\.jpg$/)
    assert.equal(variantExtension('image/webp'), 'webp')
    assert.equal(variantExtension(undefined), 'jpg')
  })

  test('presign варіантів приймає лише JPEG і WebP', () => {
    assert.ok(isVariantContentType('image/jpeg'))
    assert.ok(isVariantContentType('image/webp'))
    for (const type of ['image/png', 'image/svg+xml', 'image/heic', 'video/mp4', 'text/html']) {
      assert.equal(isVariantContentType(type), false, type)
    }
  })

  test('complete приймає variants.mobile; невідомі назви — ні', () => {
    const base = { galleryId: 'g', key: 'k', contentType: 'image/jpeg', sizeBytes: 1 }
    assert.ok(parseRegisterAssetInput({ ...base, variants: { preview: 'a', mobile: 'b' } }))
    assert.equal(parseRegisterAssetInput({ ...base, variants: { huge: 'b' } }), null)
  })
})

describe('облік місця (storage_used_bytes) з варіантом mobile', () => {
  test('рахується лише оригінал — як і раніше для preview/thumb', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 1 * GB, limitBytes: 100 * GB })
    const { key, variants } = upload(userId, galleryId, 12 * MB)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 12 * MB,
      variants,
    })
    assert.equal(result.ok, true)
    assert.equal(usedBytes(userId), 1 * GB + 12 * MB)
    assert.equal(db.assets.length, 1)
    assert.deepEqual(db.assets[0].variants, variants)
    assert.equal(db.assets[0].size_bytes, 12 * MB)
  })

  test('mobile більший за 25 МБ — complete відхиляє і прибирає всі ключі, місце не змінилось', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const { key, variants } = upload(userId, galleryId, 5 * MB, 30 * MB)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 5 * MB,
      variants,
    })
    assert.deepEqual(result, { ok: false, status: 400, error: 'invalid_variant' })
    assert.equal(usedBytes(userId), 0)
    assert.deepEqual(new Set(deletedKeys), new Set([key, ...Object.values(variants)]))
    assert.equal(bucket.size, 0)
  })

  test('mobile під чужим префіксом — key_mismatch, чуже не видаляємо', async () => {
    const victim = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const attacker = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const foreign = variantKey(victim.userId, victim.galleryId, 'mobile', 'image/webp')
    putObject(foreign, 100 * KB, 'image/webp')
    const own = upload(attacker.userId, attacker.galleryId, 1 * MB)
    const result = await registerAsset(client(), attacker.userId, {
      galleryId: attacker.galleryId,
      key: own.key,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
      variants: { ...own.variants, mobile: foreign },
    })
    assert.deepEqual(result, { ok: false, status: 400, error: 'key_mismatch' })
    assert.equal(bucket.has(foreign), true)
  })
})

describe('очищення і видалення з варіантом mobile', () => {
  const old = new Date(Date.now() - 3 * 24 * 3600 * 1000)

  test('крон: mobile, на який посилається asset, лишається; осиротілий mobile — видаляється', () => {
    const live = 'u/U/g/G/v/1-mobile.webp'
    const orphan = 'u/U/g/G/v/2-mobile.webp'
    const refs = referencedKeys([
      { r2_key: 'u/U/g/G/o/1-a.jpg', variants: { preview: 'u/U/g/G/v/1-preview.jpg', mobile: live } },
    ])
    assert.ok(refs.has(live))
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
  })

  test('видалення галереї бере все під префіксом галереї — mobile.webp теж туди потрапляє', () => {
    const key = variantKey('U', 'G', 'mobile', 'image/webp')
    assert.ok(key.startsWith(galleryPrefix('U', 'G')))
    assert.ok(isMediaKey(key))
  })
})

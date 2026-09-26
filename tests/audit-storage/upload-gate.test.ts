/**
 * Блок 1.1 / 1.4 — ліміт сховища і відео на шляху завантаження.
 * Ганяє справжні authorizeUpload / registerAsset з src/lib/uploads.ts проти
 * фейкового бекенда (helpers/fake-backend.ts). Тести з [ST-xx] у назві
 * фіксують відомі баги й падають, доки баг не виправлено.
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authorizeUpload, registerAsset } from '@/lib/uploads'
import { galleryPrefix } from '@/lib/storage'
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
const BASIC_LIMIT = 100 * GB
const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString()

function keyFor(userId: string, galleryId: string, name: string): string {
  return `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-${name}`
}

beforeEach(resetBackend)

describe('1.1 ліміт на presign (заявлений розмір)', () => {
  test('Базовий, 99,9 ГБ зайнято + файл 200 МБ → 403 storage_quota_exceeded', async () => {
    const { userId, galleryId } = seedAccount({
      plan: 'basic',
      usedBytes: 99.9 * GB,
      limitBytes: BASIC_LIMIT,
    })
    const result = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 200 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 403, error: 'storage_quota_exceeded' })
  })

  test('рівно до межі 100 ГБ — дозволено, на 1 байт більше — ні', async () => {
    const { userId, galleryId } = seedAccount({
      plan: 'basic',
      usedBytes: BASIC_LIMIT - 10 * MB,
      limitBytes: BASIC_LIMIT,
    })
    const fits = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 10 * MB,
    })
    assert.equal(fits.ok, true)
    const over = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 10 * MB + 1,
    })
    assert.equal(over.ok, false)
  })

  test('після grace платного тарифу ліміт = Free, навіть якщо в профілі лишились plan=basic і 100 ГБ', async () => {
    const { userId, galleryId } = seedAccount({
      plan: 'basic',
      usedBytes: 50 * GB,
      limitBytes: BASIC_LIMIT,
      graceUntil: past,
    })
    const result = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 403, error: 'storage_quota_exceeded' })
  })

  test('чужа галерея → 404, не 403 (не світимо існування)', async () => {
    const owner = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    const intruder = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    const result = await authorizeUpload(client(), intruder.userId, {
      galleryId: owner.galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 404, error: 'gallery_not_found' })
  })

  test('не image/* і не video/* → 415; 0 байт або > 2 ГБ → 413', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'pro', usedBytes: 0, limitBytes: 1024 * GB })
    const pdf = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'application/pdf',
      sizeBytes: 1 * MB,
    })
    assert.equal(pdf.ok ? 0 : pdf.status, 415)
    const zero = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'image/jpeg',
      sizeBytes: 0,
    })
    assert.equal(zero.ok ? 0 : zero.status, 413)
    const huge = await authorizeUpload(client(), userId, {
      galleryId,
      contentType: 'video/mp4',
      sizeBytes: 2 * GB + 1,
    })
    assert.equal(huge.ok ? 0 : huge.status, 413)
  })
})

describe('1.4 відео: Free — ні, Базовий/Плюс/Максимальний — так (API)', () => {
  for (const [plan, limit, allowed] of [
    ['free', 3 * GB, false],
    ['basic', 100 * GB, true],
    ['plus', 500 * GB, true],
    ['pro', 1024 * GB, true],
  ] as const) {
    test(`${plan}: video/mp4 ${allowed ? 'дозволено' : '→ 403 plan_video_required'}`, async () => {
      const { userId, galleryId } = seedAccount({ plan, usedBytes: 0, limitBytes: limit })
      const result = await authorizeUpload(client(), userId, {
        galleryId,
        contentType: 'video/mp4',
        sizeBytes: 50 * MB,
      })
      if (allowed) assert.equal(result.ok, true)
      else assert.deepEqual(result, { ok: false, status: 403, error: 'plan_video_required' })
    })
  }

  test('Базовий у grace — відео ще можна; після grace — ні', async () => {
    const inGrace = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT, graceUntil: future })
    const lapsed = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT, graceUntil: past })
    const a = await authorizeUpload(client(), inGrace.userId, {
      galleryId: inGrace.galleryId,
      contentType: 'video/mp4',
      sizeBytes: 1 * MB,
    })
    const b = await authorizeUpload(client(), lapsed.userId, {
      galleryId: lapsed.galleryId,
      contentType: 'video/mp4',
      sizeBytes: 1 * MB,
    })
    assert.equal(a.ok, true)
    assert.deepEqual(b, { ok: false, status: 403, error: 'plan_video_required' })
  })

  test('обхід через тип: presign як image/jpeg, у B2 лежить video/mp4 → complete відхиляє й видаляє', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'free', usedBytes: 0, limitBytes: 3 * GB })
    const key = keyFor(userId, galleryId, 'clip.mp4')
    putObject(key, 20 * MB, 'video/mp4')
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 403, error: 'plan_video_required' })
    assert.equal(bucket.has(key), false)
    assert.equal(db.assets.length, 0)
  })
})

describe('1.1 complete: розмір беремо з B2, а не від клієнта', () => {
  test('заявлено 1 МБ, фактично залито 5 ГБ → відхилено, об’єкт видалено, місце не змінилось', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 99 * GB, limitBytes: BASIC_LIMIT })
    const key = keyFor(userId, galleryId, 'big.jpg')
    putObject(key, 5 * GB)
    const result = await registerAsset(client(), userId, {
      galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
    })
    assert.equal(result.ok, false)
    assert.deepEqual(deletedKeys, [key])
    assert.equal(usedBytes(userId), 99 * GB)
  })

  test('невдале завантаження (об’єкта в B2 нема) — місце не «зависає»', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 10 * GB, limitBytes: BASIC_LIMIT })
    const result = await registerAsset(client(), userId, {
      galleryId,
      key: keyFor(userId, galleryId, 'lost.jpg'),
      contentType: 'image/jpeg',
      sizeBytes: 200 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 400, error: 'upload_missing' })
    assert.equal(usedBytes(userId), 10 * GB)
  })

  test('ключ поза своїм префіксом → key_mismatch, нічого не видаляємо', async () => {
    const victim = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    const attacker = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    const key = keyFor(victim.userId, victim.galleryId, 'x.jpg')
    putObject(key, 1 * MB)
    const result = await registerAsset(client(), attacker.userId, {
      galleryId: attacker.galleryId,
      key,
      contentType: 'image/jpeg',
      sizeBytes: 1 * MB,
    })
    assert.deepEqual(result, { ok: false, status: 400, error: 'key_mismatch' })
    assert.equal(bucket.has(key), true)
  })

  test('повторна відправка того самого файлу: два presign → два різні ключі → рахується двічі (не витік, а дубль)', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    for (let i = 0; i < 2; i += 1) {
      const key = keyFor(userId, galleryId, 'IMG_0001.jpg')
      putObject(key, 10 * MB)
      const r = await registerAsset(client(), userId, { galleryId, key, contentType: 'image/jpeg', sizeBytes: 10 * MB })
      assert.equal(r.ok, true)
    }
    assert.equal(db.assets.length, 2)
    assert.equal(usedBytes(userId), 20 * MB)
    assert.equal(bucket.size, 2)
  })

  test('zip-імпорт: той самий файл удруге (дві вкладки) → 409 duplicate, другий об’єкт видалено', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: BASIC_LIMIT })
    const importId = crypto.randomUUID()
    db.gallery_imports.push({ id: importId, owner_id: userId, status: 'running' })
    const results = []
    for (let i = 0; i < 2; i += 1) {
      const key = keyFor(userId, galleryId, 'IMG_0001.jpg')
      putObject(key, 10 * MB)
      results.push(
        await registerAsset(client(), userId, {
          galleryId,
          key,
          contentType: 'image/jpeg',
          sizeBytes: 10 * MB,
          importId,
          originalName: 'IMG_0001.jpg',
        })
      )
    }
    assert.equal(results[0].ok, true)
    assert.deepEqual(results[1], { ok: false, status: 409, error: 'duplicate' })
    assert.equal(usedBytes(userId), 10 * MB)
    assert.equal(bucket.size, 1)
  })

  test('[ST-01] паралельні complete з кількох вкладок не мають разом перевищити 100 ГБ', async () => {
    const { userId, galleryId } = seedAccount({
      plan: 'basic',
      usedBytes: 99.9 * GB,
      limitBytes: BASIC_LIMIT,
    })
    // 99,9 ГБ + 5 × 60 МБ = 100,19 ГБ: влізти може лише один-єдиний файл (60 МБ < 102,4 МБ).
    const keys = Array.from({ length: 5 }, (_, i) => keyFor(userId, galleryId, `tab${i}.jpg`))
    for (const key of keys) putObject(key, 60 * MB)
    await Promise.all(
      keys.map((key) =>
        registerAsset(client(), userId, { galleryId, key, contentType: 'image/jpeg', sizeBytes: 60 * MB })
      )
    )
    assert.ok(
      usedBytes(userId) <= BASIC_LIMIT,
      `використано ${(usedBytes(userId) / GB).toFixed(3)} ГБ при ліміті 100 ГБ — ` +
        'перевірка ліміту (читання) і вставка asset (тригер) не атомарні'
    )
  })
})

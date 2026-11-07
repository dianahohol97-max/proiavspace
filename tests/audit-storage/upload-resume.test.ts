/**
 * План 4.3 — швидке завантаження великих зйомок і докачування після обриву.
 * Чисті правила multipart (lib/upload/multipart.ts), черга і повтори
 * (lib/upload/transfer.ts), ListParts у провайдері, резерв квоти під
 * незавершені завантаження (0063) та ідемпотентна реєстрація (повтор
 * /complete після обриву не створює другий рядок).
 */
import './helpers/fake-backend'
import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { S3Client } from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authorizeUpload, registerAsset } from '@/lib/uploads'
import { galleryPrefix } from '@/lib/storage'
import { S3CompatProvider } from '@/lib/storage/R2Provider'
import {
  MIN_PART_BYTES,
  MULTIPART_THRESHOLD,
  PART_SIZE,
  checkStoredParts,
  choosePartSize,
  missingParts,
  partCount,
  partRange,
  shouldUseMultipart,
} from '@/lib/upload/multipart'
import {
  HttpError,
  NETWORK_GIVE_UP_MS,
  NetworkError,
  RequestPool,
  backoffMs,
  withRetries,
} from '@/lib/upload/transfer'
import { isMissingTable } from '@/lib/upload/reservations'
import { GB, MB, db, putObject, resetBackend, seedAccount, userClient } from './helpers/fake-backend'

const client = () => userClient() as unknown as SupabaseClient
const noWait = { wait: async () => {} }

beforeEach(resetBackend)

describe('поріг і частини', () => {
  test('до 16 МБ — один PUT, більше — multipart частинами по 8 МБ', () => {
    assert.equal(MULTIPART_THRESHOLD, 16 * MB)
    assert.equal(shouldUseMultipart(16 * MB), false)
    assert.equal(shouldUseMultipart(16 * MB + 1), true)
    assert.equal(shouldUseMultipart(24 * MB), true)
    assert.equal(choosePartSize(24 * MB), PART_SIZE)
    assert.equal(partCount(24 * MB, PART_SIZE), 3)
  })

  test('відео 2 ГБ — 256 частин, у межах 10 000; частина ≥ 5 МБ', () => {
    assert.equal(partCount(2 * GB, choosePartSize(2 * GB)), 256)
    assert.ok(choosePartSize(2 * GB) >= MIN_PART_BYTES)
    // Навіть 100 ГБ не перевищить ліміт S3 на кількість частин.
    assert.ok(partCount(100 * GB, choosePartSize(100 * GB)) <= 10_000)
  })

  test('діапазони частин покривають файл без дірок і перекриттів', () => {
    const size = 21 * MB + 123
    let next = 0
    for (let n = 1; n <= partCount(size, PART_SIZE); n++) {
      const { start, end } = partRange(n, PART_SIZE, size)
      assert.equal(start, next)
      next = end
    }
    assert.equal(next, size)
  })
})

describe('докачування: що лишилось завантажити', () => {
  const size = 21 * MB // 8 + 8 + 5
  test('частини, які вже є в сховищі з правильним розміром, пропускаються', () => {
    assert.deepEqual(
      missingParts(size, PART_SIZE, [{ partNumber: 1, sizeBytes: 8 * MB }, { partNumber: 3, sizeBytes: 5 * MB }]),
      [2]
    )
  })
  test('частина іншого розміру (інший файл/розмір частин) вантажиться наново', () => {
    assert.deepEqual(missingParts(size, PART_SIZE, [{ partNumber: 1, sizeBytes: 7 * MB }]), [1, 2, 3])
  })
  test('нічого немає — усі частини', () => {
    assert.deepEqual(missingParts(size, PART_SIZE, []), [1, 2, 3])
  })
})

describe('сервер завершує з ListParts, коли браузер не бачить ETag', () => {
  const size = 21 * MB
  const part = (n: number, s: number) => ({ partNumber: n, etag: `e${n}`, sizeBytes: s })

  test('повний набір 1..N з правильними розмірами → список для Complete', () => {
    const check = checkStoredParts([part(2, 8 * MB), part(1, 8 * MB), part(3, 5 * MB)], size)
    assert.deepEqual(check, {
      ok: true,
      parts: [
        { partNumber: 1, etag: 'e1' },
        { partNumber: 2, etag: 'e2' },
        { partNumber: 3, etag: 'e3' },
      ],
    })
  })
  test('дірка — parts_missing', () => {
    assert.deepEqual(checkStoredParts([part(1, 8 * MB), part(3, 5 * MB)], size), {
      ok: false,
      error: 'parts_missing',
    })
  })
  test('сума не збігається із заявленим розміром — parts_size_mismatch', () => {
    assert.deepEqual(checkStoredParts([part(1, 8 * MB), part(2, 8 * MB), part(3, 4 * MB)], size), {
      ok: false,
      error: 'parts_size_mismatch',
    })
  })
  test('частини менші за 5 МБ (крім останньої) — відмова', () => {
    assert.equal(checkStoredParts([part(1, 1 * MB), part(2, 1 * MB)], 2 * MB).ok, false)
  })
  test('зайві частини після N у фінальний об’єкт не потрапляють', () => {
    const check = checkStoredParts([part(1, 8 * MB), part(2, 8 * MB), part(3, 5 * MB), part(4, 8 * MB)], size)
    assert.ok(check.ok && check.parts.length === 3)
  })
})

describe('ListParts у провайдері', () => {
  test('сторінки склеюються, лапки з ETag знімаються; NoSuchUpload → null', async () => {
    const original = S3Client.prototype.send
    const pages = [
      { Parts: [{ PartNumber: 2, ETag: '"b"', Size: 8 }], IsTruncated: true, NextPartNumberMarker: '2' },
      { Parts: [{ PartNumber: 1, ETag: '"a"', Size: 8 }], IsTruncated: false },
    ]
    let calls = 0
    S3Client.prototype.send = (async (command: { constructor: { name: string }; input: { UploadId: string } }) => {
      assert.equal(command.constructor.name, 'ListPartsCommand')
      if (command.input.UploadId === 'gone') {
        throw Object.assign(new Error('NoSuchUpload'), { name: 'NoSuchUpload', $metadata: { httpStatusCode: 404 } })
      }
      return pages[calls++]
    }) as unknown as S3Client['send']
    try {
      const provider = new S3CompatProvider({
        endpoint: 'https://s3.example.com',
        region: 'us-east-005',
        accessKeyId: 'k',
        secretAccessKey: 's',
        bucket: 'b',
      })
      assert.deepEqual(await provider.listParts('k', 'open'), [
        { partNumber: 1, etag: 'a', sizeBytes: 8 },
        { partNumber: 2, etag: 'b', sizeBytes: 8 },
      ])
      assert.equal(await provider.listParts('k', 'gone'), null)
    } finally {
      S3Client.prototype.send = original
    }
  })
})

describe('спільна черга запитів', () => {
  test('не більше limit одночасно; вищий пріоритет (прев’ю) іде першим, рівні — FIFO', async () => {
    const pool = new RequestPool(2)
    const order: string[] = []
    let active = 0
    let peak = 0
    const release: (() => void)[] = []
    const job = (name: string, priority: number) =>
      pool.run(async () => {
        active++
        peak = Math.max(peak, active)
        order.push(name)
        await new Promise<void>((resolve) => release.push(resolve))
        active--
      }, priority)
    const all = [job('a', 1), job('b', 1), job('c', 1), job('d', 1), job('preview', 2)]
    while (order.length < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1))
      release.shift()?.()
    }
    release.forEach((resolve) => resolve())
    await Promise.all(all)
    assert.equal(peak, 2)
    assert.deepEqual(order, ['a', 'b', 'preview', 'c', 'd'])
  })
})

describe('повтори', () => {
  test('обрив мережі на кілька спроб — чекаємо й продовжуємо, а не валимо файл', async () => {
    let attempts = 0
    const waits: boolean[] = []
    const result = await withRetries(
      async () => {
        attempts++
        if (attempts < 6) throw new NetworkError('offline')
        return 'ok'
      },
      { ...noWait, onRetry: () => waits.push(true), onRecovered: () => waits.push(false) }
    )
    assert.equal(result, 'ok')
    assert.equal(attempts, 6)
    assert.deepEqual(waits, [true, true, true, true, true, false])
  })

  test('мережа не повертається понад 15 хв — здаємось (запис для докачування лишається)', async () => {
    let clock = 0
    await assert.rejects(
      withRetries(
        async () => {
          clock += 60_000
          throw new NetworkError('offline')
        },
        noWait,
        () => clock
      ),
      NetworkError
    )
    assert.ok(clock > NETWORK_GIVE_UP_MS)
  })

  test('403 від сховища (протермінований підпис) — один раз беремо новий URL', async () => {
    let refreshed = 0
    let attempts = 0
    await withRetries(
      async () => {
        attempts++
        if (attempts === 1) throw new HttpError(403, 'expired')
      },
      { ...noWait, onAuthRefused: async () => void refreshed++ }
    )
    assert.equal(refreshed, 1)
    await assert.rejects(
      withRetries(async () => {
        throw new HttpError(403, 'forbidden')
      }, { ...noWait, onAuthRefused: async () => {} }),
      HttpError
    )
  })

  test('5xx — до 5 повторів; 4xx — одразу помилка', async () => {
    let attempts = 0
    await assert.rejects(
      withRetries(async () => {
        attempts++
        throw new HttpError(503, 'busy')
      }, noWait)
    )
    assert.equal(attempts, 6)
    attempts = 0
    await assert.rejects(
      withRetries(async () => {
        attempts++
        throw new HttpError(400, 'bad')
      }, noWait)
    )
    assert.equal(attempts, 1)
  })

  test('backoff: 1, 2, 4, 8 с, далі не більше 15 с', () => {
    const mid = () => 0.5
    assert.deepEqual([0, 1, 2, 3, 4, 8].map((n) => backoffMs(n, mid)), [1000, 2000, 4000, 8000, 15000, 15000])
  })
})

describe('облік місця: незавершені multipart', () => {
  test('відкриті завантаження рахуються як зайняте місце на create', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 99 * GB, limitBytes: 100 * GB })
    const input = { galleryId, contentType: 'image/png', sizeBytes: 600 * MB }
    assert.equal((await authorizeUpload(client(), userId, input)).ok, true)
    assert.deepEqual(await authorizeUpload(client(), userId, input, { reservedBytes: 500 * MB }), {
      ok: false,
      status: 403,
      error: 'storage_quota_exceeded',
    })
  })

  test('поки міграцію 0063 не накотили, відсутня таблиця не ламає завантаження', () => {
    assert.equal(isMissingTable({ code: 'PGRST205', message: 'Could not find the table' }), true)
    assert.equal(isMissingTable({ code: '42P01' }), true)
    assert.equal(isMissingTable({ code: '23505' }), false)
    assert.equal(isMissingTable(null), false)
  })
})

describe('повтор /complete після обриву', () => {
  test('той самий ключ удруге — та сама відповідь, без другого рядка і без подвійного обліку', async () => {
    const { userId, galleryId } = seedAccount({ plan: 'basic', usedBytes: 0, limitBytes: 100 * GB })
    const key = `${galleryPrefix(userId, galleryId)}o/${crypto.randomUUID()}-shot.png`
    putObject(key, 24 * MB, 'image/png')
    const input = { galleryId, key, contentType: 'image/png', sizeBytes: 24 * MB }
    const first = await registerAsset(client(), userId, input)
    const second = await registerAsset(client(), userId, input)
    assert.ok(first.ok && second.ok)
    assert.equal(second.assetId, first.assetId)
    assert.equal(db.assets.length, 1)
    assert.equal(db.profiles[0].storage_used_bytes, 24 * MB)
  })
})

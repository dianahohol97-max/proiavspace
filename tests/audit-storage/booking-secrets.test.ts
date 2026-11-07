/**
 * Release 6 — секрети бронювання в базі зашифровані (AES-256-GCM),
 * «Відключити» Google відкликає токен.
 *
 *  - шифрування / розшифровка, формат enc:v1:…, випадковий IV;
 *  - старий відкритий текст читається як є й перешифровується при збереженні;
 *  - неправильний ключ, підмінене значення, значення з іншої колонки → помилка;
 *  - у проді без BOOKING_SECRETS_KEY нові секрети не зберігаються;
 *  - порожнє поле форми не стирає секрет, «стерти» — стирає;
 *  - disconnectGoogleCalendar: revoke у Google, а якщо Google лежить — токен
 *    однаково видаляється в нас.
 * Google — мок fetch; Supabase — фейковий клієнт.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test'
import {
  SecretDecryptError,
  SecretsKeyMissingError,
  buildSecretPatch,
  canEncryptSecrets,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  maskSecret,
  readSecret,
} from '@/lib/booking/secrets'

const env = process.env as Record<string, string | undefined>
const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('base64')
const saved = { key: env.BOOKING_SECRETS_KEY, nodeEnv: env.NODE_ENV }

function useKey(key: string | undefined, nodeEnv = 'test') {
  if (key === undefined) delete env.BOOKING_SECRETS_KEY
  else env.BOOKING_SECRETS_KEY = key
  env.NODE_ENV = nodeEnv
}
afterEach(() => useKey(KEY_A))
after(() => {
  if (saved.key === undefined) delete env.BOOKING_SECRETS_KEY
  else env.BOOKING_SECRETS_KEY = saved.key
  env.NODE_ENV = saved.nodeEnv
})

describe('шифрування секретів (AES-256-GCM, node:crypto)', () => {
  beforeEach(() => useKey(KEY_A))

  test('туди й назад; формат enc:v1:<iv>:<tag>:<data>; відкритого тексту в шифротексті немає', () => {
    const plain = 'uRZ3-mono-acquiring-token-1234'
    const enc = encryptSecret(plain, 'mono_token')
    assert.match(enc, /^enc:v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/)
    assert.ok(!enc.includes(plain) && !enc.includes('1234'))
    assert.equal(decryptSecret(enc, 'mono_token'), plain)
  })

  test('випадковий IV: однаковий секрет дає різні шифротексти', () => {
    assert.notEqual(encryptSecret('same', 'wfp_secret'), encryptSecret('same', 'wfp_secret'))
  })

  test('старий відкритий текст (без enc:) читається як є', () => {
    assert.equal(decryptSecret('1//0legacy-google-refresh', 'google_refresh_token'), '1//0legacy-google-refresh')
    assert.equal(isEncrypted('1//0legacy-google-refresh'), false)
    assert.equal(decryptSecret(null, 'mono_token'), null)
    assert.equal(decryptSecret('', 'mono_token'), null)
  })

  test('неправильний ключ → SecretDecryptError; readSecret дає null і повідомляє', () => {
    const enc = encryptSecret('secret', 'mono_token')
    useKey(KEY_B)
    assert.throws(() => decryptSecret(enc, 'mono_token'), SecretDecryptError)
    const errors: unknown[] = []
    assert.equal(readSecret(enc, 'mono_token', (e) => errors.push(e)), null)
    assert.equal(errors.length, 1)
  })

  test('значення з іншої колонки чи підмінене — не розшифровується', () => {
    const enc = encryptSecret('secret', 'mono_token')
    assert.throws(() => decryptSecret(enc, 'wfp_secret'), SecretDecryptError)
    const parts = enc.split(':')
    parts[4] = Buffer.from('tampered').toString('base64url')
    assert.throws(() => decryptSecret(parts.join(':'), 'mono_token'), SecretDecryptError)
    assert.throws(() => decryptSecret('enc:v9:a:b:c', 'mono_token'), /no key for version v9/)
    assert.throws(() => decryptSecret('enc:v1:broken', 'mono_token'), SecretDecryptError)
  })

  test('ключ не 32 байти → зрозуміла помилка', () => {
    useKey(Buffer.from('short').toString('base64'))
    assert.throws(() => encryptSecret('x', 'mono_token'), /32 bytes/)
    assert.equal(canEncryptSecrets(), false)
  })

  test('прод без BOOKING_SECRETS_KEY: шифрувати нічим; локально — тестовий ключ', () => {
    useKey(undefined, 'production')
    assert.equal(canEncryptSecrets(), false)
    assert.throws(() => encryptSecret('x', 'mono_token'), SecretsKeyMissingError)
    useKey(undefined, 'development')
    assert.equal(canEncryptSecrets(), true)
    assert.equal(decryptSecret(encryptSecret('dev', 'mono_token'), 'mono_token'), 'dev')
  })

  test('маска: лише останні 4 символи, короткі значення — без символів', () => {
    assert.equal(maskSecret('abcdefgh1234'), '••••1234')
    assert.equal(maskSecret('short'), '••••')
    assert.equal(maskSecret(null), null)
  })
})

describe('збереження форми налаштувань', () => {
  beforeEach(() => useKey(KEY_A))

  test('порожнє поле — секрет не змінюється (його немає в patch)', () => {
    const stored = encryptSecret('keep-me-1234', 'mono_token')
    const { patch, keyMissing } = buildSecretPatch({
      submitted: { mono_token: '', wfp_secret: null },
      clear: [],
      existing: { mono_token: stored },
    })
    assert.deepEqual(patch, {})
    assert.equal(keyMissing, false)
  })

  test('нове значення шифрується; «стерти» → null', () => {
    const { patch } = buildSecretPatch({
      submitted: { wfp_secret: '  new-wfp-secret  ' },
      clear: ['mono_personal_token'],
      existing: { mono_personal_token: encryptSecret('old', 'mono_personal_token') },
    })
    assert.ok(isEncrypted(patch.wfp_secret))
    assert.equal(decryptSecret(patch.wfp_secret, 'wfp_secret'), 'new-wfp-secret')
    assert.equal(patch.mono_personal_token, null)
  })

  test('старий відкритий текст перешифровується при наступному збереженні', () => {
    const { patch } = buildSecretPatch({
      submitted: {},
      clear: [],
      existing: { google_refresh_token: '1//0legacy', mono_token: encryptSecret('x', 'mono_token') },
    })
    assert.deepEqual(Object.keys(patch), ['google_refresh_token'])
    assert.equal(decryptSecret(patch.google_refresh_token, 'google_refresh_token'), '1//0legacy')
  })

  test('прод без ключа: новий секрет НЕ записується, keyMissing = true, старий лишається', () => {
    useKey(undefined, 'production')
    const { patch, keyMissing } = buildSecretPatch({
      submitted: { mono_token: 'new-token' },
      clear: [],
      existing: { mono_token: 'legacy-plain' },
    })
    assert.deepEqual(patch, {})
    assert.equal(keyMissing, true)
  })
})

// ---------------------------------------------------------------------------
// disconnectGoogleCalendar: revoke у Google
// ---------------------------------------------------------------------------

describe('«Відключити» Google Календар', () => {
  const root = path.resolve(__dirname, '..', '..')
  const modUrl = (rel: string) => pathToFileURL(path.join(root, rel)).href
  const row: Record<string, unknown> = {}
  const updates: Record<string, unknown>[] = []
  const revoked: string[] = []
  let googleDown = false
  const realFetch = globalThis.fetch
  let disconnect: (locale: 'uk') => Promise<void>

  before(async () => {
    useKey(KEY_A)
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/revoke') {
        if (googleDown) return new Response('unavailable', { status: 503 })
        revoked.push(new URLSearchParams(String(init?.body)).get('token') ?? '')
        return new Response('', { status: 200 })
      }
      return realFetch(input as RequestInfo, init)
    }) as typeof fetch
    const query = () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: { ...row }, error: null }),
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          Object.assign(row, patch)
          return { eq: async () => ({ error: null }) }
        },
      }
      return q
    }
    mock.module(modUrl('src/lib/supabase/server.ts'), {
      namedExports: {
        createSupabaseServerClient: () => ({
          auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
          from: () => query(),
        }),
      },
    })
    mock.module('next/cache', { namedExports: { revalidatePath: () => undefined } })
    mock.module('next/navigation', {
      namedExports: {
        redirect: (to: string) => {
          throw new Error(`redirect ${to}`)
        },
      },
    })
    disconnect = (await import('@/lib/actions/booking')).disconnectGoogleCalendar
  })
  after(() => {
    globalThis.fetch = realFetch
  })
  beforeEach(() => {
    useKey(KEY_A)
    updates.length = 0
    revoked.length = 0
    googleDown = false
  })

  test('розшифрований токен відкликається в Google, потім видаляється в нас', async () => {
    Object.assign(row, { google_refresh_token: encryptSecret('1//0refresh-xyz', 'google_refresh_token'), google_email: 'o@gmail.com' })
    await disconnect('uk')
    assert.deepEqual(revoked, ['1//0refresh-xyz'])
    assert.deepEqual(updates, [{ google_refresh_token: null, google_email: null }])
  })

  test('старий відкритий токен теж відкликається', async () => {
    Object.assign(row, { google_refresh_token: '1//0legacy-plain' })
    await disconnect('uk')
    assert.deepEqual(revoked, ['1//0legacy-plain'])
    assert.deepEqual(updates, [{ google_refresh_token: null, google_email: null }])
  })

  test('Google не відповідає → токен однаково видаляється в нас', async () => {
    googleDown = true
    Object.assign(row, { google_refresh_token: encryptSecret('1//0refresh-xyz', 'google_refresh_token') })
    await disconnect('uk')
    assert.deepEqual(revoked, [])
    assert.deepEqual(updates, [{ google_refresh_token: null, google_email: null }])
  })
})

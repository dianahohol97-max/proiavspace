/**
 * Encryption of booking secrets at rest (server-only).
 *
 * Encrypted columns of booking_settings: mono_token, wfp_secret,
 * mono_personal_token, google_refresh_token. They stay `text` — no migration.
 *
 * Format: enc:<keyVersion>:<iv>:<tag>:<ciphertext>  (base64url parts)
 *   - AES-256-GCM, 12-byte random IV, 16-byte auth tag (node:crypto only);
 *   - the column name is bound as additional authenticated data, so a value
 *     copied into another column does not decrypt;
 *   - the key version lets the key be rotated later: add the new key under a
 *     new version, keep the old one readable, re-encrypt on save.
 *
 * A value WITHOUT the `enc:` prefix is legacy plaintext (written before this
 * release). It is used as is and re-encrypted on the next save.
 *
 * Key: BOOKING_SECRETS_KEY = 32 random bytes, base64. In production without
 * it nothing new is encrypted (callers show an error and do not store the
 * secret). Locally and in tests a fixed development key is used so the app
 * keeps working; it never applies when NODE_ENV === 'production'.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type SecretField = 'mono_token' | 'wfp_secret' | 'mono_personal_token' | 'google_refresh_token'
export const SECRET_FIELDS: SecretField[] = [
  'mono_token',
  'wfp_secret',
  'mono_personal_token',
  'google_refresh_token',
]

const PREFIX = 'enc:'
export const CURRENT_KEY_VERSION = 'v1'

export class SecretsKeyMissingError extends Error {
  constructor() {
    super('BOOKING_SECRETS_KEY is not set')
    this.name = 'SecretsKeyMissingError'
  }
}

export class SecretDecryptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretDecryptError'
  }
}

function devKey(): Buffer {
  return createHash('sha256').update('proyav-dev-only-booking-secrets-key').digest()
}

/** The key for a version, or null when it is not configured. */
function keyFor(version: string): Buffer | null {
  if (version !== CURRENT_KEY_VERSION) return null
  const raw = process.env.BOOKING_SECRETS_KEY?.trim()
  if (raw) {
    const key = Buffer.from(raw, 'base64')
    if (key.length !== 32) throw new Error('BOOKING_SECRETS_KEY must be 32 bytes, base64-encoded')
    return key
  }
  return process.env.NODE_ENV === 'production' ? null : devKey()
}

/** True when new secrets can be stored (a key is available). */
export function canEncryptSecrets(): boolean {
  try {
    return keyFor(CURRENT_KEY_VERSION) !== null
  } catch {
    return false
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(plain: string, field: SecretField): string {
  const key = keyFor(CURRENT_KEY_VERSION)
  if (!key) throw new SecretsKeyMissingError()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(field))
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    'enc',
    CURRENT_KEY_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    data.toString('base64url'),
  ].join(':')
}

/**
 * Stored value → plaintext. Legacy plaintext is returned unchanged; null/''
 * → null. Throws SecretDecryptError on a wrong key, unknown version or
 * tampered value.
 */
export function decryptSecret(value: string | null | undefined, field: SecretField): string | null {
  if (value === null || value === undefined || value === '') return null
  if (!isEncrypted(value)) return value
  const parts = value.split(':')
  if (parts.length !== 5) throw new SecretDecryptError(`${field}: malformed encrypted value`)
  const [, version, ivPart, tagPart, dataPart] = parts
  let key: Buffer | null
  try {
    key = keyFor(version)
  } catch (error) {
    throw new SecretDecryptError(`${field}: ${(error as Error).message}`)
  }
  if (!key) throw new SecretDecryptError(`${field}: no key for version ${version}`)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
    decipher.setAAD(Buffer.from(field))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new SecretDecryptError(`${field}: cannot decrypt (wrong key or damaged value)`)
  }
}

/**
 * Like decryptSecret, but a value that cannot be decrypted counts as "not
 * configured" (null) and is reported through `onError`, so one broken secret
 * never takes a page or a webhook down.
 */
export function readSecret(
  value: string | null | undefined,
  field: SecretField,
  onError?: (error: unknown) => void
): string | null {
  try {
    return decryptSecret(value, field)
  } catch (error) {
    onError?.(error)
    return null
  }
}

/** «••••1234» for the dashboard; null when nothing is stored or unreadable. */
export function maskSecret(plain: string | null): string | null {
  if (!plain) return null
  // Short values would be revealed almost entirely by their last 4 chars.
  return plain.length > 8 ? `••••${plain.slice(-4)}` : '••••'
}

export interface SecretPatchInput {
  /** What the form sent per field ('' / missing = "do not change"). */
  submitted: Partial<Record<SecretField, string | null>>
  /** Fields whose «стерти» box was ticked. */
  clear: SecretField[]
  /** Current stored values (encrypted or legacy plaintext). */
  existing: Partial<Record<SecretField, string | null>>
}

/**
 * The columns to write for a settings save:
 *  - a new non-empty value → encrypted;
 *  - an empty field → unchanged, but legacy plaintext already stored is
 *    re-encrypted (the "next save" upgrade);
 *  - a ticked «стерти» → null.
 * Without a key (production, BOOKING_SECRETS_KEY missing) new values are NOT
 * written and `keyMissing` is set so the dashboard can say why.
 */
export function buildSecretPatch(input: SecretPatchInput): {
  patch: Partial<Record<SecretField, string | null>>
  keyMissing: boolean
} {
  const patch: Partial<Record<SecretField, string | null>> = {}
  let keyMissing = false
  const canEncrypt = canEncryptSecrets()
  for (const field of SECRET_FIELDS) {
    if (input.clear.includes(field)) {
      patch[field] = null
      continue
    }
    const fresh = input.submitted[field]?.trim()
    if (fresh) {
      if (canEncrypt) patch[field] = encryptSecret(fresh, field)
      else keyMissing = true
      continue
    }
    const stored = input.existing[field]
    if (stored && !isEncrypted(stored) && canEncrypt) patch[field] = encryptSecret(stored, field)
  }
  return { patch, keyMissing }
}

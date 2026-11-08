/**
 * Worker for public.storage_purge_queue (audit LC-02, migration 0057).
 *
 * When an account is deleted, a trigger on profiles enqueues every B2 key the
 * account had (kind = 'object') plus its whole prefix 'u/<user_id>/'
 * (kind = 'prefix'). This module drains that queue: it removes the files from
 * the bucket — every *version*, because B2 keeps old versions and a plain
 * DeleteObject only adds a hide marker — and marks the row purged.
 *
 * Safety rules (all enforced here, before anything reaches the bucket):
 *   - only keys under 'u/<uuid>/' are ever touched; the empty prefix, the
 *     bucket root, 'u/', anything with '..' or empty path segments is refused;
 *   - when the row has an owner_id, the key must sit under that owner's
 *     prefix;
 *   - every key the bucket lists back is checked again against the row;
 *   - a run is capped by rows and by deleted versions;
 *   - dry-run (the default) lists and logs, never deletes and never writes.
 *
 * Failures bump `attempts` and land in Sentry; after MAX_ATTEMPTS the row is
 * left alone and reported as stuck (cron log + /api/admin/storage-purge).
 *
 * Pure of Next/Supabase/S3 imports: the route wires real adapters, tests pass
 * fakes.
 */

export const MAX_ATTEMPTS = 5
export const DEFAULT_MAX_ROWS = 200
export const DEFAULT_MAX_DELETES = 5000
/** S3 ListObjectVersions / DeleteObjects cap. */
const PAGE = 1000

export type PurgeKind = 'object' | 'prefix'

export interface PurgeRow {
  id: number
  key: string
  kind: PurgeKind
  owner_id: string | null
  attempts: number
}

export interface ObjectVersion {
  key: string
  /** null for a bucket without versioning (S3 "null" version). */
  versionId: string | null
}

export interface VersionPage {
  versions: ObjectVersion[]
  truncated: boolean
  nextKeyMarker?: string
  nextVersionIdMarker?: string
}

/** What the worker needs from the bucket. S3CompatProvider implements it. */
export interface PurgeStorage {
  /** One page of every version and delete marker under a prefix. */
  listObjectVersions(
    prefix: string,
    options: { maxKeys: number; keyMarker?: string; versionIdMarker?: string }
  ): Promise<VersionPage>
  /** Permanently removes exactly these versions. Throws if any is refused. */
  deleteObjectVersions(versions: ObjectVersion[]): Promise<void>
  listMultipartUploads(prefix: string): Promise<{ key: string; uploadId: string }[]>
  abortMultipartUpload(key: string, uploadId: string): Promise<void>
}

export type FetchResult = { rows: PurgeRow[] } | { missingTable: true }

/** What the worker needs from the database. */
export interface PurgeQueue {
  /** Pending rows (purged_at is null, attempts < maxAttempts), oldest first. */
  fetchPending(limit: number, maxAttempts: number): Promise<FetchResult>
  /** Pending rows that ran out of attempts. */
  countStuck(maxAttempts: number): Promise<number>
  markPurged(id: number): Promise<void>
  markFailed(id: number, attempts: number, error: string): Promise<void>
}

export interface PurgeOptions {
  dryRun: boolean
  maxRows?: number
  maxDeletes?: number
  maxAttempts?: number
  /** Error reporter (Sentry in prod). */
  report?: (error: unknown, context: Record<string, unknown>) => void
  log?: (message: string) => void
}

export interface PurgeSummary {
  mode: 'dry-run' | 'live'
  skipped?: 'queue_table_missing'
  rows: number
  purged: number
  /** Rows that need another run (budget ran out mid-prefix). */
  partial: number
  failed: number
  rejected: number
  stuck: number
  versionsDeleted: number
  /** Dry-run: versions that would have been deleted. */
  versionsWouldDelete: number
  multipartAborted: number
  truncated: boolean
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(`^${UUID}$`, 'i')
const ACCOUNT_ROOT_RE = new RegExp(`^u/(${UUID})/`, 'i')

/**
 * Why a queue row must not be acted on, or null if it is safe.
 *  - prefix: 'u/<uuid>/' or deeper, always ending in '/';
 *  - object: a key strictly under 'u/<uuid>/', never ending in '/'.
 */
export function unsafeReason(row: Pick<PurgeRow, 'key' | 'kind' | 'owner_id'>): string | null {
  const key = row.key
  if (typeof key !== 'string' || key.trim() === '') return 'empty key'
  if (key !== key.trim()) return 'whitespace around key'
  const root = ACCOUNT_ROOT_RE.exec(key)
  if (!root) return 'key is not under u/<uuid>/'
  const segments = key.split('/')
  // 'u/<id>/' splits into ['u', id, ''] — the trailing '' is the only empty
  // segment allowed, and only for prefixes.
  const inner = row.kind === 'prefix' ? segments.slice(0, -1) : segments
  if (inner.some((s) => s === '')) return 'empty path segment'
  if (segments.some((s) => s === '.' || s === '..')) return 'relative path segment'
  if (/[\u0000-\u001f\u007f*?]/.test(key)) return 'control or wildcard character'
  if (row.kind === 'prefix') {
    if (!key.endsWith('/')) return 'prefix must end with /'
  } else if (row.kind === 'object') {
    if (key.endsWith('/')) return 'object key ends with /'
    if (segments.length < 3) return 'object key is the account root'
  } else {
    return `unknown kind ${String(row.kind)}`
  }
  if (row.owner_id !== null && row.owner_id !== undefined) {
    if (!UUID_RE.test(row.owner_id)) return 'owner_id is not a uuid'
    if (root[1].toLowerCase() !== row.owner_id.toLowerCase()) return 'key belongs to another account'
  }
  return null
}

/** Is a key the bucket listed back really covered by this row? */
export function coveredBy(row: Pick<PurgeRow, 'key' | 'kind'>, listedKey: string): boolean {
  if (row.kind === 'object') return listedKey === row.key
  return listedKey.startsWith(row.key) && listedKey.length > row.key.length
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.slice(0, 500)
}

export async function purgeStorageQueue(
  queue: PurgeQueue,
  storage: PurgeStorage,
  options: PurgeOptions
): Promise<PurgeSummary> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS
  const log = options.log ?? ((m: string) => console.log(m))
  const report = options.report ?? (() => {})
  const summary: PurgeSummary = {
    mode: options.dryRun ? 'dry-run' : 'live',
    rows: 0,
    purged: 0,
    partial: 0,
    failed: 0,
    rejected: 0,
    stuck: 0,
    versionsDeleted: 0,
    versionsWouldDelete: 0,
    multipartAborted: 0,
    truncated: false,
  }
  let budget = options.maxDeletes ?? DEFAULT_MAX_DELETES

  const fetched = await queue.fetchPending(maxRows, maxAttempts)
  if ('missingTable' in fetched) {
    // Migration 0057 is not applied yet — nothing to do, nothing is wrong.
    return { ...summary, skipped: 'queue_table_missing' }
  }
  summary.rows = fetched.rows.length
  summary.truncated = fetched.rows.length >= maxRows

  for (const row of fetched.rows) {
    if (budget <= 0) {
      summary.truncated = true
      break
    }
    const unsafe = unsafeReason(row)
    if (unsafe) {
      // Never retried: park it at maxAttempts so a human looks at it.
      summary.rejected += 1
      const error = `unsafe key refused: ${unsafe}`
      log(`storage purge: row ${row.id} ${JSON.stringify(row.key)} ${error}`)
      report(new Error(`storage purge: ${error}`), { rowId: row.id, kind: row.kind })
      if (!options.dryRun) {
        try {
          await queue.markFailed(row.id, Math.max(maxAttempts, row.attempts + 1), error)
        } catch (cause) {
          report(cause, { rowId: row.id, step: 'markFailed' })
        }
      }
      continue
    }

    try {
      const result = await purgeRow(row, storage, budget, options.dryRun, log)
      budget -= result.versions
      summary.multipartAborted += result.aborted
      if (options.dryRun) {
        summary.versionsWouldDelete += result.versions
        log(
          `storage purge [dry-run]: row ${row.id} ${row.kind} ${row.key} → would delete ${result.versions} version(s)` +
            (result.aborted ? `, abort ${result.aborted} multipart` : '') +
            (result.done ? '' : ' (more left)')
        )
        continue
      }
      summary.versionsDeleted += result.versions
      if (result.done) {
        await queue.markPurged(row.id)
        summary.purged += 1
      } else {
        summary.partial += 1
        summary.truncated = true
      }
    } catch (cause) {
      summary.failed += 1
      const attempts = row.attempts + 1
      log(`storage purge: row ${row.id} ${row.key} failed (attempt ${attempts}/${maxAttempts}): ${message(cause)}`)
      report(cause, { rowId: row.id, kind: row.kind, attempts })
      if (!options.dryRun) {
        try {
          await queue.markFailed(row.id, attempts, message(cause))
        } catch (markCause) {
          report(markCause, { rowId: row.id, step: 'markFailed' })
        }
      }
    }
  }

  try {
    summary.stuck = await queue.countStuck(maxAttempts)
  } catch (cause) {
    report(cause, { step: 'countStuck' })
  }
  if (summary.stuck > 0) {
    log(`storage purge: ${summary.stuck} row(s) gave up after ${maxAttempts} attempts — see /api/admin/storage-purge`)
  }
  return summary
}

/**
 * Lists (and in live mode deletes) every version under the row, up to
 * `budget` versions. `done` = nothing left under it in the bucket.
 */
async function purgeRow(
  row: PurgeRow,
  storage: PurgeStorage,
  budget: number,
  dryRun: boolean,
  log: (m: string) => void
): Promise<{ versions: number; aborted: number; done: boolean }> {
  let versions = 0
  let aborted = 0
  let keyMarker: string | undefined
  let versionIdMarker: string | undefined
  let done = false

  while (versions < budget) {
    const page = await storage.listObjectVersions(row.key, {
      maxKeys: Math.min(PAGE, budget - versions),
      keyMarker,
      versionIdMarker,
    })
    const mine = page.versions.filter((v) => coveredBy(row, v.key))
    // Defence in depth: whatever the bucket answered, only delete what the
    // row covers and what still passes the key rules on its own.
    const safe = mine.filter((v) => unsafeReason({ key: v.key, kind: 'object', owner_id: row.owner_id }) === null)
    if (safe.length !== mine.length) {
      throw new Error(`bucket listed ${mine.length - safe.length} unsafe key(s) under ${row.key}`)
    }
    if (safe.length > 0) {
      if (!dryRun) await storage.deleteObjectVersions(safe)
      else for (const v of safe.slice(0, 20)) log(`storage purge [dry-run]:   ${v.key}${v.versionId ? ` @${v.versionId}` : ''}`)
      versions += safe.length
    }
    // For an exact key, versions of longer keys sharing the prefix come after
    // ours in listing order: once one shows up, ours are all listed.
    const passedKey = row.kind === 'object' && page.versions.some((v) => v.key !== row.key)
    if (!page.truncated || passedKey) {
      done = true
      break
    }
    keyMarker = page.nextKeyMarker
    versionIdMarker = page.nextVersionIdMarker
    if (!keyMarker && !versionIdMarker) {
      throw new Error('listing is truncated but has no continuation marker')
    }
  }

  // Unfinished multipart uploads under an account prefix are billed until
  // aborted. Only once the objects are gone, so a half-done row resumes first.
  if (done && row.kind === 'prefix') {
    const uploads = (await storage.listMultipartUploads(row.key)).filter((u) => coveredBy(row, u.key))
    for (const upload of uploads) {
      if (!dryRun) await storage.abortMultipartUpload(upload.key, upload.uploadId)
      aborted += 1
    }
  }
  return { versions, aborted, done }
}

/**
 * PostgREST/Postgres answer for a table that does not exist yet (migration
 * 0057 not applied): PGRST205 "Could not find the table … in the schema
 * cache" or 42P01 "relation … does not exist".
 */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  const text = error.message ?? ''
  return /storage_purge_queue/.test(text) && /(does not exist|schema cache)/i.test(text)
}

/** STORAGE_PURGE_MODE=live turns deletion on; anything else is a dry run. */
export function purgeDryRun(envMode: string | undefined, forceDry: boolean): boolean {
  return forceDry || envMode !== 'live'
}

/** The configured provider, if it can list and delete object versions. */
export function asPurgeStorage(storage: object): PurgeStorage {
  const s = storage as Partial<PurgeStorage>
  if (
    typeof s.listObjectVersions !== 'function' ||
    typeof s.deleteObjectVersions !== 'function' ||
    typeof s.listMultipartUploads !== 'function' ||
    typeof s.abortMultipartUpload !== 'function'
  ) {
    throw new Error('storage provider cannot list/delete object versions')
  }
  return s as PurgeStorage
}

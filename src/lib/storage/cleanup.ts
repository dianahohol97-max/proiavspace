import type { StorageObject, UnfinishedMultipartUpload } from './StorageProvider'

/**
 * What the storage-cleanup cron removes (audit ST-02 / ST-03), as pure
 * decisions over listings so the rules are testable without a bucket:
 *
 *   - an object under a gallery or portfolio prefix that no asset row
 *     references (the browser got a presigned URL, PUT the file and never
 *     called /complete — or complete failed after the PUT);
 *   - a multipart upload that was started and neither completed nor aborted.
 *
 * Both only once they are older than GRACE_MS: a legitimate upload is in
 * flight for minutes, its row appears when /complete runs, and a presigned
 * URL itself dies after 10 minutes — so anything unreferenced a day later is
 * garbage, never a race with a live upload.
 */

export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000

/** Prefixes the app writes gallery/portfolio media under (see lib/storage). */
const MEDIA_PATH = /^u\/[^/]+\/(g\/[^/]+|portfolio)\//

export function isMediaKey(key: string): boolean {
  return MEDIA_PATH.test(key)
}

export function orphanKeys(
  objects: StorageObject[],
  referenced: ReadonlySet<string>,
  now = Date.now()
): string[] {
  return objects
    .filter((object) => isMediaKey(object.key))
    .filter((object) => !referenced.has(object.key))
    .filter((object) => !object.lastModified || now - object.lastModified.getTime() > ORPHAN_GRACE_MS)
    .map((object) => object.key)
}

export function staleMultipartUploads(
  uploads: UnfinishedMultipartUpload[],
  now = Date.now()
): UnfinishedMultipartUpload[] {
  return uploads.filter(
    (upload) => !upload.initiated || now - upload.initiated.getTime() > ORPHAN_GRACE_MS
  )
}

/** Every key an asset row owns: the original plus its rendition map. */
export function referencedKeys(
  rows: { r2_key: string; variants: Record<string, string> | null }[]
): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    keys.add(row.r2_key)
    for (const key of Object.values(row.variants ?? {})) keys.add(key)
  }
  return keys
}

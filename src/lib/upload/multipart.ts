/**
 * Multipart rules shared by the browser (lib/upload/client.ts) and the server
 * routes (/api/uploads/multipart/*). Pure functions, no DOM and no Node APIs,
 * so tests run them directly.
 *
 * Why these numbers (measured, docs/UPLOAD_PERF.md): with 16 camera files of
 * 20–26 MB on a 20 Mbit/s link, RTT 120 ms to B2 us-east, 8 MB parts over a
 * shared limit of 6 requests use 92–97 % of the link and finish files one by
 * one (first after ~20 s instead of ~50 s); 16 MB parts were slower, and a
 * 64 MB threshold gave the same total but no resume. A dropped connection
 * repeats at most 8 MB, and an upload resumes after a reload (ListParts).
 */

/** Files above this go multipart; smaller ones are a single presigned PUT. */
export const MULTIPART_THRESHOLD = 16 * 1024 * 1024

/** Default part size. S3/B2 minimum is 5 MB for every part but the last. */
export const PART_SIZE = 8 * 1024 * 1024

export const MIN_PART_BYTES = 5 * 1024 * 1024

/** S3/B2 hard limit on parts per upload. */
export const MAX_PARTS = 10_000

export function shouldUseMultipart(sizeBytes: number): boolean {
  return sizeBytes > MULTIPART_THRESHOLD
}

/**
 * Part size for a file: PART_SIZE, grown in whole MB only when the file
 * would otherwise need more than MAX_PARTS parts (never for the 2 GB cap,
 * but kept so raising the cap stays safe).
 */
export function choosePartSize(sizeBytes: number): number {
  const mb = 1024 * 1024
  const needed = Math.ceil(sizeBytes / MAX_PARTS)
  return Math.max(PART_SIZE, Math.ceil(needed / mb) * mb)
}

export function partCount(sizeBytes: number, partSize: number): number {
  return Math.max(1, Math.ceil(sizeBytes / partSize))
}

/** Byte range [start, end) of a 1-based part. */
export function partRange(
  partNumber: number,
  partSize: number,
  sizeBytes: number
): { start: number; end: number } {
  const start = (partNumber - 1) * partSize
  return { start, end: Math.min(start + partSize, sizeBytes) }
}

/**
 * Which parts still have to be uploaded, given what the storage already holds
 * (ListParts). A stored part counts only when its size is exactly what this
 * part should be — anything else (a different part size, a different file
 * under the same fingerprint) is uploaded again and overwrites it.
 */
export function missingParts(
  sizeBytes: number,
  partSize: number,
  stored: { partNumber: number; sizeBytes: number }[]
): number[] {
  const have = new Map(stored.map((part) => [part.partNumber, part.sizeBytes]))
  const missing: number[] = []
  for (let n = 1; n <= partCount(sizeBytes, partSize); n++) {
    const { start, end } = partRange(n, partSize, sizeBytes)
    if (have.get(n) !== end - start) missing.push(n)
  }
  return missing
}

export type PartsCheck =
  | { ok: true; parts: { partNumber: number; etag: string }[] }
  | { ok: false; error: 'parts_missing' | 'parts_size_mismatch' }

/**
 * Server-side check before CompleteMultipartUpload when the list comes from
 * ListParts: parts 1..N with no gaps, every part but the last the same size
 * (and at least MIN_PART_BYTES), and all of them adding up to the size the
 * quota gate ran on. Extra parts beyond N (a retry with another part size)
 * are left out of the completed object.
 */
export function checkStoredParts(
  stored: { partNumber: number; etag: string; sizeBytes: number }[],
  sizeBytes: number
): PartsCheck {
  const sorted = [...stored].sort((a, b) => a.partNumber - b.partNumber)
  if (sorted.length === 0 || sorted[0].partNumber !== 1) return { ok: false, error: 'parts_missing' }
  const partSize = sorted[0].sizeBytes
  if (partSize <= 0) return { ok: false, error: 'parts_size_mismatch' }
  const count = partCount(sizeBytes, partSize)
  if (count > 1 && partSize < MIN_PART_BYTES) return { ok: false, error: 'parts_size_mismatch' }
  const byNumber = new Map(sorted.map((part) => [part.partNumber, part]))
  const parts: { partNumber: number; etag: string }[] = []
  for (let n = 1; n <= count; n++) {
    const part = byNumber.get(n)
    if (!part) return { ok: false, error: 'parts_missing' }
    const { start, end } = partRange(n, partSize, sizeBytes)
    if (part.sizeBytes !== end - start) return { ok: false, error: 'parts_size_mismatch' }
    parts.push({ partNumber: n, etag: part.etag })
  }
  return { ok: true, parts }
}


/**
 * The browser only resumes uploads clearly younger than the cron's 24 h cutoff
 * (ORPHAN_GRACE_MS in lib/storage/cleanup.ts),
 * so it never races an abort and then fails at complete.
 */
export const RESUME_MAX_AGE_MS = 20 * 60 * 60 * 1000

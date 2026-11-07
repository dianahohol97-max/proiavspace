/**
 * Where an open multipart upload is remembered between page loads: uploadId,
 * key and part size in IndexedDB, keyed by a fingerprint of the gallery and
 * the file. Which parts are done is NOT stored here — storage is the source of
 * truth (ListParts via /api/uploads/multipart/list-parts), so a part whose
 * PUT was cut mid-way is simply uploaded again.
 *
 * Everything degrades to "no resume" when IndexedDB or crypto.subtle is
 * missing (private mode, old browsers, http://): uploads still work.
 */

import { RESUME_MAX_AGE_MS } from './multipart'

export interface ResumeRecord {
  /** Fingerprint (see fingerprintFile). */
  id: string
  galleryId: string
  key: string
  uploadId: string
  partSize: number
  sizeBytes: number
  fileName: string
  createdAt: number
}

const DB_NAME = 'proiav-uploads'
const STORE = 'multipart'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const request = op(db.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
  )
}

function fresh(record: ResumeRecord | null | undefined, now = Date.now()): boolean {
  return !!record && now - record.createdAt < RESUME_MAX_AGE_MS
}

export async function getResume(id: string): Promise<ResumeRecord | null> {
  const record = await run<ResumeRecord | undefined>('readonly', (store) => store.get(id))
  if (record && fresh(record)) return record
  if (record) await deleteResume(id)
  return null
}

export async function saveResume(record: ResumeRecord): Promise<void> {
  await run('readwrite', (store) => store.put(record))
}

export async function deleteResume(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}

/** Unfinished uploads of one gallery (for the «choose the same files» hint). */
export async function listResumes(galleryId: string): Promise<ResumeRecord[]> {
  const all = (await run<ResumeRecord[]>('readonly', (store) => store.getAll())) ?? []
  const stale = all.filter((record) => !fresh(record))
  for (const record of stale) await deleteResume(record.id)
  return all.filter((record) => fresh(record) && record.galleryId === galleryId)
}

const SAMPLE_BYTES = 64 * 1024

/**
 * Same gallery + name + size + the first and last 64 KB. Cheap (128 KB hashed,
 * no full read of a 2 GB video) and robust enough: a different photo with the
 * same name, byte size AND identical head and tail does not happen in
 * practice — and every part is size-checked again before completion.
 * lastModified is left out on purpose: files extracted from a zip get a new
 * one on every run, and they must resume too.
 */
export async function fingerprintFile(galleryId: string, file: File): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    const head = file.slice(0, SAMPLE_BYTES)
    const tail = file.slice(Math.max(0, file.size - SAMPLE_BYTES))
    const sample = await new Blob([`${galleryId}\n${file.name}\n${file.size}\n`, head, tail]).arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', sample)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

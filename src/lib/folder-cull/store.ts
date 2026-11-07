'use client'
/**
 * Local persistence of a folder culling session (IndexedDB):
 *   sessions — measurements, marks, settings (JSON)
 *   thumbs   — grid thumbnails (Blob), key `${session}\n${item}`
 *   handles  — the FileSystemDirectoryHandle (Chrome/Edge) to continue after a reload
 * Nothing leaves the device. Every call degrades to "not stored" on failure.
 */
import { DEFAULT_EXPORT, type FolderItem, type FolderSession } from './types'

const DB = 'proiav-folder-cull'
const VERSION = 1
export const SESSION_VERSION = 1

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const r = indexedDB.open(DB, VERSION)
      r.onupgradeneeded = () => {
        for (const name of ['sessions', 'thumbs', 'handles']) {
          if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name)
        }
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

let dbPromise: Promise<IDBDatabase | null> | null = null
const db = () => (dbPromise ??= open())

function req<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined)
        try {
          const r = run(d.transaction(store, mode).objectStore(store))
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      })
  )
}

export function newSession(id: string, folderName: string, items: FolderItem[], hasHandle: boolean): FolderSession {
  const now = Date.now()
  return {
    version: SESSION_VERSION,
    id,
    folderName,
    createdAt: now,
    updatedAt: now,
    items,
    meta: {},
    analysis: {},
    faces: {},
    marks: {},
    bestOverrides: {},
    settings: { ...DEFAULT_EXPORT },
    hasHandle,
  }
}

/** Keeps measurements/marks of files that did not change (same path, size, mtime). */
export function mergeSession(saved: FolderSession | undefined, fresh: FolderSession): FolderSession {
  if (!saved || saved.version !== SESSION_VERSION) return fresh
  const before = new Map(saved.items.map((i) => [i.id, i]))
  const same = (it: FolderItem) => {
    const old = before.get(it.id)
    return !!old && old.size === it.size && old.lastModified === it.lastModified
  }
  const pick = <T,>(rec: Record<string, T>) =>
    Object.fromEntries(fresh.items.filter(same).filter((it) => it.id in rec).map((it) => [it.id, rec[it.id]]))
  return {
    ...fresh,
    createdAt: saved.createdAt,
    meta: pick(saved.meta),
    analysis: pick(saved.analysis),
    faces: pick(saved.faces),
    marks: pick(saved.marks),
    bestOverrides: saved.bestOverrides,
    settings: { ...DEFAULT_EXPORT, ...saved.settings },
    exportedAt: saved.exportedAt,
    written: saved.written,
    original: saved.original,
  }
}

export const loadSession = (id: string) => req<FolderSession>('sessions', 'readonly', (s) => s.get(id))
export const saveSession = async (session: FolderSession) =>
  (await req('sessions', 'readwrite', (s) => s.put({ ...session, updatedAt: Date.now() }, session.id))) !== undefined

export async function listSessions(): Promise<FolderSession[]> {
  const all = (await req<FolderSession[]>('sessions', 'readonly', (s) => s.getAll())) ?? []
  return all.filter((s) => s.version === SESSION_VERSION).sort((a, b) => b.updatedAt - a.updatedAt)
}

export const deleteSession = async (id: string) => {
  await req('sessions', 'readwrite', (s) => s.delete(id))
  await req('handles', 'readwrite', (s) => s.delete(id))
  await req('thumbs', 'readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}\n`, `${id}\n￿`)))
}

export const thumbKey = (session: string, item: string) => `${session}\n${item}`
export const saveThumb = (session: string, item: string, blob: Blob) => req('thumbs', 'readwrite', (s) => s.put(blob, thumbKey(session, item)))
export const loadThumb = (session: string, item: string) => req<Blob>('thumbs', 'readonly', (s) => s.get(thumbKey(session, item)))

export const saveHandle = (session: string, handle: FileSystemDirectoryHandle) => req('handles', 'readwrite', (s) => s.put(handle, session))
export const loadHandle = (session: string) => req<FileSystemDirectoryHandle>('handles', 'readonly', (s) => s.get(session))

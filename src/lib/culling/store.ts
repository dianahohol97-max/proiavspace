'use client'
/**
 * Local persistence of the culling state, per gallery, in IndexedDB.
 *
 * Until the database has a place for it (hidden_from_client from branch db/1
 * and, later, the flags themselves), the photographer's review lives ONLY on
 * this device — the UI says so. Every access is wrapped: a private window or
 * blocked storage just means nothing is remembered, never a broken page.
 */
import type { CullingState } from './types'

const DB_NAME = 'proiav-culling'
const STORE = 'galleries'
export const STATE_VERSION = 1

export function emptyState(galleryId: string): CullingState {
  return { version: STATE_VERSION, galleryId, analysis: {}, decisions: {}, bestOverrides: {}, updatedAt: 0 }
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function loadState(galleryId: string): Promise<CullingState> {
  const db = await open()
  if (!db) return emptyState(galleryId)
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(galleryId)
      request.onsuccess = () => {
        const value = request.result as CullingState | undefined
        resolve(value && value.version === STATE_VERSION ? { ...emptyState(galleryId), ...value } : emptyState(galleryId))
        db.close()
      }
      request.onerror = () => {
        resolve(emptyState(galleryId))
        db.close()
      }
    } catch {
      resolve(emptyState(galleryId))
      db.close()
    }
  })
}

/** Resolves true when saved; false when this browser cannot store it. */
export async function saveState(state: CullingState): Promise<boolean> {
  const db = await open()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ ...state, updatedAt: Date.now() }, state.galleryId)
      tx.oncomplete = () => {
        resolve(true)
        db.close()
      }
      tx.onerror = tx.onabort = () => {
        resolve(false)
        db.close()
      }
    } catch {
      resolve(false)
      db.close()
    }
  })
}

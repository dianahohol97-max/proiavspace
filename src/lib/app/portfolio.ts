'use client'

/**
 * Offline portfolio: up to MAX_OFFLINE_GALLERIES galleries' MOBILE previews
 * kept on the phone in Cache Storage, so the photographer can show them to
 * a client without internet. public/app/offline.html reads the same cache
 * (keep the names below in sync with it and with public/dashboard-sw.js).
 *
 *   /__portfolio/index.json            → OfflineIndex
 *   /__portfolio/<galleryId>/<n>       → one photo (image/webp or jpeg)
 *
 * Only light renditions (assets.variants.mobile, ~1080 px), never originals.
 */
export const PORTFOLIO_CACHE = 'proiav-portfolio-v1'
export const PORTFOLIO_INDEX = '/__portfolio/index.json'
export const MAX_OFFLINE_GALLERIES = 3
/** One gallery keeps at most this many photos (≈ 40–60 MB of previews). */
export const MAX_OFFLINE_PHOTOS = 300

export interface OfflinePhoto {
  key: string
  w?: number
  h?: number
}

export interface OfflineGallery {
  id: string
  title: string
  savedAt: string
  bytes: number
  photos: OfflinePhoto[]
}

export interface OfflineIndex {
  version: 1
  galleries: OfflineGallery[]
}

/** /api/offline-pack/<id> answer. */
export interface OfflinePack {
  id: string
  title: string
  photos: { url: string; width: number | null; height: number | null }[]
}

export class OfflineQuotaError extends Error {}
export class OfflineLimitError extends Error {}

export function offlineSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && typeof fetch === 'function'
}

export async function readOfflineIndex(): Promise<OfflineIndex> {
  if (!offlineSupported()) return { version: 1, galleries: [] }
  try {
    const cache = await caches.open(PORTFOLIO_CACHE)
    const response = await cache.match(PORTFOLIO_INDEX)
    const index = response ? ((await response.json()) as OfflineIndex) : null
    return index && Array.isArray(index.galleries) ? index : { version: 1, galleries: [] }
  } catch {
    return { version: 1, galleries: [] }
  }
}

async function writeIndex(cache: Cache, index: OfflineIndex) {
  await cache.put(
    PORTFOLIO_INDEX,
    new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } })
  )
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
}

async function fetchWithRetry(url: string, signal?: AbortSignal): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' })
      if (response.ok) return response
      lastError = new Error(`photo ${response.status}`)
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  throw lastError
}

/**
 * Downloads a gallery's previews into the cache, 4 at a time. The index is
 * written only at the end, so an interrupted save leaves nothing half-shown;
 * its partial files are removed.
 */
export async function saveGalleryOffline(
  pack: OfflinePack,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<OfflineGallery> {
  const cache = await caches.open(PORTFOLIO_CACHE)
  const index = await readOfflineIndex()
  const others = index.galleries.filter((g) => g.id !== pack.id)
  if (others.length >= MAX_OFFLINE_GALLERIES) throw new OfflineLimitError()

  // Ask the browser not to evict the portfolio under storage pressure.
  void navigator.storage?.persist?.().catch(() => false)

  const photos = pack.photos.slice(0, MAX_OFFLINE_PHOTOS)
  const saved: (OfflinePhoto | null)[] = new Array(photos.length).fill(null)
  let bytes = 0
  let done = 0
  onProgress(0, photos.length)
  const queue = photos.map((photo, n) => ({ photo, n }))
  try {
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const response = await fetchWithRetry(next.photo.url, signal)
          const blob = await response.blob()
          const key = `/__portfolio/${pack.id}/${next.n}`
          await cache.put(
            key,
            new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
          )
          bytes += blob.size
          saved[next.n] = {
            key,
            ...(next.photo.width ? { w: next.photo.width } : {}),
            ...(next.photo.height ? { h: next.photo.height } : {}),
          }
          done += 1
          onProgress(done, photos.length)
        }
      })
    )
  } catch (error) {
    await Promise.all(photos.map((_, n) => cache.delete(`/__portfolio/${pack.id}/${n}`)))
    if (isQuotaError(error)) throw new OfflineQuotaError()
    throw error
  }

  const gallery: OfflineGallery = {
    id: pack.id,
    title: pack.title,
    savedAt: new Date().toISOString(),
    bytes,
    photos: saved.filter((p): p is OfflinePhoto => p !== null),
  }
  // Re-read: another tab may have changed the index meanwhile.
  const fresh = await readOfflineIndex()
  await writeIndex(cache, { version: 1, galleries: [...fresh.galleries.filter((g) => g.id !== pack.id), gallery] })
  return gallery
}

export async function removeGalleryOffline(galleryId: string): Promise<void> {
  if (!offlineSupported()) return
  const cache = await caches.open(PORTFOLIO_CACHE)
  const index = await readOfflineIndex()
  await writeIndex(cache, { version: 1, galleries: index.galleries.filter((g) => g.id !== galleryId) })
  const keys = await cache.keys()
  await Promise.all(
    keys
      .filter((request) => new URL(request.url).pathname.startsWith(`/__portfolio/${galleryId}/`))
      .map((request) => cache.delete(request))
  )
}

export function formatMb(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

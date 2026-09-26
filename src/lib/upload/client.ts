'use client'

import { generateImageVariants } from '@/lib/images/variants'
import { generateVideoPoster } from '@/lib/images/videoPoster'

/**
 * Browser-side upload of ONE file into a gallery, shared by the gallery
 * Uploader and the zip import so both take exactly the same path:
 *   1. POST /api/uploads/presign  → presigned PUT URL (quota + ownership checked)
 *   2. PUT the file straight to storage (XHR for progress events)
 *   3. Generate preview/thumb renditions in-browser and PUT them the same way
 *   4. POST /api/uploads/complete → asset row (with variants map) under RLS
 *
 * Per file the pipeline overlaps: renditions are generated WHILE the original
 * is in flight, then all rendition PUTs go out together — the browser never
 * sits CPU-idle waiting for network or network-idle waiting for canvas encodes.
 */

/** Thrown when the server refuses the asset because the name already exists. */
export class DuplicateAssetError extends Error {}

/** The server refused a video because the plan has no video (Free). */
export class PlanVideoRequiredError extends Error {}

/** Turn a 403 plan_video_required answer into PlanVideoRequiredError. */
async function throwIfVideoNotInPlan(response: Response): Promise<void> {
  if (response.status !== 403) return
  const body = (await response.clone().json().catch(() => null)) as { error?: string } | null
  if (body?.error === 'plan_video_required') throw new PlanVideoRequiredError()
}

// Files above the threshold (large videos) go through S3 multipart: parts
// upload in parallel with per-part retries, so one dropped packet no longer
// restarts a 1.5 GB transfer from zero.
const MULTIPART_THRESHOLD = 64 * 1024 * 1024
const PART_SIZE = 16 * 1024 * 1024
const PART_CONCURRENCY = 3
const PART_RETRIES = 3

function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Upload network error'))
    xhr.send(file)
  })
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 409) throw new DuplicateAssetError(url)
  await throwIfVideoNotInPlan(response)
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return (await response.json()) as T
}

/** PUT one part; resolves with its ETag (needs "etag" in the R2 CORS ExposeHeaders). */
function putPart(
  url: string,
  blob: Blob,
  onBytes: (uploadedBytes: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onBytes(event.loaded)
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`part upload ${xhr.status}`))
        return
      }
      const etag = xhr.getResponseHeader('ETag')
      if (!etag) {
        reject(new Error('R2 CORS rule must expose the "etag" header (see README)'))
        return
      }
      resolve(etag.replaceAll('"', ''))
    }
    xhr.onerror = () => reject(new Error('part network error'))
    xhr.send(blob)
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Multipart upload: create → presign all part URLs → parts in parallel with
 * exponential-backoff retries → complete (which registers the asset row).
 * Aborts the R2 upload on unrecoverable failure.
 */
async function uploadMultipart(
  galleryId: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  variants: Record<string, string>,
  dimensions: { width?: number; height?: number },
  extra: RegisterExtra
): Promise<void> {
  const { key, uploadId } = await postJson<{ key: string; uploadId: string }>(
    '/api/uploads/multipart/create',
    { galleryId, fileName: file.name, contentType, sizeBytes: file.size }
  )

  try {
    const partCount = Math.ceil(file.size / PART_SIZE)
    const partNumbers = Array.from({ length: partCount }, (_, index) => index + 1)
    const { urls } = await postJson<{ urls: Record<number, string> }>(
      '/api/uploads/multipart/part-urls',
      { galleryId, key, uploadId, partNumbers }
    )

    const uploadedByPart = new Map<number, number>()
    const report = () => {
      let total = 0
      uploadedByPart.forEach((bytes) => {
        total += bytes
      })
      onProgress(Math.min(total / file.size, 1))
    }

    const parts: { partNumber: number; etag: string }[] = []
    const queue = [...partNumbers]
    const workers = Array.from(
      { length: Math.min(PART_CONCURRENCY, queue.length) },
      async () => {
        for (let partNumber = queue.shift(); partNumber; partNumber = queue.shift()) {
          const blob = file.slice(
            (partNumber - 1) * PART_SIZE,
            Math.min(partNumber * PART_SIZE, file.size)
          )
          let lastError: unknown = null
          for (let attempt = 0; attempt <= PART_RETRIES; attempt++) {
            if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
            try {
              const etag = await putPart(urls[partNumber], blob, (bytes) => {
                uploadedByPart.set(partNumber as number, bytes)
                report()
              })
              parts.push({ partNumber, etag })
              uploadedByPart.set(partNumber, blob.size)
              report()
              lastError = null
              break
            } catch (error) {
              lastError = error
            }
          }
          if (lastError) throw lastError
        }
      }
    )
    await Promise.all(workers)

    await postJson('/api/uploads/multipart/complete', {
      galleryId,
      key,
      uploadId,
      parts,
      contentType,
      sizeBytes: file.size,
      variants,
      ...dimensions,
      ...extra,
    })
  } catch (error) {
    // Best-effort cleanup; the storage-cleanup cron aborts what this misses.
    void postJson('/api/uploads/multipart/abort', { galleryId, key, uploadId }).catch(() => {})
    throw error
  }
}

/** Extra fields the zip import attaches to the asset row (see registerAsset). */
export interface RegisterExtra {
  originalName?: string
  importId?: string
  position?: number
}

async function presign(
  galleryId: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  variant?: string
) {
  const response = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryId, fileName, contentType, sizeBytes, variant }),
  })
  await throwIfVideoNotInPlan(response)
  if (!response.ok) throw new Error(`presign ${response.status}`)
  return (await response.json()) as { uploadUrl: string; key: string }
}

export async function uploadFileToGallery(options: {
  galleryId: string
  file: File
  /** Renditions: the photographer's name stamped on the preview, if set. */
  watermarkText?: string
  onProgress: (percent: number) => void
  extra?: RegisterExtra
}): Promise<void> {
  const { galleryId, file, watermarkText, onProgress } = options
  const extra = options.extra ?? {}
  const contentType = file.type || 'application/octet-stream'
  const isVideo = contentType.startsWith('video/')

  // A video gets a lightweight poster still so the gallery grid never
  // streams the full original just to render a tile. Optional — a failed
  // poster (odd codec) just falls back to the current behaviour.
  const variants: Record<string, string> = {}
  let videoDims: { width?: number; height?: number } = {}
  if (isVideo) {
    const poster = await generateVideoPoster(file).catch(() => null)
    if (poster) {
      const target = await presign(galleryId, 'poster.jpg', 'image/jpeg', poster.blob.size, 'poster')
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: poster.blob,
      })
      if (put.ok) {
        variants.poster = target.key
        videoDims = { width: poster.width, height: poster.height }
      }
    }
  }

  if (file.size > MULTIPART_THRESHOLD) {
    await uploadMultipart(
      galleryId,
      file,
      contentType,
      (fraction) => onProgress(Math.round(fraction * 100)),
      variants,
      videoDims,
      extra
    )
    return
  }

  // Kick off the CPU work right away — a SINGLE decode yields both the
  // renditions and the pixel size, and runs while the original uploads.
  const renditionsPromise = isVideo
    ? Promise.resolve({ variants: [] } as Awaited<ReturnType<typeof generateImageVariants>>)
    : generateImageVariants(file, watermarkText)

  const { uploadUrl, key } = await presign(galleryId, file.name, contentType, file.size)

  // The original dominates the transfer — its PUT drives the bar to 90%,
  // the (much smaller) renditions fill the rest.
  await putWithProgress(uploadUrl, file, (progress) =>
    onProgress(Math.round(progress * 0.9))
  )

  // Renditions are independent of each other: presign + PUT them all
  // concurrently instead of one-by-one round-trips.
  const rendered = await renditionsPromise
  await Promise.all(
    rendered.variants.map(async (rendition) => {
      const target = await presign(
        galleryId,
        `${rendition.name}.jpg`,
        'image/jpeg',
        rendition.blob.size,
        rendition.name
      )
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: rendition.blob,
      })
      if (!put.ok) throw new Error(`variant put ${put.status}`)
      variants[rendition.name] = target.key
    })
  )
  onProgress(95)

  const dimensions = isVideo
    ? videoDims
    : { width: rendered.width, height: rendered.height }
  const completeResponse = await fetch('/api/uploads/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      galleryId,
      key,
      contentType,
      sizeBytes: file.size,
      variants,
      ...dimensions,
      ...extra,
    }),
  })
  if (completeResponse.status === 409) throw new DuplicateAssetError(file.name)
  await throwIfVideoNotInPlan(completeResponse)
  if (!completeResponse.ok) throw new Error(`complete ${completeResponse.status}`)
}

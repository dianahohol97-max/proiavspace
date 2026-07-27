'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateImageVariants } from '@/lib/images/variants'
import { generateVideoPoster } from '@/lib/images/videoPoster'

/**
 * Direct-to-R2 uploader:
 *   1. POST /api/uploads/presign  → presigned PUT URL (quota + ownership checked)
 *   2. PUT the file straight to R2 (XHR for progress events)
 *   3. Generate preview/thumb renditions in-browser and PUT them the same way
 *   4. POST /api/uploads/complete → asset row (with variants map) under RLS
 *
 * Runs up to CONCURRENCY uploads in parallel. Per file the pipeline overlaps:
 * renditions are generated WHILE the original is in flight, then all rendition
 * PUTs go out together — the browser never sits CPU-idle waiting for network
 * or network-idle waiting for canvas encodes.
 */

const CONCURRENCY = 5

// Files above the threshold (large videos) go through S3 multipart: parts
// upload in parallel with per-part retries, so one dropped packet no longer
// restarts a 1.5 GB transfer from zero.
const MULTIPART_THRESHOLD = 64 * 1024 * 1024
const PART_SIZE = 16 * 1024 * 1024
const PART_CONCURRENCY = 3
const PART_RETRIES = 3

type FileStatus = 'queued' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  progress: number // 0..100
}

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
  dimensions: { width?: number; height?: number }
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
    })
  } catch (error) {
    // Best-effort cleanup; R2 expires stale multipart uploads anyway.
    void postJson('/api/uploads/multipart/abort', { galleryId, key, uploadId }).catch(() => {})
    throw error
  }
}

export function Uploader({
  galleryId,
  dropHint,
  watermarkText,
}: {
  galleryId: string
  dropHint: string
  /** When set, previews get the photographer's name stamped bottom-right. */
  watermarkText?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const presign = useCallback(
    async (fileName: string, contentType: string, sizeBytes: number, variant?: string) => {
      const response = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, fileName, contentType, sizeBytes, variant }),
      })
      if (!response.ok) throw new Error(`presign ${response.status}`)
      return (await response.json()) as { uploadUrl: string; key: string }
    },
    [galleryId]
  )

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading' })
      try {
        const contentType = item.file.type || 'application/octet-stream'
        const isVideo = contentType.startsWith('video/')

        // A video gets a lightweight poster still so the gallery grid never
        // streams the full original just to render a tile. Optional — a failed
        // poster (odd codec) just falls back to the current behaviour.
        const variants: Record<string, string> = {}
        let videoDims: { width?: number; height?: number } = {}
        if (isVideo) {
          const poster = await generateVideoPoster(item.file).catch(() => null)
          if (poster) {
            const target = await presign('poster.jpg', 'image/jpeg', poster.blob.size, 'poster')
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

        if (item.file.size > MULTIPART_THRESHOLD) {
          await uploadMultipart(
            galleryId,
            item.file,
            contentType,
            (fraction) => updateItem(item.id, { progress: Math.round(fraction * 100) }),
            variants,
            videoDims
          )
          updateItem(item.id, { status: 'done', progress: 100 })
          return
        }

        // Kick off the CPU work right away — a SINGLE decode yields both the
        // renditions and the pixel size, and runs while the original uploads.
        const renditionsPromise = isVideo
          ? Promise.resolve({ variants: [] } as Awaited<ReturnType<typeof generateImageVariants>>)
          : generateImageVariants(item.file, watermarkText)

        const { uploadUrl, key } = await presign(item.file.name, contentType, item.file.size)

        // The original dominates the transfer — its PUT drives the bar to 90%,
        // the (much smaller) renditions fill the rest.
        await putWithProgress(uploadUrl, item.file, (progress) =>
          updateItem(item.id, { progress: Math.round(progress * 0.9) })
        )

        // Renditions are independent of each other: presign + PUT them all
        // concurrently instead of one-by-one round-trips.
        const rendered = await renditionsPromise
        await Promise.all(
          rendered.variants.map(async (rendition) => {
            const target = await presign(
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
        updateItem(item.id, { progress: 95 })

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
            sizeBytes: item.file.size,
            variants,
            ...dimensions,
          }),
        })
        if (!completeResponse.ok) throw new Error(`complete ${completeResponse.status}`)

        updateItem(item.id, { status: 'done', progress: 100 })
      } catch {
        updateItem(item.id, { status: 'error' })
      }
    },
    [galleryId, presign, updateItem, watermarkText]
  )

  const startUploads = useCallback(
    async (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'queued',
        progress: 0,
      }))
      setItems((prev) => [...prev, ...newItems])

      // Simple concurrency pool.
      const queue = [...newItems]
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await uploadOne(next)
        }
      })
      await Promise.all(workers)
      router.refresh()
    },
    [router, uploadOne]
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragOver(false)
      const files = Array.from(event.dataTransfer.files).filter(
        (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
      )
      if (files.length > 0) void startUploads(files)
    },
    [startUploads]
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer border border-dashed px-8 py-12 text-center text-sm leading-relaxed text-muted transition-colors ${
          dragOver ? 'border-fg bg-fg/5' : 'border-line hover:border-fg'
        }`}
      >
        {dropHint}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length > 0) void startUploads(files)
        }}
      />

      {items.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 text-sm">
              <span className="min-w-0 flex-1 truncate text-muted">{item.file.name}</span>
              <span className="w-40">
                <span className="block h-1 w-full bg-line">
                  <span
                    className={`block h-1 transition-all ${
                      item.status === 'error' ? 'bg-accent' : 'bg-fg'
                    }`}
                    style={{ width: `${item.status === 'error' ? 100 : item.progress}%` }}
                  />
                </span>
              </span>
              <span className="w-16 text-right text-xs uppercase tracking-widest text-muted">
                {item.status === 'done' ? '✓' : item.status === 'error' ? '✕' : `${item.progress}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

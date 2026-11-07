'use client'

import type { GeneratedRenditions } from '@/lib/images/renditionCore'
import { generateRenditions } from '@/lib/images/renditionPool'
import { generateVideoPoster } from '@/lib/images/videoPoster'
import {
  choosePartSize,
  missingParts,
  partCount,
  partRange,
  shouldUseMultipart,
} from './multipart'
import { deleteResume, fingerprintFile, getResume, saveResume, type ResumeRecord } from './resumeStore'
import {
  HttpError,
  NetworkError,
  PRIORITY_ORIGINAL,
  PRIORITY_RENDITION,
  fetchOrNetworkError,
  putBlob,
  transferPool,
  withRetries,
  type RetryHooks,
} from './transfer'

/**
 * Browser-side upload of ONE file into a gallery, shared by the gallery
 * Uploader and the zip import so both take exactly the same path:
 *
 *   original ─┬─ ≤ 16 MB: POST /api/uploads/presign → one PUT to storage
 *             └─ > 16 MB: multipart, 8 MB parts (create → part-urls → PUTs
 *                → complete), resumable: uploadId lives in IndexedDB and the
 *                parts storage already has are listed back (list-parts)
 *   renditions (preview 2048, thumb 512, mobile 1080 / poster for video):
 *             generated IN PARALLEL with the original, in a Web Worker, at
 *             most 2 images at a time (lib/images/renditionPool.ts), then
 *             PUT like the original
 *   POST …/complete → asset row (with the variants map) after server checks
 *
 * Every storage request of the page (all files, parts, renditions) shares one
 * limit of TRANSFER_CONCURRENCY = 6 (lib/upload/transfer.ts), FIFO by file so
 * files finish in order instead of all hanging at 90 %. Network errors are
 * waited out (offline → online), a silent stall is detected after 20 s.
 * Numbers behind these choices: docs/UPLOAD_PERF.md.
 */

/** Thrown when the server refuses the asset because the name already exists. */
export class DuplicateAssetError extends Error {}

/** The server refused a video because the plan has no video (Free). */
export class PlanVideoRequiredError extends Error {}

/** Our API answered non-2xx; `code` is the route's `error` field. */
export class ApiError extends HttpError {
  constructor(
    status: number,
    readonly code: string | null,
    url: string
  ) {
    super(status, `${url} ${status}${code ? ` ${code}` : ''}`)
  }
}

/** Extra fields the zip import attaches to the asset row (see registerAsset). */
export interface RegisterExtra {
  originalName?: string
  importId?: string
  position?: number
}

let etagWarningShown = false

/**
 * The bucket's CORS rule does not expose ETag, so the browser cannot read
 * part ETags. Uploads still complete (the server lists the parts itself), but
 * say so loudly once: it is a bucket setting to fix (docs/MANUAL_TASKS.md).
 */
function warnEtagUnavailable(): void {
  if (etagWarningShown) return
  etagWarningShown = true
  const message =
    '[upload] Storage CORS does not expose the ETag header: multipart parts are completed ' +
    'server-side via ListParts (one extra request per file). Fix: add "ETag" to ExposeHeaders ' +
    'of the B2 bucket CORS rule — see docs/MANUAL_TASKS.md.'
  console.warn(message)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureMessage(message, 'warning'))
      .catch(() => {})
  }
}

async function api<T>(url: string, body: unknown, hooks: RetryHooks): Promise<T> {
  return withRetries(async () => {
    const response = await fetchOrNetworkError(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) return (await response.json()) as T
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (response.status === 409) {
      throw new DuplicateAssetError(url)
    }
    if (response.status === 403 && payload?.error === 'plan_video_required') {
      throw new PlanVideoRequiredError()
    }
    throw new ApiError(response.status, payload?.error ?? null, url)
  }, hooks)
}

/** Presigned single PUT with retries; a refused (expired) URL is re-minted once. */
async function putSingle(
  galleryId: string,
  file: Blob,
  fileName: string,
  contentType: string,
  hooks: RetryHooks,
  options: { variant?: string; priority: number; onProgress?: (loaded: number) => void }
): Promise<string> {
  const mint = () =>
    api<{ uploadUrl: string; key: string }>(
      '/api/uploads/presign',
      { galleryId, fileName, contentType, sizeBytes: file.size, variant: options.variant },
      hooks
    )
  let target = await mint()
  await withRetries(
    () =>
      transferPool.run(
        () => putBlob(target.uploadUrl, file, { contentType, onProgress: options.onProgress }),
        options.priority
      ),
    {
      ...hooks,
      onAuthRefused: async () => {
        target = await mint()
      },
    }
  )
  return target.key
}

interface MultipartOriginal {
  key: string
  uploadId: string
  /** null → some ETag was unreadable; the server completes from ListParts. */
  parts: { partNumber: number; etag: string }[] | null
  resumeId: string | null
}

/** Part URLs are minted this many at a time and re-minted when older than this. */
const URL_BATCH = 20
const URL_MAX_AGE_MS = 8 * 60_000

async function uploadOriginalMultipart(
  galleryId: string,
  file: File,
  contentType: string,
  onFraction: (fraction: number) => void,
  hooks: RetryHooks,
  started: (upload: { key: string; uploadId: string; resumeId: string | null }) => void
): Promise<MultipartOriginal> {
  const resumeId = await fingerprintFile(galleryId, file)
  let record: ResumeRecord | null = resumeId ? await getResume(resumeId) : null
  let stored: { partNumber: number; etag: string; sizeBytes: number }[] = []

  if (record && record.sizeBytes === file.size && record.galleryId === galleryId) {
    try {
      const listed = await api<{ parts: typeof stored }>(
        '/api/uploads/multipart/list-parts',
        { galleryId, key: record.key, uploadId: record.uploadId },
        hooks
      )
      stored = listed.parts
    } catch (error) {
      // Gone (completed elsewhere, swept by the cron) or unreadable: start over.
      if (!(error instanceof ApiError)) throw error
      record = null
      if (resumeId) await deleteResume(resumeId)
    }
  } else if (record) {
    record = null
  }

  if (!record) {
    const created = await api<{ key: string; uploadId: string }>(
      '/api/uploads/multipart/create',
      { galleryId, fileName: file.name, contentType, sizeBytes: file.size },
      hooks
    )
    record = {
      id: resumeId ?? '',
      galleryId,
      key: created.key,
      uploadId: created.uploadId,
      partSize: choosePartSize(file.size),
      sizeBytes: file.size,
      fileName: file.name,
      createdAt: Date.now(),
    }
    stored = []
    if (resumeId) await saveResume(record)
  }
  const upload = record
  started({ key: upload.key, uploadId: upload.uploadId, resumeId })

  const { partSize } = upload
  const total = partCount(file.size, partSize)
  const todo = missingParts(file.size, partSize, stored)
  const todoSet = new Set(todo)
  const etags = new Map<number, string | null>()
  let doneBytes = 0
  for (const part of stored) {
    if (part.partNumber <= total && !todoSet.has(part.partNumber)) {
      etags.set(part.partNumber, part.etag)
      doneBytes += part.sizeBytes
    }
  }
  const inFlight = new Map<number, number>()
  const report = () => {
    let partial = 0
    inFlight.forEach((bytes) => {
      partial += bytes
    })
    onFraction(Math.min((doneBytes + partial) / file.size, 1))
  }
  report()

  // Part URLs: minted lazily in batches, re-minted when old or refused.
  const urls = new Map<number, { url: string; at: number }>()
  const pendingBatches = new Map<number, Promise<void>>()
  const mintFrom = (first: number): Promise<void> => {
    const existing = pendingBatches.get(first)
    if (existing) return existing
    const index = todo.indexOf(first)
    const batch = (index >= 0 ? todo.slice(index, index + URL_BATCH) : [first]).filter((n) => {
      const cached = urls.get(n)
      return n === first || !cached || Date.now() - cached.at > URL_MAX_AGE_MS
    })
    const promise = api<{ urls: Record<number, string> }>(
      '/api/uploads/multipart/part-urls',
      { galleryId, key: upload.key, uploadId: upload.uploadId, partNumbers: batch },
      hooks
    )
      .then(({ urls: minted }) => {
        const at = Date.now()
        for (const n of batch) if (minted[n]) urls.set(n, { url: minted[n], at })
      })
      .finally(() => pendingBatches.delete(first))
    pendingBatches.set(first, promise)
    return promise
  }
  const urlFor = async (n: number): Promise<string> => {
    const cached = urls.get(n)
    if (cached && Date.now() - cached.at < URL_MAX_AGE_MS) return cached.url
    await mintFrom(n)
    const minted = urls.get(n)
    if (!minted) throw new Error(`no URL for part ${n}`)
    return minted.url
  }
  if (todo.length > 0) await mintFrom(todo[0])

  await Promise.all(
    todo.map((n) =>
      withRetries(
        async () => {
          // URL first, OUTSIDE the transfer slot: a slot is for bytes on the wire.
          const url = await urlFor(n)
          const { start, end } = partRange(n, partSize, file.size)
          return transferPool.run(async () => {
            try {
              const result = await putBlob(url, file.slice(start, end), {
                onProgress: (loaded) => {
                  inFlight.set(n, loaded)
                  report()
                },
              })
              inFlight.delete(n)
              etags.set(n, result.etag)
              doneBytes += end - start
              report()
            } catch (error) {
              inFlight.delete(n)
              report()
              throw error
            }
          }, PRIORITY_ORIGINAL)
        },
        {
          ...hooks,
          onAuthRefused: async () => {
            urls.delete(n)
          },
        }
      )
    )
  )

  const parts: { partNumber: number; etag: string }[] = []
  let etagMissing = false
  for (let n = 1; n <= total; n++) {
    const etag = etags.get(n)
    if (etag) parts.push({ partNumber: n, etag })
    else etagMissing = true
  }
  if (etagMissing) warnEtagUnavailable()
  return { key: upload.key, uploadId: upload.uploadId, parts: etagMissing ? null : parts, resumeId }
}

/** Poster still for a video, uploaded right away (it is tiny). */
async function videoPosterVariant(
  galleryId: string,
  file: File,
  hooks: RetryHooks
): Promise<{ variants: Record<string, string>; width?: number; height?: number }> {
  const poster = await generateVideoPoster(file).catch(() => null)
  if (!poster) return { variants: {} }
  try {
    const key = await putSingle(galleryId, poster.blob, 'poster.jpg', 'image/jpeg', hooks, {
      variant: 'poster',
      priority: PRIORITY_RENDITION,
    })
    return { variants: { poster: key }, width: poster.width, height: poster.height }
  } catch (error) {
    if (error instanceof PlanVideoRequiredError) throw error
    // Optional — a failed poster just falls back to the current behaviour.
    return { variants: {} }
  }
}

async function uploadRenditions(
  galleryId: string,
  rendered: GeneratedRenditions,
  hooks: RetryHooks
): Promise<Record<string, string>> {
  const variants: Record<string, string> = {}
  await Promise.all(
    rendered.variants.map(async (rendition) => {
      const extension = rendition.contentType === 'image/webp' ? 'webp' : 'jpg'
      variants[rendition.name] = await putSingle(
        galleryId,
        rendition.blob,
        `${rendition.name}.${extension}`,
        rendition.contentType,
        hooks,
        { variant: rendition.name, priority: PRIORITY_RENDITION }
      )
    })
  )
  return variants
}

/** An error after which a resumable upload is dropped (and aborted in storage). */
function isFinal(error: unknown): boolean {
  if (error instanceof NetworkError) return false
  if (error instanceof HttpError) return error.status < 500 && error.status !== 408 && error.status !== 429
  return error instanceof DuplicateAssetError || error instanceof PlanVideoRequiredError
}

export async function uploadFileToGallery(options: {
  galleryId: string
  file: File
  /** Renditions: the photographer's name stamped on the preview, if set. */
  watermarkText?: string
  onProgress: (percent: number) => void
  /** true while the upload waits for the network to come back, false when it resumes. */
  onNetworkWait?: (waiting: boolean) => void
  extra?: RegisterExtra
}): Promise<void> {
  const { galleryId, file, watermarkText, onProgress, onNetworkWait } = options
  const extra = options.extra ?? {}
  const contentType = file.type || 'application/octet-stream'
  const isVideo = contentType.startsWith('video/')

  let waiting = false
  const hooks: RetryHooks = {
    onRetry: (error) => {
      if (error instanceof NetworkError && !waiting) {
        waiting = true
        onNetworkWait?.(true)
      }
    },
    onRecovered: () => {
      if (waiting) {
        waiting = false
        onNetworkWait?.(false)
      }
    },
  }

  // CPU work starts at once and never holds the original back: renditions
  // decode in a worker (2 at a time) while the bytes go out.
  const renditionsJob: Promise<{
    variants: Record<string, string>
    width?: number
    height?: number
  }> = isVideo
    ? videoPosterVariant(galleryId, file, hooks)
    : generateRenditions(file, watermarkText, { mobile: true })
        .catch((): GeneratedRenditions => ({ variants: [] }))
        .then(async (rendered) => ({
          variants: await uploadRenditions(galleryId, rendered, hooks),
          width: rendered.width,
          height: rendered.height,
        }))
  // Surface a failed rendition upload only when it is awaited below.
  renditionsJob.catch(() => {})

  // The original dominates the transfer — it drives the bar to 90 %, the
  // (much smaller) renditions and the registration fill the rest.
  const originalProgress = (fraction: number) => onProgress(Math.round(fraction * 90))

  if (shouldUseMultipart(file.size)) {
    let open: { key: string; uploadId: string; resumeId: string | null } | null = null
    try {
      const original = await uploadOriginalMultipart(galleryId, file, contentType, originalProgress, hooks, (u) => {
        open = u
      })
      const renditions = await renditionsJob
      onProgress(95)
      await api(
        '/api/uploads/multipart/complete',
        {
          galleryId,
          key: original.key,
          uploadId: original.uploadId,
          parts: original.parts,
          contentType,
          sizeBytes: file.size,
          variants: renditions.variants,
          width: renditions.width,
          height: renditions.height,
          ...extra,
        },
        hooks
      )
      if (original.resumeId) await deleteResume(original.resumeId)
    } catch (error) {
      const upload = open as { key: string; uploadId: string; resumeId: string | null } | null
      if (upload && isFinal(error)) {
        if (upload.resumeId) void deleteResume(upload.resumeId)
        void fetch('/api/uploads/multipart/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ galleryId, key: upload.key, uploadId: upload.uploadId }),
        }).catch(() => {})
      }
      // A network give-up keeps the parts and the IndexedDB record: choosing
      // the same file again continues where it stopped (the cron sweeps
      // anything left after 24 h).
      throw error
    }
    return
  }

  const key = await putSingle(galleryId, file, file.name, contentType, hooks, {
    priority: PRIORITY_ORIGINAL,
    onProgress: (loaded) => originalProgress(file.size ? loaded / file.size : 1),
  })
  const renditions = await renditionsJob
  onProgress(95)
  await api(
    '/api/uploads/complete',
    {
      galleryId,
      key,
      contentType,
      sizeBytes: file.size,
      variants: renditions.variants,
      width: renditions.width,
      height: renditions.height,
      ...extra,
    },
    hooks
  )
}

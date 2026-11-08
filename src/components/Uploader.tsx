'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DuplicateAssetError,
  PlanVideoRequiredError,
  UploadRefusedError,
  uploadFileToGallery,
} from '@/lib/upload/client'
import { holdScreenAwake, isInterruption, waitForForeground } from '@/lib/upload/foreground'
import { mimeFromName } from '@/lib/import/zip-plan'

/**
 * Direct-to-storage uploader. The per-file pipeline (presign → PUT → in-browser
 * renditions → complete) lives in lib/upload/client, shared with the zip
 * import; this component runs up to CONCURRENCY of them in parallel.
 *
 * On a phone: a big «Вибрати фото з телефона» button (the photo library,
 * HEIC included) above the drop zone; the screen is kept awake while files
 * go up; a file cut off because the app was switched away or the network
 * dropped waits («на паузі») and starts again once the app is back in front
 * and online (lib/upload/foreground). Server refusals are not repeated.
 */

const CONCURRENCY = 5

/** How many times one file is restarted after the app was suspended / offline. */
const MAX_RESUMES = 5

type FileStatus = 'queued' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  progress: number // 0..100
  /** Rejected because the plan has no video (Free). */
  videoPlan?: boolean
  /** Why it failed, in the photographer's words (see uploadErrorKey). */
  errorKey?: UploadErrorKey
  /** Paused: the app is in the background or offline; continues when it is back. */
  waiting?: boolean
}

export type UploadErrorKey = 'quota' | 'tooBig' | 'type' | 'closed' | 'duplicate' | 'generic'
export type UploadErrorLabels = Record<UploadErrorKey, string>

/** API refusal codes (src/lib/uploads.ts) → one of a few plain explanations. */
export function uploadErrorKey(error: unknown): UploadErrorKey {
  if (error instanceof DuplicateAssetError) return 'duplicate'
  if (!(error instanceof UploadRefusedError)) return 'generic'
  switch (error.code) {
    case 'storage_quota_exceeded':
      return 'quota'
    case 'file_too_large':
    case 'invalid_variant':
      return 'tooBig'
    case 'unsupported_type':
      return 'type'
    case 'gallery_free_expired':
      return 'closed'
    default:
      return 'generic'
  }
}

export function Uploader({
  galleryId,
  dropHint,
  watermarkText,
  videoPlanNotice,
  videoPlanLink,
  billingHref,
  errorLabels,
  progressLabel,
  retryLabel,
  emphasis,
  pickPhoneLabel,
  backgroundHint,
  pausedHint,
}: {
  galleryId: string
  /** Phone: the big button that opens the photo library. */
  pickPhoneLabel?: string
  /** Phone, while uploading: «можна згорнути застосунок». */
  backgroundHint?: string
  /** Shown while a file waits for the app to come back / the network. */
  pausedHint?: string
  /** Plain-words reasons for a failed file. */
  errorLabels?: UploadErrorLabels
  /** «Завантажено {done} з {total}». */
  progressLabel?: string
  retryLabel?: string
  /** Empty gallery: a big, inviting drop zone. */
  emphasis?: boolean
  dropHint: string
  /** Shown when a video is refused on a plan without video, with a link to billing. */
  videoPlanNotice: string
  videoPlanLink: string
  billingHref: string
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

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading', errorKey: undefined })
      for (let attempt = 0; ; attempt++) {
        try {
          await uploadFileToGallery({
            galleryId,
            file: item.file,
            watermarkText,
            onProgress: (progress) => updateItem(item.id, { progress, waiting: false }),
          })
          updateItem(item.id, { status: 'done', progress: 100, waiting: false })
          return
        } catch (error) {
          // A retry after a cut-off: the first try may have landed after all.
          if (attempt > 0 && error instanceof DuplicateAssetError) {
            updateItem(item.id, { status: 'done', progress: 100, waiting: false })
            return
          }
          const final =
            error instanceof PlanVideoRequiredError ||
            error instanceof DuplicateAssetError ||
            error instanceof UploadRefusedError ||
            attempt >= MAX_RESUMES ||
            !isInterruption(error)
          if (final) {
            updateItem(item.id, {
              status: 'error',
              waiting: false,
              videoPlan: error instanceof PlanVideoRequiredError,
              errorKey: error instanceof PlanVideoRequiredError ? undefined : uploadErrorKey(error),
            })
            return
          }
          // Suspended in the background / offline / a dropped request: wait
          // until the app is in front and online, then send the file again.
          updateItem(item.id, { waiting: true })
          await waitForForeground()
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          await waitForForeground()
          updateItem(item.id, { progress: 0 })
        }
      }
    },
    [galleryId, updateItem, watermarkText]
  )

  // While files go up: keep the phone screen on, and warn before closing the tab.
  const active = items.some((item) => item.status === 'uploading' || item.status === 'queued')
  useEffect(() => {
    if (!active) return
    const release = holdScreenAwake()
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      release()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])

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
      // HEIC from Windows/Android comes with an empty type: go by the extension.
      const files = Array.from(event.dataTransfer.files).filter((file) => {
        const type = file.type || mimeFromName(file.name) || ''
        return type.startsWith('image/') || type.startsWith('video/')
      })
      if (files.length > 0) void startUploads(files)
    },
    [startUploads]
  )

  return (
    <div>
      {pickPhoneLabel && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mb-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-3xl bg-accent px-6 text-[17px] font-extrabold text-white lg:hidden"
          data-testid="upload-pick-phone"
        >
          <span aria-hidden="true" className="text-2xl leading-none">+</span> {pickPhoneLabel}
        </button>
      )}
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
        data-testid="upload-drop"
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center text-sm leading-relaxed text-muted transition-colors ${
          emphasis ? 'min-h-[220px] py-12 sm:min-h-[260px]' : 'py-8'
        } ${dragOver ? 'border-accent bg-[#eef1ff]' : 'border-line bg-white hover:border-fg'}`}
      >
        <span aria-hidden className={`grid place-items-center rounded-full bg-[#eef1ff] text-accent ${emphasis ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg'}`}>
          ↑
        </span>
        <span className="max-w-md">{dropHint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.heic,.heif"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length > 0) void startUploads(files)
        }}
      />

      {active && backgroundHint && !items.some((item) => item.waiting) && (
        <p className="mt-4 text-sm text-muted lg:hidden" data-testid="upload-background-hint">
          {backgroundHint}
        </p>
      )}
      {pausedHint && items.some((item) => item.waiting && item.status === 'uploading') && (
        <p className="mt-4 text-sm text-accent" role="status" data-testid="upload-paused">
          {pausedHint}
        </p>
      )}

      {items.some((item) => item.videoPlan) && (
        <p className="mt-6 text-sm text-accent">
          {videoPlanNotice} <Link href={billingHref}>{videoPlanLink}</Link>
        </p>
      )}

      {items.length > 0 && (
        <p className="mt-5 text-sm font-bold text-fg" role="status" data-testid="upload-progress">
          {(progressLabel ?? '{done} / {total}')
            .replace('{done}', String(items.filter((item) => item.status === 'done').length))
            .replace('{total}', String(items.length))}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-muted">{item.file.name}</span>
                <span className="w-24 flex-none sm:w-40">
                  <span className="block h-1 w-full overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-1 transition-all ${
                        item.status === 'error' ? 'bg-red-600' : item.status === 'done' ? 'bg-emerald-600' : 'bg-fg'
                      }`}
                      style={{ width: `${item.status === 'error' ? 100 : item.progress}%` }}
                    />
                  </span>
                </span>
                <span className="w-10 flex-none text-right text-xs font-bold text-muted">
                  {item.status === 'done'
                    ? '✓'
                    : item.status === 'error'
                      ? '✕'
                      : item.waiting
                        ? '…'
                        : `${item.progress}%`}
                </span>
              </span>
              {item.status === 'error' && item.errorKey && (
                <span className="flex flex-wrap items-center gap-x-3 text-xs font-semibold text-red-700" role="alert">
                  {errorLabels?.[item.errorKey] ?? item.errorKey}
                  {item.errorKey === 'generic' && retryLabel && (
                    <button
                      type="button"
                      onClick={() => void uploadOne(item).then(() => router.refresh())}
                      className="font-bold text-fg underline"
                    >
                      {retryLabel}
                    </button>
                  )}
                  {item.errorKey === 'quota' && (
                    <Link href={billingHref} className="font-bold text-fg underline">
                      {videoPlanLink}
                    </Link>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

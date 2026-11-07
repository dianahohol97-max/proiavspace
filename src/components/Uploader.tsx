'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DuplicateAssetError, PlanVideoRequiredError, uploadFileToGallery } from '@/lib/upload/client'
import { holdScreenAwake, isInterruption, waitForForeground } from '@/lib/upload/foreground'
import { mimeFromName } from '@/lib/import/zip-plan'

/**
 * Direct-to-storage uploader. The per-file pipeline (presign → PUT → in-browser
 * renditions → complete) lives in lib/upload/client, shared with the zip
 * import; this component runs up to CONCURRENCY of them in parallel.
 *
 * On a phone: a big «Вибрати фото з телефона» button (the photo library,
 * HEIC included) instead of the drop zone; the screen is kept awake while
 * files go up; a file cut off because the app was switched away or the
 * network dropped waits («на паузі») and starts again once the app is back
 * in front and online (lib/upload/foreground).
 */

/** How many times one file is restarted after the app was suspended / offline. */
const MAX_RESUMES = 5

const CONCURRENCY = 5

type FileStatus = 'queued' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  progress: number // 0..100
  /** Rejected because the plan has no video (Free). */
  videoPlan?: boolean
  /** Paused: the app is in the background or offline; continues when it is back. */
  waiting?: boolean
}

export function Uploader({
  galleryId,
  dropHint,
  watermarkText,
  videoPlanNotice,
  videoPlanLink,
  billingHref,
  pickPhoneLabel,
  backgroundHint,
  pausedHint,
}: {
  galleryId: string
  dropHint: string
  /** Phone: the big button that opens the photo library. */
  pickPhoneLabel?: string
  /** Phone, while uploading: «можна згорнути застосунок». */
  backgroundHint?: string
  /** Shown while a file waits for the app to come back / the network. */
  pausedHint?: string
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
      updateItem(item.id, { status: 'uploading' })
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
            attempt >= MAX_RESUMES ||
            !isInterruption(error)
          if (final) {
            updateItem(item.id, { status: 'error', waiting: false, videoPlan: error instanceof PlanVideoRequiredError })
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
          className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-3xl bg-accent px-6 text-[17px] font-extrabold text-white lg:hidden"
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
        className={`${pickPhoneLabel ? 'hidden lg:block ' : ''}cursor-pointer border border-dashed px-8 py-12 text-center text-sm leading-relaxed text-muted transition-colors ${
          dragOver ? 'border-fg bg-fg/5' : 'border-line hover:border-fg'
        }`}
      >
        {dropHint}
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
                {item.status === 'done'
                  ? '✓'
                  : item.status === 'error'
                    ? '✕'
                    : item.waiting
                      ? '…'
                      : `${item.progress}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

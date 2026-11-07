'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlanVideoRequiredError, uploadFileToGallery } from '@/lib/upload/client'
import { listResumes } from '@/lib/upload/resumeStore'

/**
 * Direct-to-storage uploader. The per-file pipeline (presign → PUT → in-browser
 * renditions → complete) lives in lib/upload/client, shared with the zip
 * import; this component runs up to CONCURRENCY of them in parallel.
 *
 * CONCURRENCY is files in progress, not connections: every storage request of
 * the page shares one limit of 6 (lib/upload/transfer.ts). A couple of files
 * more than that keep the link busy while others wait for presign/complete or
 * for their previews (docs/UPLOAD_PERF.md).
 */

const CONCURRENCY = 8

type FileStatus = 'queued' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  progress: number // 0..100
  /** Rejected because the plan has no video (Free). */
  videoPlan?: boolean
  /** Paused: the network is gone, the upload continues when it is back. */
  waiting?: boolean
}

export function Uploader({
  galleryId,
  dropHint,
  watermarkText,
  videoPlanNotice,
  videoPlanLink,
  billingHref,
  resumeHint,
  networkWait,
}: {
  galleryId: string
  dropHint: string
  /** «{count} unfinished uploads: choose the same files to continue.» */
  resumeHint: string
  /** Status of a file paused until the network is back. */
  networkWait: string
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
  // Multipart uploads interrupted by a reload/closed tab (IndexedDB). Choosing
  // the same files continues them from the parts storage already has.
  const [unfinished, setUnfinished] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void listResumes(galleryId).then((records) => {
      if (alive) setUnfinished(records.map((record) => record.fileName))
    })
    return () => {
      alive = false
    }
  }, [galleryId])

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading' })
      try {
        await uploadFileToGallery({
          galleryId,
          file: item.file,
          watermarkText,
          onProgress: (progress) => updateItem(item.id, { progress }),
          onNetworkWait: (waiting) => updateItem(item.id, { waiting }),
        })
        updateItem(item.id, { status: 'done', progress: 100, waiting: false })
        setUnfinished((prev) => prev.filter((name) => name !== item.file.name))
      } catch (error) {
        updateItem(item.id, {
          status: 'error',
          waiting: false,
          videoPlan: error instanceof PlanVideoRequiredError,
        })
      }
    },
    [galleryId, updateItem, watermarkText]
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

      {unfinished.length > 0 && (
        <p className="mt-6 text-sm text-muted" data-testid="upload-resume-hint">
          {resumeHint.replace('{count}', String(unfinished.length))}{' '}
          <span className="text-fg">
            {unfinished.slice(0, 5).join(', ')}
            {unfinished.length > 5 ? '…' : ''}
          </span>
        </p>
      )}

      {items.some((item) => item.videoPlan) && (
        <p className="mt-6 text-sm text-accent">
          {videoPlanNotice} <Link href={billingHref}>{videoPlanLink}</Link>
        </p>
      )}

      {items.some((item) => item.waiting && item.status === 'uploading') && (
        <p className="mt-6 text-sm text-accent" role="status">
          {networkWait}
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
              <span
                className="w-16 text-right text-xs uppercase tracking-widest text-muted"
                title={item.waiting ? networkWait : undefined}
              >
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

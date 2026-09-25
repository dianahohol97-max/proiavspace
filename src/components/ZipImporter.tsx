'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Entry, FileEntry } from '@zip.js/zip.js'
import type { ImportReport } from '@/app/api/import/finish/route'
import { MAX_ZIP_BYTES, planZip, type ZipPlan } from '@/lib/import/zip-plan'
import { DuplicateAssetError, uploadFileToGallery } from '@/lib/upload/client'
import { MAX_FILE_BYTES } from '@/lib/upload/limits'

/**
 * Zip import: the zip is read IN THE BROWSER (random access via File.slice —
 * never loaded whole into memory, ZIP64 supported), each photo/video is
 * extracted one by one and goes through the very same upload pipeline as the
 * gallery Uploader: direct PUT to storage, in-browser renditions, complete.
 * No file byte ever passes through our servers.
 */

const CONCURRENCY = 3
const RETRIES = 1

export type ImporterStrings = Record<
  | 'title'
  | 'lede'
  | 'keepOpen'
  | 'limit'
  | 'choose'
  | 'reading'
  | 'tooLarge'
  | 'notZip'
  | 'encrypted'
  | 'nameLabel'
  | 'nameHint'
  | 'planTitle'
  | 'planGallery'
  | 'planSummary'
  | 'planUnsupported'
  | 'planDuplicateInZip'
  | 'planNoFiles'
  | 'start'
  | 'cancel'
  | 'quotaExceeded'
  | 'startError'
  | 'progress'
  | 'current'
  | 'reportTitle'
  | 'reportImported'
  | 'reportSize'
  | 'reportDuplicate'
  | 'reportUnsupported'
  | 'reportVideo'
  | 'reportFailed'
  | 'reportGalleries'
  | 'another'
  | 'back'
  | 'gb'
  | 'mb'
  | 'promoGranted'
  | 'promoLink',
  string
>

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  )
}

function formatSize(bytes: number, t: ImporterStrings): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1
    ? fill(t.gb, { n: Number(gb.toFixed(1)) })
    : fill(t.mb, { n: Math.max(Math.round(bytes / (1024 * 1024)), 0) })
}

/**
 * Many zip tools write UTF-8 names without setting the UTF-8 flag; zip.js
 * would then decode them as CP437 and garble Cyrillic. Take strict UTF-8 when
 * the bytes are valid UTF-8, otherwise leave it to zip.js's default.
 */
function decodeName(value: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value)
  } catch {
    return undefined
  }
}

type Phase =
  | { kind: 'idle'; error?: string }
  | { kind: 'reading' }
  | { kind: 'preview'; file: File; name: string; plan: ZipPlan }
  | { kind: 'running'; done: number; total: number; bytesDone: number; bytesTotal: number; current: string }
  | { kind: 'done'; report: ImportReport; galleries: { title: string; galleryId: string }[] }

interface StartResponse {
  importId: string
  videoAllowed: boolean
  galleries: { title: string; galleryId: string; existing: string[] }[]
}

export function ZipImporter({
  locale,
  watermarkText,
  t,
}: {
  locale: string
  watermarkText?: string
  t: ImporterStrings
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const entriesRef = useRef<Map<string, FileEntry>>(new Map())
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  // Closing the tab mid-import loses the files still in flight — warn.
  const running = phase.kind === 'running'
  useEffect(() => {
    if (!running) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [running])

  const readZip = useCallback(
    async (file: File) => {
      if (file.size > MAX_ZIP_BYTES) {
        setPhase({ kind: 'idle', error: fill(t.tooLarge, { max: formatSize(MAX_ZIP_BYTES, t) }) })
        return
      }
      setPhase({ kind: 'reading' })
      try {
        const { ZipReader, BlobReader } = await import('@zip.js/zip.js')
        const reader = new ZipReader(new BlobReader(file))
        const entries: Entry[] = await reader.getEntries({
          decodeText: (value) => decodeName(value),
        })
        const fileEntries = entries.filter((entry): entry is FileEntry => !entry.directory)
        if (fileEntries.some((entry) => entry.encrypted)) {
          setPhase({ kind: 'idle', error: t.encrypted })
          return
        }
        entriesRef.current = new Map(fileEntries.map((entry) => [entry.filename, entry]))
        const plan = planZip(
          file.name,
          entries.map((entry) => ({
            path: entry.filename,
            size: entry.uncompressedSize,
            directory: entry.directory,
          }))
        )
        setPhase({ kind: 'preview', file, name: file.name.replace(/\.zip$/i, ''), plan })
      } catch {
        setPhase({ kind: 'idle', error: t.notZip })
      }
    },
    [t]
  )

  const rename = useCallback((name: string) => {
    setPhase((prev) => {
      if (prev.kind !== 'preview') return prev
      const entries = [...entriesRef.current.values()]
      const plan = planZip(
        `${name.trim() || prev.file.name}.zip`,
        entries.map((entry) => ({
          path: entry.filename,
          size: entry.uncompressedSize,
          directory: false,
        }))
      )
      return { ...prev, name, plan }
    })
  }, [])

  const runImport = useCallback(
    async (file: File, plan: ZipPlan) => {
      setPhase({ kind: 'running', done: 0, total: 0, bytesDone: 0, bytesTotal: 0, current: '' })

      const startResponse = await fetch('/api/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipName: file.name,
          filesTotal: plan.filesTotal,
          galleries: plan.galleries.map((gallery) => ({
            title: gallery.title,
            files: gallery.files.map((f) => ({ name: f.name, size: f.size })),
          })),
        }),
      }).catch(() => null)

      if (!startResponse || !startResponse.ok) {
        const body = (await startResponse?.json().catch(() => null)) as {
          error?: string
          neededBytes?: number
          availableBytes?: number
        } | null
        setPhase({
          kind: 'idle',
          error:
            body?.error === 'storage_quota_exceeded'
              ? fill(t.quotaExceeded, {
                  need: formatSize(body.neededBytes ?? 0, t),
                  available: formatSize(body.availableBytes ?? 0, t),
                })
              : t.startError,
        })
        return
      }
      const started = (await startResponse.json()) as StartResponse
      const galleryIdByTitle = new Map(started.galleries.map((g) => [g.title, g]))

      let skippedDuplicate = plan.skippedDuplicateInZip
      let skippedUnsupported = plan.skippedUnsupported
      let skippedVideo = 0
      let failed = 0
      let imported = 0

      const tasks: {
        galleryId: string
        path: string
        name: string
        contentType: string
        size: number
        position: number
      }[] = []
      for (const gallery of plan.galleries) {
        const target = galleryIdByTitle.get(gallery.title)
        if (!target) continue
        const existing = new Set(target.existing)
        gallery.files.forEach((f, index) => {
          if (existing.has(f.name)) skippedDuplicate++
          else if (f.size > MAX_FILE_BYTES) skippedUnsupported++
          else if (f.contentType.startsWith('video/') && !started.videoAllowed) skippedVideo++
          else tasks.push({ galleryId: target.galleryId, ...f, position: index + 1 })
        })
      }

      const bytesTotal = tasks.reduce((sum, task) => sum + task.size, 0)
      let done = 0
      let bytesDone = 0
      const inFlight = new Map<string, number>()
      const report = (current: string) => {
        let partial = 0
        inFlight.forEach((bytes) => {
          partial += bytes
        })
        setPhase({
          kind: 'running',
          done,
          total: tasks.length,
          bytesDone: bytesDone + partial,
          bytesTotal,
          current,
        })
      }
      report('')

      const { BlobWriter } = await import('@zip.js/zip.js')
      const queue = [...tasks]
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let task = queue.shift(); task; task = queue.shift()) {
          const entry = entriesRef.current.get(task.path)
          const current = task
          let outcome: 'ok' | 'duplicate' | 'failed' = 'failed'
          for (let attempt = 0; attempt <= RETRIES && outcome === 'failed'; attempt++) {
            try {
              if (!entry) break
              inFlight.set(current.path, 0)
              report(current.name)
              const blob = await entry.getData(new BlobWriter(current.contentType))
              const extracted = new File([blob], current.name, { type: current.contentType })
              await uploadFileToGallery({
                galleryId: current.galleryId,
                file: extracted,
                watermarkText,
                onProgress: (percent) => {
                  inFlight.set(current.path, (current.size * percent) / 100)
                  report(current.name)
                },
                extra: {
                  originalName: current.name,
                  importId: started.importId,
                  position: current.position,
                },
              })
              outcome = 'ok'
            } catch (error) {
              if (error instanceof DuplicateAssetError) outcome = 'duplicate'
            }
          }
          inFlight.delete(current.path)
          if (outcome === 'ok') imported++
          if (outcome === 'duplicate') skippedDuplicate++
          if (outcome === 'failed') failed++
          done++
          bytesDone += current.size
          report('')
        }
      })
      await Promise.all(workers)

      const finishResponse = await fetch('/api/import/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importId: started.importId,
          skippedDuplicate,
          skippedUnsupported,
          skippedVideo,
          failed,
        }),
      }).catch(() => null)
      const finished = finishResponse?.ok
        ? ((await finishResponse.json()) as { report: ImportReport })
        : null

      setPhase({
        kind: 'done',
        report: finished?.report ?? {
          importedCount: imported,
          importedBytes: bytesDone,
          skippedDuplicate,
          skippedUnsupported,
          skippedVideo,
          failed,
          promoEndsAt: null,
        },
        galleries: started.galleries.map(({ title, galleryId }) => ({ title, galleryId })),
      })
    },
    [t, watermarkText]
  )

  return (
    <div className="max-w-2xl">
      <p className="leading-relaxed text-muted">{t.lede}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {fill(t.limit, { max: formatSize(MAX_ZIP_BYTES, t) })}
      </p>

      {phase.kind === 'idle' && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
          >
            {t.choose}
          </button>
          {phase.error && <p className="mt-4 text-sm text-accent">{phase.error}</p>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void readZip(file)
        }}
      />

      {phase.kind === 'reading' && <p className="mt-8 text-sm text-muted">{t.reading}</p>}

      {phase.kind === 'preview' && (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <label className="block text-sm font-bold" htmlFor="import-name">
            {t.nameLabel}
          </label>
          <input
            id="import-name"
            value={phase.name}
            maxLength={120}
            onChange={(event) => rename(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line px-3 py-2"
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">{t.nameHint}</p>

          <h2 className="mt-6 text-sm font-bold">{t.planTitle}</h2>
          {phase.plan.galleries.length === 0 ? (
            <p className="mt-2 text-sm text-accent">{t.planNoFiles}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {phase.plan.galleries.map((gallery) => (
                <li key={gallery.title} className="flex gap-4">
                  <span className="min-w-0 flex-1 truncate">{gallery.title}</span>
                  <span className="text-muted">
                    {fill(t.planGallery, { count: gallery.files.length })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted">
            {fill(t.planSummary, {
              files: phase.plan.galleries.reduce((sum, g) => sum + g.files.length, 0),
              size: formatSize(
                phase.plan.galleries.reduce(
                  (sum, g) => sum + g.files.reduce((s, f) => s + f.size, 0),
                  0
                ),
                t
              ),
            })}
          </p>
          {phase.plan.skippedUnsupported > 0 && (
            <p className="mt-1 text-sm text-muted">
              {fill(t.planUnsupported, { n: phase.plan.skippedUnsupported })}
            </p>
          )}
          {phase.plan.skippedDuplicateInZip > 0 && (
            <p className="mt-1 text-sm text-muted">
              {fill(t.planDuplicateInZip, { n: phase.plan.skippedDuplicateInZip })}
            </p>
          )}

          <p className="mt-6 text-sm leading-relaxed">{t.keepOpen}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={phase.plan.galleries.length === 0 || !phase.name.trim()}
              onClick={() => void runImport(phase.file, phase.plan)}
              className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              {t.start}
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              className="rounded-full border border-line px-7 py-3 text-sm font-bold"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'running' && (
        <div className="mt-8">
          <p className="text-sm font-bold">
            {fill(t.progress, { done: phase.done, total: phase.total })}
          </p>
          <span className="mt-3 block h-1 w-full bg-line">
            <span
              className="block h-1 bg-fg transition-all"
              style={{
                width: `${phase.bytesTotal ? Math.round((phase.bytesDone / phase.bytesTotal) * 100) : 0}%`,
              }}
            />
          </span>
          {phase.current && (
            <p className="mt-2 truncate text-xs text-muted">
              {fill(t.current, { name: phase.current })}
            </p>
          )}
          <p className="mt-6 text-sm leading-relaxed">{t.keepOpen}</p>
        </div>
      )}

      {phase.kind === 'done' && (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="font-brand text-2xl">{t.reportTitle}</h2>
          <ul className="mt-4 flex flex-col gap-1 text-sm">
            <li>{fill(t.reportImported, { n: phase.report.importedCount })}</li>
            <li>{fill(t.reportSize, { size: formatSize(phase.report.importedBytes, t) })}</li>
            {phase.report.skippedDuplicate > 0 && (
              <li>{fill(t.reportDuplicate, { n: phase.report.skippedDuplicate })}</li>
            )}
            {phase.report.skippedUnsupported > 0 && (
              <li>{fill(t.reportUnsupported, { n: phase.report.skippedUnsupported })}</li>
            )}
            {phase.report.skippedVideo > 0 && (
              <li>{fill(t.reportVideo, { n: phase.report.skippedVideo })}</li>
            )}
            {phase.report.failed > 0 && (
              <li className="text-accent">{fill(t.reportFailed, { n: phase.report.failed })}</li>
            )}
          </ul>
          {phase.report.promoEndsAt && (
            <p className="mt-6 rounded-xl bg-accent/10 p-4 text-sm leading-relaxed">
              {fill(t.promoGranted, {
                date: new Date(phase.report.promoEndsAt).toLocaleDateString(
                  locale === 'uk' ? 'uk-UA' : 'en-GB'
                ),
              })}{' '}
              <Link href={`/${locale}/dashboard/billing`}>{t.promoLink}</Link>
            </p>
          )}
          <p className="mt-6 text-sm font-bold">{t.reportGalleries}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {phase.galleries.map((gallery) => (
              <li key={gallery.galleryId}>
                <Link href={`/${locale}/dashboard/galleries/${gallery.galleryId}`}>
                  {gallery.title}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPhase({ kind: 'idle' })}
            className="mt-6 rounded-full border border-line px-7 py-3 text-sm font-bold"
          >
            {t.another}
          </button>
        </div>
      )}
    </div>
  )
}

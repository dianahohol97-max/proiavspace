'use client'

/**
 * Export dialog: format, which spreads, crop marks; shows the exact output
 * size and runs the in-browser export with a progress bar and cancel.
 */
import { useMemo, useRef, useState } from 'react'
import { dpiLevel, effectiveDpi } from '@/lib/album/crop'
import { formatFor, sheetSizePx } from '@/lib/album/geometry'
import { iccDescription } from '@/lib/album/export/icc'
import type { ExportKind, ExportProgress, OriginalUrlSource } from '@/lib/album/export/run'
import type { AlbumPhoto, AlbumProject } from '@/lib/album/types'
import { btn, btnPrimary, label } from './ui'

export function ExportDialog({
  project,
  photos,
  currentSpreadId,
  originalUrls,
  beforeExport,
  onClose,
}: {
  project: AlbumProject
  photos: AlbumPhoto[]
  currentSpreadId: string | null
  originalUrls: OriginalUrlSource
  /** Flush autosave first, so the export matches what is stored. */
  beforeExport(): Promise<void>
  onClose(): void
}) {
  const [kind, setKind] = useState<ExportKind>('pdf')
  const [scope, setScope] = useState<'all' | 'current'>('all')
  const [cropMarks, setCropMarks] = useState(true)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [doneName, setDoneName] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const effectiveScope = kind === 'psd' ? 'current' : scope
  const spreadIds = useMemo(
    () =>
      effectiveScope === 'current' && currentSpreadId
        ? [currentSpreadId]
        : project.spreads.filter((s) => s.slots.length > 0 || s.kind === 'cover').map((s) => s.id),
    [effectiveScope, currentSpreadId, project.spreads]
  )

  const sample = project.spreads.find((s) => s.id === (currentSpreadId ?? spreadIds[0])) ?? project.spreads[0]
  const size = sample ? sheetSizePx(formatFor(project.spec, sample.kind), project.spec.dpi) : null
  const photosById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])
  const lowDpi = useMemo(() => {
    let n = 0
    for (const s of project.spreads) {
      if (!spreadIds.includes(s.id)) continue
      for (const slot of s.slots) {
        const p = slot.assetId ? photosById.get(slot.assetId) : undefined
        if (p && dpiLevel(effectiveDpi(p.width, p.height, slot.w, slot.h, slot.zoom), project.spec.dpi) !== 'ok') n++
      }
    }
    return n
  }, [project, spreadIds, photosById])

  const start = async () => {
    setError(null)
    setDoneName(null)
    setProgress({ fraction: 0, label: 'Зберігаю зміни…' })
    const controller = new AbortController()
    abort.current = controller
    try {
      await beforeExport()
      const { runExport, saveBlob } = await import('@/lib/album/export/run')
      const result = await runExport({
        project,
        photos,
        kind,
        spreadIds,
        cropMarks,
        originalUrls,
        onProgress: setProgress,
        signal: controller.signal,
      })
      saveBlob(result.blob, result.fileName)
      setDoneName(result.fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Експорт не вдався')
    } finally {
      abort.current = null
      setProgress(null)
    }
  }

  const busy = progress !== null
  const options: [ExportKind, string, string][] = [
    ['pdf', 'PDF альбому', 'Кожен розворот — сторінка з вильотом, TrimBox/BleedBox, колірний профіль'],
    ['jpeg', 'JPEG розворотів', 'Точний розмір профілю з вильотом, DPI і ICC у файлі; кілька — ZIP'],
    ['psd', 'PSD розвороту', 'Поточний розворот, окремий шар на кожне фото'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Експорт">
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl">Експорт для друку</h2>
          <button className="text-2xl leading-none text-muted hover:text-fg" onClick={() => (abort.current ? abort.current.abort() : onClose())} aria-label="Закрити">
            ×
          </button>
        </div>
        <fieldset className="mt-4 flex flex-col gap-2" disabled={busy}>
          {options.map(([value, title, hint]) => (
            <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${kind === value ? 'border-fg' : 'border-line'}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="mt-1" />
              <span>
                <span className="block text-sm font-bold">{title}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" disabled={busy}>
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" checked={effectiveScope === 'all'} disabled={kind === 'psd'} onChange={() => setScope('all')} />
            Усі розвороти ({project.spreads.filter((s) => s.slots.length > 0 || s.kind === 'cover').length})
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" checked={effectiveScope === 'current'} onChange={() => setScope('current')} />
            Лише поточний
          </label>
          {kind === 'pdf' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} />
              Мітки обрізу
            </label>
          )}
        </fieldset>
        {size && (
          <p className="mt-4 rounded-xl bg-bg p-3 text-xs text-muted">
            <span className={label}>Вихід</span>
            <br />
            {size.width}×{size.height} px з вильотом · {project.spec.dpi} DPI · {iccDescription(project.spec.colorProfile)}.
            Рендер іде у вашому браузері по одному розвороту (~{Math.round((size.width * size.height * 4) / 1024 / 1024)} МБ пам'яті на розворот); оригінали
            завантажуються напряму зі сховища.
          </p>
        )}
        {lowDpi > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            ⚠ {lowDpi} фото дають менше {project.spec.dpi} DPI — у друці вони будуть м'якшими.
          </p>
        )}
        {progress && (
          <div className="mt-4" data-testid="export-progress">
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {Math.round(progress.fraction * 100)}% · {progress.label}
            </p>
          </div>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {doneName && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="export-done">
            Готово: {doneName}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {busy ? (
            <button className={btn} onClick={() => abort.current?.abort()}>
              Скасувати
            </button>
          ) : (
            <>
              <button className={btn} onClick={onClose}>
                Закрити
              </button>
              <button className={btnPrimary} onClick={start} disabled={!spreadIds.length}>
                Експортувати
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

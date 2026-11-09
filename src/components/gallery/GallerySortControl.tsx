'use client'

import { useState, useTransition } from 'react'
import type { SortMode, SortResult } from '@/lib/actions/galleries'
import type { GallerySortMode } from '@/lib/gallery/sortMode'

export interface SortLabels {
  /** «Порядок» */
  sortTitle: string
  /** «За часом зйомки» */
  sortByTaken: string
  /** «За часом завантаження» */
  sortByUpload: string
  /** Current mode: shot order, new frames take their places. */
  sortModeTaken: string
  /** Current mode: manual, new photos at the end. */
  sortModeManual: string
  /** «Час зйомки з EXIF є у {n} з {total} фото; решта стоять у кінці.» */
  sortCoverage: string
  sortWorking: string
  sortDoneTaken: string
  sortDoneManual: string
  /** Sorted, but the mode isn't remembered until the database update (0071). */
  sortModeNotSaved: string
  /** The sort function is missing (0067). */
  sortNotReady: string
  sortFailed: string
}

/**
 * Dashboard: the gallery's order mode (galleries.sort_mode, 0071) and the two
 * buttons that set it. «За часом зйомки» sorts by EXIF capture time and keeps
 * that mode — later uploads and zip imports take their places; «За часом
 * завантаження» returns to the manual order (new photos at the end).
 */
export function GallerySortControl({
  mode: initialMode,
  withTakenAt,
  total,
  labels,
  action,
}: {
  mode: GallerySortMode
  /** How many photos carry a capture time. */
  withTakenAt: number
  total: number
  labels: SortLabels
  action: (mode: SortMode) => Promise<SortResult>
}) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<GallerySortMode>(initialMode)
  const [message, setMessage] = useState<string | null>(null)

  const run = (next: SortMode) => {
    setMessage(null)
    startTransition(async () => {
      const result = await action(next).catch(() => ({ ok: false, error: 'failed' }) as SortResult)
      if (!result.ok) {
        setMessage(result.error === 'not_ready' ? labels.sortNotReady : labels.sortFailed)
        return
      }
      setMode(result.mode)
      if (!result.modeStored && next === 'taken') setMessage(labels.sortModeNotSaved)
      else setMessage(next === 'taken' ? labels.sortDoneTaken : labels.sortDoneManual)
    })
  }

  const btn = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
      on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-fg'
    }`

  return (
    <div className="mb-4" data-testid="gallery-sort" data-mode={mode}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
          {labels.sortTitle}
        </span>
        <button
          type="button"
          className={btn(mode === 'taken_at')}
          aria-pressed={mode === 'taken_at'}
          disabled={pending || withTakenAt === 0}
          onClick={() => run('taken')}
        >
          {labels.sortByTaken}
        </button>
        <button
          type="button"
          className={btn(mode === 'manual')}
          aria-pressed={mode === 'manual'}
          disabled={pending}
          onClick={() => run('uploaded')}
        >
          {labels.sortByUpload}
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted" data-testid="gallery-sort-mode">
        {mode === 'taken_at' ? labels.sortModeTaken : labels.sortModeManual}
      </p>
      <p className="text-xs text-muted" aria-live="polite" data-testid="gallery-sort-status">
        {pending
          ? labels.sortWorking
          : message ?? labels.sortCoverage.replace('{n}', String(withTakenAt)).replace('{total}', String(total))}
      </p>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import type { SortMode, SortResult } from '@/lib/actions/galleries'

/**
 * Dashboard: put the gallery in shot order (EXIF capture time, several cameras
 * interleaved) or back in upload order. One click rewrites the order the
 * client sees; the action re-checks ownership on the server.
 */
export function GallerySortControl({
  locale,
  withTakenAt,
  total,
  action,
}: {
  locale: string
  /** How many photos carry a capture time. */
  withTakenAt: number
  total: number
  action: (mode: SortMode) => Promise<SortResult>
}) {
  const uk = locale === 'uk'
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const run = (mode: SortMode) => {
    setMessage(null)
    startTransition(async () => {
      const result = await action(mode).catch(() => ({ ok: false, error: 'failed' }) as SortResult)
      if (result.ok) {
        setMessage(
          mode === 'taken'
            ? uk
              ? 'Готово: фото стоять за часом зйомки.'
              : 'Done: photos are in shot order.'
            : uk
              ? 'Готово: фото стоять за часом завантаження.'
              : 'Done: photos are in upload order.'
        )
      } else {
        setMessage(
          result.error === 'not_ready'
            ? uk
              ? 'Сортування ще не ввімкнене на сервері (потрібна міграція 0067).'
              : 'Sorting is not enabled on the server yet (migration 0067).'
            : uk
              ? 'Не вдалося впорядкувати. Спробуй ще раз.'
              : 'Could not sort. Please try again.'
        )
      }
    })
  }

  const btn =
    'rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-fg transition-colors hover:border-fg disabled:opacity-50'

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="gallery-sort">
      <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
        {uk ? 'Порядок' : 'Order'}
      </span>
      <button type="button" className={btn} disabled={pending || withTakenAt === 0} onClick={() => run('taken')}>
        {uk ? 'За часом зйомки' : 'By shot time'}
      </button>
      <button type="button" className={btn} disabled={pending} onClick={() => run('uploaded')}>
        {uk ? 'За часом завантаження' : 'By upload time'}
      </button>
      <span className="text-xs text-muted">
        {pending
          ? uk
            ? 'Впорядковую…'
            : 'Sorting…'
          : message ??
            (uk
              ? `Час зйомки з EXIF є у ${withTakenAt} з ${total} фото; решта стане в кінці.`
              : `${withTakenAt} of ${total} photos have an EXIF shot time; the rest go last.`)}
      </span>
    </div>
  )
}

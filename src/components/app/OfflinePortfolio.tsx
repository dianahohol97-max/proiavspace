'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  MAX_OFFLINE_GALLERIES,
  OfflineLimitError,
  OfflineQuotaError,
  formatMb,
  offlineSupported,
  readOfflineIndex,
  removeGalleryOffline,
  saveGalleryOffline,
  type OfflineGallery,
  type OfflinePack,
} from '@/lib/app/portfolio'
import type { Dictionary } from '@/lib/i18n'

export interface PortfolioCandidate {
  id: string
  title: string
  photoCount: number
  coverUrl: string | null
}

/**
 * «Портфоліо офлайн»: pick up to 3 galleries, keep their mobile previews on
 * the phone, open them full-screen without internet (public/app/offline.html).
 */
export function OfflinePortfolio({
  t,
  locale,
  galleries,
}: {
  t: Dictionary['app']
  locale: string
  galleries: PortfolioCandidate[]
}) {
  const [supported, setSupported] = useState(true)
  const [saved, setSaved] = useState<OfflineGallery[]>([])
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null)
  const [error, setError] = useState<{ id: string; text: string } | null>(null)

  const refresh = useCallback(async () => setSaved((await readOfflineIndex()).galleries), [])
  useEffect(() => {
    if (!offlineSupported()) {
      setSupported(false)
      return
    }
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (gallery: PortfolioCandidate) => {
      setError(null)
      setProgress({ id: gallery.id, done: 0, total: gallery.photoCount })
      try {
        const response = await fetch(`/api/offline-pack/${gallery.id}`)
        if (!response.ok) throw new Error(`pack ${response.status}`)
        const pack = (await response.json()) as OfflinePack
        if (pack.photos.length === 0) {
          setError({ id: gallery.id, text: t.offlineNoPhotos })
          return
        }
        await saveGalleryOffline(pack, (done, total) => setProgress({ id: gallery.id, done, total }))
        await refresh()
      } catch (cause) {
        const text =
          cause instanceof OfflineQuotaError
            ? t.offlineQuota
            : cause instanceof OfflineLimitError
              ? t.offlineLimit
              : t.offlineError
        setError({ id: gallery.id, text })
      } finally {
        setProgress(null)
      }
    },
    [refresh, t]
  )

  const remove = useCallback(
    async (id: string) => {
      await removeGalleryOffline(id)
      await refresh()
    },
    [refresh]
  )

  if (!supported) return <p className="rounded-2xl bg-white p-5 text-sm text-muted">{t.offlineUnsupported}</p>
  if (galleries.length === 0) return <p className="rounded-2xl bg-white p-5 text-sm text-muted">{t.offlineEmpty}</p>

  const full = saved.length >= MAX_OFFLINE_GALLERIES
  return (
    <div className="flex flex-col gap-3" data-testid="offline-portfolio">
      <p className="text-sm font-bold text-muted" data-testid="offline-count">
        {saved.length} / {MAX_OFFLINE_GALLERIES}
      </p>
      {full && <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900">{t.offlineLimit}</p>}
      <ul className="flex flex-col gap-3">
        {galleries.map((gallery) => {
          const kept = saved.find((entry) => entry.id === gallery.id)
          const busy = progress?.id === gallery.id
          return (
            <li key={gallery.id} className="rounded-3xl bg-white p-3 shadow-sm" data-testid="offline-item">
              <div className="flex items-center gap-3">
                <span
                  className="h-16 w-16 flex-none rounded-2xl bg-line bg-cover bg-center"
                  style={gallery.coverUrl ? { backgroundImage: `url("${gallery.coverUrl}")` } : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold">{gallery.title}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-muted" data-testid="offline-state">
                    {kept
                      ? t.offlineSaved.replace('{n}', String(kept.photos.length)).replace('{size}', formatMb(kept.bytes))
                      : busy && progress
                        ? t.offlineSaving.replace('{done}', String(progress.done)).replace('{total}', String(progress.total))
                        : t.offlinePhotos.replace('{n}', String(gallery.photoCount))}
                  </span>
                </span>
              </div>
              {busy && progress && progress.total > 0 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {kept ? (
                  <>
                    <a
                      href={`/app/offline.html?g=${encodeURIComponent(gallery.id)}&lang=${locale}`}
                      className="flex min-h-[48px] items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-white no-underline"
                      data-testid="offline-open"
                    >
                      {t.offlineOpen}
                    </a>
                    <button
                      type="button"
                      onClick={() => void remove(gallery.id)}
                      className="min-h-[48px] rounded-full border border-line px-4 text-sm font-bold"
                      data-testid="offline-remove"
                    >
                      {t.offlineRemove}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void save(gallery)}
                    disabled={Boolean(progress) || full || gallery.photoCount === 0}
                    className="col-span-2 min-h-[48px] rounded-full border border-fg px-4 text-sm font-bold disabled:opacity-40"
                    data-testid="offline-save"
                  >
                    {t.offlineSave}
                  </button>
                )}
              </div>
              {error?.id === gallery.id && (
                <p role="alert" className="mt-2 text-sm text-amber-800">
                  {error.text}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

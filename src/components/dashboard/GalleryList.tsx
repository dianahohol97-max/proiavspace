'use client'

import { intlLocale } from '@/lib/i18n/format'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { copyText } from '@/lib/clipboard'
import { filterAndSortGalleries, parseGallerySort, type GallerySort } from '@/lib/dashboard/gallery-list'
import type { GalleryDeliveryStatus } from '@/lib/types'

export interface GalleryCardData {
  id: string
  title: string
  slug: string
  is_published: boolean
  has_password: boolean
  event_date: string | null
  created_at: string
  updated_at: string
  delivery_status: GalleryDeliveryStatus | null
  delivery_eta: string | null
  coverUrl: string | null
  photoCount: number
  /** null when the plan has no statistics. */
  views: number | null
  /** «До закриття N дн.» etc. (Free plan), pre-rendered on the server. */
  freeBadge: { text: string; tone: 'red' | 'amber' | 'muted' } | null
}

export interface GalleryListLabels {
  searchPlaceholder: string
  sortLabel: string
  sorts: Record<GallerySort, string>
  nothingFound: string
  published: string
  draft: string
  photos: string
  views: string
  noPhotosYet: string
  copyLink: string
  copied: string
  upload: string
  share: string
  draftHint: string
  deliveryLabel: string
  deliveryNone: string
  deliveryShot: string
  deliveryEditing: string
  deliveryReady: string
  deliverySaveError: string
  galleriesCount: string
}

type SaveDelivery = (galleryId: string, status: string | null, eta: string | null) => Promise<{ ok: boolean }>

const SORT_KEY = 'proiav.dashboard.sort'

/** «Мої галереї»: search, sort and the quick actions on every card. */
export function GalleryList({
  galleries,
  locale,
  appUrl,
  labels,
  saveDelivery,
}: {
  galleries: GalleryCardData[]
  locale: string
  appUrl: string
  labels: GalleryListLabels
  saveDelivery: SaveDelivery
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<GallerySort>('newest')

  useEffect(() => {
    try {
      setSort(parseGallerySort(window.localStorage.getItem(SORT_KEY)))
    } catch {
      /* storage blocked — default sort */
    }
  }, [])

  function changeSort(next: GallerySort) {
    setSort(next)
    try {
      window.localStorage.setItem(SORT_KEY, next)
    } catch {
      /* fine without it */
    }
  }

  const shown = useMemo(() => filterAndSortGalleries(galleries, query, sort), [galleries, query, sort])
  const showTools = galleries.length > 1

  return (
    <>
      {showTools && (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="list-tools">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{labels.searchPlaceholder}</span>
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              data-testid="gallery-search"
              className="min-h-[44px] w-full rounded-full border border-line bg-white pl-9 pr-4 text-[16px] outline-none focus:border-fg sm:text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <span className="flex-none">{labels.sortLabel}</span>
            <select
              value={sort}
              onChange={(event) => changeSort(parseGallerySort(event.target.value))}
              data-testid="gallery-sort"
              className="min-h-[44px] min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm font-bold text-fg sm:flex-none"
            >
              {(Object.keys(labels.sorts) as GallerySort[]).map((key) => (
                <option key={key} value={key}>
                  {labels.sorts[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted" role="status">
          {labels.nothingFound.replace('{q}', query.trim())}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="gallery-cards">
          {shown.map((gallery) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              locale={locale}
              appUrl={appUrl}
              labels={labels}
              saveDelivery={saveDelivery}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function GalleryCard({
  gallery,
  locale,
  appUrl,
  labels,
  saveDelivery,
}: {
  gallery: GalleryCardData
  locale: string
  appUrl: string
  labels: GalleryListLabels
  saveDelivery: SaveDelivery
}) {
  const href = `/${locale}/dashboard/galleries/${gallery.id}`
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<string>(gallery.delivery_status ?? '')
  const [statusState, setStatusState] = useState<'idle' | 'saving' | 'error'>('idle')

  async function copy() {
    await copyText(`${appUrl.replace(/\/+$/, '')}/${locale}/g/${gallery.slug}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function changeStatus(next: string) {
    const previous = status
    setStatus(next)
    setStatusState('saving')
    try {
      const { ok } = await saveDelivery(gallery.id, next || null, gallery.delivery_eta)
      setStatusState(ok ? 'idle' : 'error')
      if (!ok) setStatus(previous)
    } catch {
      setStatus(previous)
      setStatusState('error')
    }
  }

  const action =
    'inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 text-xs font-bold text-fg no-underline transition-colors hover:border-fg'

  return (
    <li className="flex flex-col rounded-2xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md" data-testid="gallery-card">
      <Link href={href} className="group block no-underline" aria-label={gallery.title}>
        <span
          className="relative block aspect-[4/2.6] overflow-hidden rounded-xl bg-line bg-cover bg-center"
          style={gallery.coverUrl ? { backgroundImage: `url("${gallery.coverUrl}")` } : undefined}
        >
          {!gallery.coverUrl && (
            <span className="absolute inset-0 grid place-items-center text-sm font-bold text-muted">{labels.noPhotosYet}</span>
          )}
        </span>
        <span className="mt-3 block px-1">
          <span className="block truncate text-[15px] font-extrabold text-fg group-hover:text-accent">{gallery.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
            <span
              className={`rounded-full px-2.5 py-0.5 font-extrabold ${
                gallery.is_published ? 'bg-emerald-600/10 text-emerald-700' : 'bg-amber-500/15 text-amber-800'
              }`}
            >
              {gallery.is_published ? labels.published : labels.draft}
            </span>
            {gallery.has_password && <span aria-hidden>🔒</span>}
            <span>
              {gallery.photoCount} {labels.photos.toLowerCase()}
            </span>
            {gallery.event_date && <span>· {formatDate(gallery.event_date, locale)}</span>}
            {gallery.views !== null && (
              <span>
                · {gallery.views} {labels.views.toLowerCase()}
              </span>
            )}
            {gallery.freeBadge && (
              <span
                className={`rounded-full px-2.5 py-0.5 font-extrabold ${
                  gallery.freeBadge.tone === 'red'
                    ? 'bg-red-600/10 text-red-700'
                    : gallery.freeBadge.tone === 'amber'
                      ? 'bg-amber-500/15 text-amber-800'
                      : 'bg-bg text-muted'
                }`}
              >
                {gallery.freeBadge.text}
              </span>
            )}
          </span>
        </span>
      </Link>

      <div className="mt-3 flex gap-2 px-1">
        {gallery.is_published ? (
          <button type="button" onClick={copy} className={action} data-testid="card-copy">
            {copied ? labels.copied : `🔗 ${labels.copyLink}`}
          </button>
        ) : (
          <Link href={`${href}?share=1`} className={action} title={labels.draftHint} data-testid="card-share">
            ↗ {labels.share}
          </Link>
        )}
        <Link href={`${href}?tab=photos#upload`} className={action} data-testid="card-upload">
          ＋ {labels.upload}
        </Link>
      </div>

      <label className="mt-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted">
        <span className="flex-none">{labels.deliveryLabel}</span>
        <select
          value={status}
          onChange={(event) => void changeStatus(event.target.value)}
          disabled={statusState === 'saving'}
          data-testid="card-delivery"
          className="min-h-[40px] min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-xs font-bold text-fg disabled:opacity-60"
        >
          <option value="">{labels.deliveryNone}</option>
          <option value="shot">{labels.deliveryShot}</option>
          <option value="editing">{labels.deliveryEditing}</option>
          <option value="ready">{labels.deliveryReady}</option>
        </select>
      </label>
      {statusState === 'error' && (
        <p role="alert" className="mt-1 px-1 text-xs font-semibold text-red-700">
          {labels.deliverySaveError}
        </p>
      )}
    </li>
  )
}

function formatDate(value: string, locale: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlLocale(locale), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

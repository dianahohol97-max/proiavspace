'use client'

import { useEffect, useState } from 'react'
import type { PortfolioGroup } from './SiteRenderer'

export interface AlbumLabels {
  /** Section / fallback album title, e.g. «Портфоліо». */
  portfolio: string
  /** Count word, e.g. «фото». */
  photos: string
  /** «Дивитись серію» — opens the album. */
  viewSeries: string
  /** Close button in the lightbox. */
  close: string
}

/**
 * Portfolio as ALBUMS (folders): each category is a series with a cover, an
 * index, a title and a «Дивитись серію» link; clicking opens a lightbox with
 * the whole album. Editorial layout with a gentle vertical stagger. Inherits
 * the theme's CSS vars; the lightbox is a neutral dark overlay.
 */
export function PortfolioAlbums({
  groups,
  labels,
  covers = {},
}: {
  groups: PortfolioGroup[]
  labels: AlbumLabels
  /** category → chosen cover asset id; absent falls back to the first photo. */
  covers?: Record<string, string>
}) {
  const [open, setOpen] = useState<number | null>(null)
  const album = open !== null ? groups[open] : null

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const mono: React.CSSProperties = {
    fontFamily: 'var(--site-font-label)',
    fontSize: 11,
    letterSpacing: '.16em',
    textTransform: 'uppercase',
    color: 'var(--site-muted)',
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '10px 24px',
          alignItems: 'start',
        }}
      >
        {groups.map((group, i) => {
          const chosenId = covers[group.category ?? '']
          const cover =
            group.items.find((it) => it.id === chosenId)?.previewUrl ??
            group.items[0]?.previewUrl ??
            null
          const title = group.category ?? labels.portfolio
          const idx = String(i + 1).padStart(2, '0')
          return (
            <figure
              key={group.category ?? `_${i}`}
              style={{ margin: 0, marginTop: i % 3 === 1 ? 44 : 0 }}
            >
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={title}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '4 / 5',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  background: cover
                    ? `center / cover no-repeat url("${cover}")`
                    : 'var(--site-line)',
                }}
              />
              <figcaption style={{ marginTop: 12 }}>
                <span style={{ ...mono, display: 'block' }}>
                  ({idx}) · {group.items.length} {labels.photos}
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--site-font-display)',
                    fontSize: 20,
                    lineHeight: 1.2,
                    margin: '6px 0 10px',
                  }}
                >
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  style={{
                    ...mono,
                    color: 'inherit',
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  {labels.viewSeries}
                </button>
              </figcaption>
            </figure>
          )
        })}
      </div>

      {album && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(12,11,10,0.93)',
            overflowY: 'auto',
            padding: 'clamp(16px, 4vw, 48px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 1120, margin: '0 auto', color: '#fff' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
                {album.category ?? labels.portfolio}{' '}
                <span style={{ opacity: 0.6, fontSize: 14 }}>
                  · {album.items.length} {labels.photos}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setOpen(null)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '8px 16px',
                }}
              >
                ✕ {labels.close}
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 14,
              }}
            >
              {album.items.map((item) =>
                item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.id}
                    src={item.previewUrl}
                    alt={item.caption ?? ''}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : null
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

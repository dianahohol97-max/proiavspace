'use client'

import { useCallback, useState } from 'react'
import { AlbumLightbox, type AlbumLabels } from '../PortfolioAlbums'
import type { PortfolioGroup } from '../SiteRenderer'
import { DevelopImage } from '../motion/DevelopImage'
import { Reveal } from '../motion/Reveal'
import t from './Tysha.module.css'

/**
 * Series as large covers in two staggered columns: index number, series name,
 * photo count and an underlined «Дивитись серію». Cover or link opens the
 * shared album lightbox.
 */
export function TyshaAlbums({
  groups,
  covers,
  labels,
}: {
  groups: PortfolioGroup[]
  covers: Record<string, string>
  labels: AlbumLabels
}) {
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const album = open !== null ? groups[open] : null

  return (
    <>
      <div className={t.series}>
        {groups.map((group, i) => {
          const chosen = covers[group.category ?? '']
          const cover =
            group.items.find((it) => it.id === chosen)?.previewUrl ??
            group.items.find((it) => it.previewUrl)?.previewUrl ??
            null
          const title = group.category ?? labels.portfolio
          return (
            <Reveal key={group.category ?? `_${i}`} as="figure" className={t.seriesItem} delay={(i % 2) * 0.12}>
              <button type="button" className={t.seriesCover} onClick={() => setOpen(i)} aria-label={`${labels.viewSeries}: ${title}`}>
                {cover && (
                  <DevelopImage
                    src={cover}
                    alt=""
                    sizes="(max-width: 760px) 100vw, 46vw"
                    objectPosition="50% 35%"
                  />
                )}
              </button>
              <figcaption className={t.seriesMeta}>
                <span className={t.seriesNo}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={t.seriesName}>{title}</h3>
                <span className={t.seriesCount}>
                  <span className={t.label}>
                    {group.items.length} {labels.photos}
                  </span>
                  <button type="button" className={t.textLink} onClick={() => setOpen(i)}>
                    {labels.viewSeries}
                  </button>
                </span>
              </figcaption>
            </Reveal>
          )
        })}
      </div>
      {album && <AlbumLightbox album={album} labels={labels} onClose={close} />}
    </>
  )
}

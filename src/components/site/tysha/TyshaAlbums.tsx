'use client'

import { useCallback, useState } from 'react'
import { AlbumLightbox, type AlbumLabels } from '../PortfolioAlbums'
import type { PortfolioGroup, PortfolioItem } from '../SiteRenderer'
import { DevelopImage } from '../motion/DevelopImage'
import { Reveal } from '../motion/Reveal'
import tysha from './Tysha.module.css'

/** A theme's CSS-module class map with the same class names (default: «Тиша»). */
export type Skin = Record<string, string>

/**
 * Series as large covers in two staggered columns (two small columns on
 * phones): index number, series name, photo count and an underlined
 * «Дивитись серію». Cover or link opens the shared album lightbox.
 * `covers` is decided on the server (ThemeTysha): the first frame of the
 * series that the page has not shown yet.
 */
export function TyshaAlbums({
  groups,
  covers,
  labels,
  skin,
  reveal = 'develop',
}: {
  groups: PortfolioGroup[]
  covers: Record<string, { src: string; srcSet?: string }>
  labels: AlbumLabels
  /** Class names of another theme (e.g. «Опівніч»); defaults to «Тиша». */
  skin?: Skin
  /** How covers enter: «Тиша» develops them, «Опівніч» brings them out of the dark. */
  reveal?: 'develop' | 'dark'
}) {
  const t = skin ?? tysha
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const album = open !== null ? groups[open] : null

  return (
    <>
      <div className={t.series}>
        {groups.map((group, i) => {
          const key = group.category ?? ''
          const first = group.items.find((it) => it.previewUrl)?.previewUrl
          const cover = covers[key] ?? (first ? { src: first } : undefined)
          const title = group.category ?? labels.portfolio
          return (
            <Reveal key={key || `_${i}`} as="figure" className={t.seriesItem} delay={(i % 2) * 0.12}>
              <button
                type="button"
                className={t.seriesCover}
                onClick={() => setOpen(i)}
                aria-label={`${labels.viewSeries}: ${title}`}
              >
                {cover && (
                  <DevelopImage
                    src={cover.src}
                    srcSet={cover.srcSet}
                    alt=""
                    sizes="(max-width: 760px) 50vw, 46vw"
                    objectPosition="50% 35%"
                    from={reveal}
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

/** «Усе портфоліо →» under the selected frames: every photo in the lightbox. */
export function AllPortfolio({
  items,
  label,
  labels,
  skin,
}: {
  items: PortfolioItem[]
  label: string
  labels: Pick<AlbumLabels, 'portfolio' | 'photos' | 'close'>
  /** Class names of another theme (e.g. «Опівніч»); defaults to «Тиша». */
  skin?: Skin
}) {
  const t = skin ?? tysha
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button type="button" className={`${t.textLink} ${t.allLink}`} onClick={() => setOpen(true)}>
        {label} <span className={t.arrow}>→</span>
      </button>
      {open && (
        <AlbumLightbox album={{ category: labels.portfolio, items }} labels={labels} onClose={close} />
      )}
    </>
  )
}

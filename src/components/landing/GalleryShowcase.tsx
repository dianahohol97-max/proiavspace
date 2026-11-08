'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Landing showcase of the gallery design studio: real demo photos
 * (public/themes — the same set the live demo uses) laid out with the actual
 * layout math from the client gallery, with working layout/theme switches so
 * visitors feel the constructor before signing up.
 */

/**
 * One coherent wedding story in the Norwegian mountains — the same shoot the
 * live demo uses (/themes 01–24). `ratio` is the file's real proportion, so
 * masonry shows true verticals/horizontals; `pos` is the crop focus
 * (object-position) that keeps the couple in square/portrait tiles.
 */
const PHOTOS: { src: string; ratio: string; pos: string; alt: 1 | 2 | 3 | 4 | 5 | 6 }[] = [
  { src: '/themes/15.webp', ratio: '3 / 2', pos: '55% 40%', alt: 1 },
  { src: '/themes/18.webp', ratio: '2 / 3', pos: '50% 35%', alt: 2 },
  { src: '/themes/01.webp', ratio: '3 / 2', pos: '60% 55%', alt: 3 },
  { src: '/themes/13.webp', ratio: '2 / 3', pos: '50% 60%', alt: 4 },
  { src: '/themes/16.webp', ratio: '3 / 2', pos: '42% 45%', alt: 5 },
  { src: '/themes/21.webp', ratio: '3 / 2', pos: '48% 65%', alt: 6 },
]

const THEMES = {
  light: { name: 'themeLight', bg: '#faf9f7', fg: '#17161a', line: '#e7e4dd', mut: '#8a8781' },
  dark: { name: 'themeDark', bg: '#1b1a18', fg: '#f5f2ec', line: '#37342e', mut: '#a09b90' },
  cream: { name: 'themeCream', bg: '#f4efe6', fg: '#26242a', line: '#ddd5c6', mut: '#8d8676' },
} as const

const LAYOUTS = [
  { key: 'masonry', name: 'layoutMasonry' },
  { key: 'square', name: 'layoutSquare' },
  { key: 'portrait', name: 'layoutPortrait' },
  { key: 'collage', name: 'layoutCollage' },
  { key: 'editorial', name: 'layoutEditorial' },
] as const

type LayoutKey = (typeof LAYOUTS)[number]['key']
type ThemeKey = keyof typeof THEMES

export interface ShowcaseLabels {
  couple: string
  picked: string
  slideshow: string
  downloadAll: string
  brandLine: string
  openDemo: string
  create: string
  photoAlt: Record<1 | 2 | 3 | 4 | 5 | 6, string>
  themeLight: string
  themeDark: string
  themeCream: string
  layoutMasonry: string
  layoutSquare: string
  layoutPortrait: string
  layoutCollage: string
  layoutEditorial: string
}

export function GalleryShowcase({
  locale,
  labels,
  ctaPrimary,
  ctaGhost,
}: {
  locale: string
  labels: ShowcaseLabels
  /** Landing pill classes so the CTAs match the site's own buttons/fonts. */
  ctaPrimary?: string
  ctaGhost?: string
}) {
  const [layout, setLayout] = useState<LayoutKey>('collage')
  const [themeKey, setThemeKey] = useState<ThemeKey>('light')
  const th = THEMES[themeKey]

  // Same tile math as the client gallery (GalleryExperience):
  // portrait crops 3:4, collage promotes every 6th to 2×2, editorial
  // alternates a wide hero with squares; masonry keeps varied proportions.
  const wide = (i: number) => i % 4 === 0 || i % 4 === 3
  const aspect = (i: number) =>
    layout === 'masonry'
      ? PHOTOS[i].ratio
      : layout === 'portrait'
        ? '3 / 4'
        : layout === 'editorial' && wide(i)
          ? '2 / 1'
          : '1 / 1'
  const span = (i: number): React.CSSProperties =>
    layout === 'collage' && i % 6 === 0
      ? { gridColumn: 'span 2', gridRow: 'span 2' }
      : layout === 'editorial' && wide(i)
        ? { gridColumn: 'span 2' }
        : {}

  const seg = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      on ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
    }`

  return (
    <div className="mx-auto max-w-4xl px-6">
      {/* controls */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-line p-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={seg(layout === l.key)}
              onClick={() => setLayout(l.key)}
            >
              {labels[l.name]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              title={labels[THEMES[key].name]}
              aria-label={labels[THEMES[key].name]}
              onClick={() => setThemeKey(key)}
              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                themeKey === key ? 'border-fg' : 'border-line'
              }`}
              style={{ background: THEMES[key].bg }}
            />
          ))}
        </div>
      </div>

      {/* live gallery mock */}
      <div
        className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-line shadow-[0_24px_60px_-32px_rgba(13,12,10,.35)]"
        style={{ background: th.bg, color: th.fg }}
      >
        <div
          className="relative flex items-center"
          style={{
            height: 220,
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.42)), url("/themes/07.webp")',
            backgroundSize: 'cover',
            // the couple's faces sit just above the middle of the cover shot
            backgroundPosition: '48% 35%',
          }}
        >
          <div className="w-full p-5 text-center text-white">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">2026</p>
            <p
              className="text-3xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', textShadow: '0 1px 12px rgba(0,0,0,.35)' }}
            >
              {labels.couple}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-5 py-2.5 text-[11px] uppercase tracking-wider"
          style={{ borderBottom: `1px solid ${th.line}`, color: th.mut }}
        >
          <span>♥ 3 {labels.picked}</span>
          <span>▶ {labels.slideshow}</span>
          <span
            className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold"
            style={{ background: th.fg, color: th.bg }}
          >
            {labels.downloadAll}
          </span>
        </div>
        <div
          className="p-4"
          style={
            layout === 'masonry'
              ? { columns: 3, columnGap: 12 }
              : {
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridAutoFlow: layout === 'collage' ? 'dense' : undefined,
                }
          }
        >
          {PHOTOS.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.src}
              src={photo.src}
              alt={labels.photoAlt[photo.alt]}
              decoding="async"
              loading="lazy"
              className="w-full object-cover"
              style={{
                aspectRatio: aspect(i),
                objectPosition: photo.pos,
                borderRadius: 10,
                ...(layout === 'masonry'
                  ? { breakInside: 'avoid' as const, marginBottom: 12 }
                  : span(i)),
              }}
            />
          ))}
        </div>
        <p
          className="pb-5 text-center text-[13px]"
          style={{ color: th.mut, fontFamily: 'Georgia, serif' }}
        >
          {labels.brandLine}
        </p>
      </div>

      {/* CTAs — landing pill styles so fonts/shape match the site */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href={`/${locale}/gallery-demo`}
          className={
            ctaGhost ??
            'rounded-full border border-fg px-6 py-2.5 text-sm font-bold no-underline transition-colors hover:bg-fg hover:text-bg'
          }
        >
          {labels.openDemo}
        </Link>
        <Link
          href={`/${locale}/login`}
          className={
            ctaPrimary ??
            'rounded-full bg-fg px-6 py-2.5 text-sm font-bold text-bg no-underline transition-opacity hover:opacity-85'
          }
        >
          {labels.create}
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Landing showcase of the gallery design studio: real demo photos
 * (public/themes — the same set the live demo uses) laid out with the actual
 * layout math from the client gallery, with working layout/theme switches so
 * visitors feel the constructor before signing up.
 */

const PHOTOS = [
  '/themes/02.jpg',
  '/themes/05.jpg',
  '/themes/03.jpg',
  '/themes/07.jpg',
  '/themes/08.jpg',
  '/themes/04.jpg',
  '/themes/06.jpg',
  '/themes/09.jpg',
]

const THEMES = {
  light: { name: ['Світла', 'Light'], bg: '#faf9f7', fg: '#17161a', line: '#e7e4dd', mut: '#8a8781' },
  dark: { name: ['Темна', 'Dark'], bg: '#1b1a18', fg: '#f5f2ec', line: '#37342e', mut: '#a09b90' },
  cream: { name: ['Крем', 'Cream'], bg: '#f4efe6', fg: '#26242a', line: '#ddd5c6', mut: '#8d8676' },
} as const

const LAYOUTS = [
  { key: 'masonry', name: ['Мозаїка', 'Masonry'] },
  { key: 'square', name: ['Квадрати', 'Squares'] },
  { key: 'portrait', name: ['Портрет 3:4', 'Portrait 3:4'] },
  { key: 'collage', name: ['Колаж', 'Collage'] },
  { key: 'editorial', name: ['Едіторіал', 'Editorial'] },
] as const

/** The demo files are square, so masonry re-crops them to a believable mix of
 *  verticals/horizontals via object-fit — visually identical to real ratios. */
const MASONRY_RATIOS = ['3 / 4', '1 / 1', '4 / 5', '4 / 3', '3 / 4', '4 / 3', '4 / 5', '1 / 1']

type LayoutKey = (typeof LAYOUTS)[number]['key']
type ThemeKey = keyof typeof THEMES

export function GalleryShowcase({ locale }: { locale: string }) {
  const uk = locale === 'uk'
  const i18n = uk ? 0 : 1
  const [layout, setLayout] = useState<LayoutKey>('collage')
  const [themeKey, setThemeKey] = useState<ThemeKey>('light')
  const th = THEMES[themeKey]

  // Same tile math as the client gallery (GalleryExperience):
  // portrait crops 3:4, collage promotes every 6th to 2×2, editorial
  // alternates a wide hero with squares; masonry keeps varied proportions.
  const wide = (i: number) => i % 4 === 0 || i % 4 === 3
  const aspect = (i: number) =>
    layout === 'masonry'
      ? MASONRY_RATIOS[i % MASONRY_RATIOS.length]
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
    <section id="galleries" className="mx-auto max-w-6xl px-6 py-20" style={{ scrollMarginTop: 90 }}>
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-accent">
          {uk ? 'Дизайн-студія' : 'Design studio'}
        </span>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">
          {uk ? 'Галерея, яку хочеться переслати друзям' : 'A gallery clients love to share'}
        </h2>
        <p className="mt-4 text-muted">
          {uk
            ? 'Розкладка, тема, шрифти, відступи й обкладинка — усе налаштовується, і зміни видно одразу. Спробуй просто тут:'
            : 'Layout, theme, fonts, spacing and cover — all adjustable with a live preview. Try it right here:'}
        </p>
      </div>

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
              {l.name[i18n]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              title={THEMES[key].name[i18n]}
              aria-label={THEMES[key].name[i18n]}
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
              'linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.42)), url("/themes/01.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: '50% 35%',
          }}
        >
          <div className="w-full p-5 text-center text-white">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">2026</p>
            <p
              className="text-3xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', textShadow: '0 1px 12px rgba(0,0,0,.35)' }}
            >
              {uk ? 'Марта і Богдан' : 'Marta & Bohdan'}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-5 py-2.5 text-[11px] uppercase tracking-wider"
          style={{ borderBottom: `1px solid ${th.line}`, color: th.mut }}
        >
          <span>♥ 3 {uk ? 'обрано' : 'picked'}</span>
          <span>▶ {uk ? 'Слайд-шоу' : 'Slideshow'}</span>
          <span
            className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold"
            style={{ background: th.fg, color: th.bg }}
          >
            {uk ? 'Завантажити все' : 'Download all'}
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
          {PHOTOS.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              loading="lazy"
              className="w-full object-cover"
              style={{
                aspectRatio: aspect(i),
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
          {uk ? 'ваш бренд · фотографія' : 'your brand · photography'}
        </p>
      </div>

      {/* CTAs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href={`/${locale}/gallery-demo`}
          className="rounded-full border border-fg px-6 py-2.5 text-sm font-bold no-underline transition-colors hover:bg-fg hover:text-bg"
        >
          {uk ? 'Відкрити живу демо-галерею' : 'Open the live demo gallery'}
        </Link>
        <Link
          href={`/${locale}/login`}
          className="rounded-full bg-fg px-6 py-2.5 text-sm font-bold text-bg no-underline transition-opacity hover:opacity-85"
        >
          {uk ? 'Створити свою — безкоштовно' : 'Create yours — free'}
        </Link>
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LandingPhoto } from '@/components/landing/LandingPhoto'

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
/** `src` is a stem in public/landing/img (AVIF/WebP at 360/720/1080w). */
const PHOTOS: { src: string; ratio: string; pos: string; alt: { uk: string; en: string } }[] = [
  { src: 'themes-15', ratio: '3 / 2', pos: '55% 40%', alt: { uk: 'Наречені йдуть сільською дорогою в горах, тримаючись за руки — кадр весільної онлайн-галереї', en: 'Bride and groom walking hand in hand down a mountain road' } },
  { src: 'themes-18', ratio: '2 / 3', pos: '50% 35%', alt: { uk: 'Наречені торкаються чолами — крупний план у клієнтській галереї', en: 'Newlyweds touching foreheads, close-up' } },
  { src: 'themes-01', ratio: '3 / 2', pos: '60% 55%', alt: { uk: 'Наречені біля деревʼяного паркану на тлі гір', en: 'Newlyweds by a wooden fence with mountains behind' } },
  { src: 'themes-13', ratio: '2 / 3', pos: '50% 60%', alt: { uk: 'Наречені обіймаються на зеленому схилі в горах', en: 'Newlyweds embracing on a green mountain slope' } },
  { src: 'themes-16', ratio: '3 / 2', pos: '42% 45%', alt: { uk: 'Поцілунок нареченої й нареченого серед сосен', en: 'Bride and groom kissing among pine trees' } },
  { src: 'themes-21', ratio: '3 / 2', pos: '48% 65%', alt: { uk: 'Наречені цілуються посеред гірської дороги', en: 'Newlyweds kissing in the middle of a mountain road' } },
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

type LayoutKey = (typeof LAYOUTS)[number]['key']
type ThemeKey = keyof typeof THEMES

export function GalleryShowcase({
  locale,
  ctaPrimary,
  ctaGhost,
}: {
  locale: string
  /** Landing pill classes so the CTAs match the site's own buttons/fonts. */
  ctaPrimary?: string
  ctaGhost?: string
}) {
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
        <div className="relative flex items-center overflow-hidden" style={{ height: 220 }}>
          <LandingPhoto
            name="themes-07"
            kind="cover"
            sizes="(max-width: 800px) 100vw, 768px"
            width={3}
            height={2}
            className="absolute inset-0 h-full w-full object-cover"
            // the couple's faces sit just above the middle of the cover shot
            style={{ objectPosition: '48% 35%' }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.42))' }}
          />
          <div className="relative w-full p-5 text-center text-white">
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
          {PHOTOS.map((photo, i) => {
            const style = span(i)
            const big = layout !== 'masonry' && Boolean(style.gridColumn)
            const [w, h] = photo.ratio.split(' / ').map(Number)
            return (
              <LandingPhoto
                key={photo.src}
                name={photo.src}
                kind="themes"
                alt={uk ? photo.alt.uk : photo.alt.en}
                // 3 columns inside a ≤768px card; collage/editorial heroes span 2
                sizes={big ? '(max-width: 800px) 62vw, 500px' : '(max-width: 800px) 31vw, 250px'}
                width={w}
                height={h}
                className="w-full object-cover"
                style={{
                  aspectRatio: aspect(i),
                  objectPosition: photo.pos,
                  borderRadius: 10,
                  ...(layout === 'masonry' ? { breakInside: 'avoid' as const, marginBottom: 12 } : style),
                }}
              />
            )
          })}
        </div>
        <p
          className="pb-5 text-center text-[13px]"
          style={{ color: th.mut, fontFamily: 'Georgia, serif' }}
        >
          {uk ? 'ваш бренд · фотографія' : 'your brand · photography'}
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
          {uk ? 'Відкрити живу демо-галерею' : 'Open the live demo gallery'}
        </Link>
        <Link
          href={`/${locale}/login`}
          className={
            ctaPrimary ??
            'rounded-full bg-fg px-6 py-2.5 text-sm font-bold text-bg no-underline transition-opacity hover:opacity-85'
          }
        >
          {uk ? 'Створити свою — безкоштовно' : 'Create yours — free'}
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { resolveGalleryTokens, GALLERY_CATALOG as THEME_CATALOG } from '@/lib/site/themes'
import type { Dictionary } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n/format'
import {
  ACCENT_PRESETS,
  COLUMN_CHOICES,
  COVER_CHOICES,
  FONT_PRESETS,
  LAYOUT_CHOICES,
  RADIUS_CHOICES,
  fontFamily,
  type GalleryStyle,
} from '@/lib/gallery/style'

type DesignerLabels = Dictionary['designer'] & {
  styleLabel: string
  styleSave: string
  styleSaved: string
}

/** Option key → dictionary key (the option lists live in lib/gallery/style). */
const LAYOUT_LABEL = {
  masonry: 'layoutMasonry',
  square: 'layoutSquare',
  portrait: 'layoutPortrait',
  collage: 'layoutCollage',
  editorial: 'layoutEditorial',
  rows: 'layoutRows',
} as const
const COVER_LABEL = { classic: 'coverClassic', left: 'coverLeft', minimal: 'coverMinimal' } as const
const RADIUS_LABEL: Record<number, keyof Dictionary['designer']> = { 0: 'radiusSharp', 10: 'radiusSoft', 22: 'radiusRound' }
const FONT_LABEL: Record<string, keyof Dictionary['designer']> = {
  '': 'fontTheme',
  serif: 'fontSerif',
  didone: 'fontDidone',
  palatino: 'fontPalatino',
  sans: 'fontSans',
  condensed: 'fontCondensed',
  rounded: 'fontRounded',
  mono: 'fontMono',
}
const ACCENT_LABEL: Record<string, keyof Dictionary['designer']> = {
  '': 'accentTheme',
  '#2f55ff': 'accentBlue',
  '#c8331f': 'accentRed',
  '#b8860b': 'accentGold',
  '#3f6f4f': 'accentGreen',
  '#6b3f6b': 'accentPlum',
  '#26242a': 'accentGraphite',
}

/**
 * Gallery design studio: the editor competitors hide in side panels, opened
 * up — a control rail on the left and a LIVE preview built from the gallery's
 * REAL photos on the right, with a desktop/phone toggle. Visual theme cards
 * (mini palettes) replace the old dropdown; accent has a free color picker on
 * top of the presets. Saves through the same server action contract
 * (theme + accent/columns/radius/font/focalX/focalY).
 */
export function GalleryDesigner({
  action,
  themeOptions,
  initialTheme,
  initialStyle,
  coverUrl,
  photos = [],
  galleryTitle,
  locale = 'uk',
  labels,
}: {
  action: (formData: FormData) => Promise<void>
  themeOptions: { value: string; label: string }[]
  initialTheme: string
  initialStyle: GalleryStyle
  /** Real gallery cover, so the preview + focal pad show the actual photo. */
  coverUrl?: string | null
  /** Real photo preview URLs — the live preview renders the actual shoot. */
  photos?: string[]
  galleryTitle?: string
  locale?: string
  labels: DesignerLabels
}) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState(initialTheme)
  const [accent, setAccent] = useState(initialStyle.accent ?? '')
  const [columns, setColumns] = useState(initialStyle.columns ?? 3)
  const [radius, setRadius] = useState(initialStyle.radius ?? 10)
  const [font, setFont] = useState(initialStyle.font ?? '')
  const [bodyFont, setBodyFont] = useState(initialStyle.bodyFont ?? '')
  const [layout, setLayout] = useState<
    'masonry' | 'square' | 'portrait' | 'collage' | 'editorial' | 'rows'
  >(initialStyle.layout ?? 'masonry')
  const [gap, setGap] = useState(initialStyle.gap ?? 14)
  const [cover, setCover] = useState<'classic' | 'left' | 'minimal'>(
    initialStyle.cover ?? 'classic'
  )
  const [titleScale, setTitleScale] = useState(initialStyle.titleScale ?? 100)
  const [focalX, setFocalX] = useState(initialStyle.focalX ?? 50)
  const [focalY, setFocalY] = useState(initialStyle.focalY ?? 50)
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')

  // On a phone the desktop mock is cramped — default the preview to «phone».
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setDevice('phone')
  }, [])

  const entry = useMemo(() => THEME_CATALOG.find((e) => e.value === theme), [theme])
  const tokens = useMemo(
    () => resolveGalleryTokens(entry?.theme ?? 'tysha', entry?.mode ?? 'light'),
    [entry]
  )
  // Same default as GalleryExperience: night («Опівніч») → the theme's gold.
  const previewAccent = accent || (entry?.mode === 'night' ? tokens.accent : '#2f55ff')
  const previewFont = fontFamily(font) ?? tokens.fontDisplay
  const previewBodyFont = fontFamily(bodyFont) ?? tokens.fontBody
  const previewLabelFont = fontFamily(bodyFont) ?? tokens.fontLabel

  const dirty = () => setSaved(false)

  // Sample text for font rows and the preview title: the real gallery name
  // when it reads like one, otherwise a realistic couple-style placeholder
  // (a 2-3 letter test title makes the font list useless).
  const sampleTitle =
    galleryTitle && galleryTitle.trim().length >= 5
      ? galleryTitle.trim()
      : labels.sampleTitle

  // Live preview photos: real shots, falling back to soft gradients pre-upload.
  const tiles = photos.length > 0 ? photos.slice(0, Math.max(columns * 2, 4)) : []
  const placeholderCount = Math.max(columns * 2 - tiles.length, tiles.length === 0 ? columns * 2 : 0)

  // Tile shape mirrors the client gallery: masonry varies, the rest crop.
  const editorialWide = (i: number) => i % 4 === 0 || i % 4 === 3
  // «Рядки»: a mix of landscapes and portraits, as width ÷ height.
  const rowAspect = (i: number) => (i % 3 === 0 ? 2 / 3 : 3 / 2)
  const rowHeight = device === 'phone' ? 54 : Math.round(150 / Math.max(columns, 2))
  const tileAspect = (i: number) =>
    layout === 'rows'
      ? String(rowAspect(i))
      : layout === 'portrait'
      ? '3 / 4'
      : layout === 'masonry'
        ? i % 3 === 0
          ? '3 / 4'
          : '1 / 1'
        : layout === 'editorial' && editorialWide(i)
          ? device === 'phone'
            ? '3 / 2'
            : '2 / 1'
          : '1 / 1'
  // Collage promotes every 6th tile to a 2×2 accent; editorial alternates a
  // wide hero with squares — same rules as the client gallery.
  const tileSpan = (i: number): React.CSSProperties =>
    layout === 'rows'
      ? { flex: `${rowAspect(i)} 1 ${rowAspect(i) * rowHeight}px`, minWidth: 0 }
      : layout === 'collage' && i % 6 === 0
      ? { gridColumn: 'span 2', gridRow: 'span 2' }
      : layout === 'editorial' && editorialWide(i)
        ? { gridColumn: 'span 2' }
        : {}
  const layoutLabel = (v: (typeof LAYOUT_CHOICES)[number]['value']) => labels[LAYOUT_LABEL[v]]
  // Editorial is a fixed 3-column pattern — the columns pick doesn't apply.
  const columnsLocked = layout === 'editorial'
  const previewCols =
    layout === 'editorial'
      ? device === 'phone'
        ? 2
        : 3
      : device === 'phone'
        ? Math.min(columns, 2)
        : columns

  const seg = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      on ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
    }`

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const fd = new FormData()
        fd.set('theme', theme)
        fd.set('accent', accent)
        fd.set('columns', String(columns))
        fd.set('radius', String(radius))
        fd.set('font', font)
        fd.set('bodyFont', bodyFont)
        fd.set('layout', layout)
        fd.set('gap', String(gap))
        fd.set('cover', cover)
        fd.set('titleScale', String(titleScale))
        fd.set('focalX', String(focalX))
        fd.set('focalY', String(focalY))
        setSaved(false)
        startTransition(async () => {
          await action(fd)
          setSaved(true)
        })
      }}
      className="mt-8 overflow-hidden rounded-3xl border border-line bg-white shadow-[0_1px_0_rgba(13,12,10,.03)]"
    >
      {/* ---------- studio header ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
            {labels.title}
          </p>
          <p className="text-sm text-muted">
            {labels.lede}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold text-accent">✓ {labels.styleSaved}</span>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-fg px-6 py-2.5 text-sm font-bold text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {pending ? '…' : labels.styleSave}
          </button>
        </div>
      </div>

      {/* On phones the LIVE preview goes first (order classes) so every tweak is
          visible without scrolling past the whole control rail. */}
      <div className="grid lg:grid-cols-[340px_1fr]">
        {/* ---------- control rail ---------- */}
        <aside className="order-2 flex flex-col gap-7 p-4 sm:p-6 lg:order-1 lg:max-h-[720px] lg:overflow-y-auto lg:border-r lg:border-line">
          {/* theme moods: three clearly distinct looks */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.theme}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {themeOptions.map((option) => {
                const entry = THEME_CATALOG.find((e) => e.value === option.value)
                const t = entry ? resolveGalleryTokens(entry.theme, entry.mode) : null
                const on = theme === option.value
                return (
                  <button
                    key={option.value || '_inherit'}
                    type="button"
                    onClick={() => {
                      setTheme(option.value)
                      dirty()
                    }}
                    className={`rounded-2xl border p-2.5 text-left transition-all ${
                      on ? 'border-fg ring-1 ring-fg' : 'border-line hover:border-muted'
                    }`}
                  >
                    <span
                      className="mb-2 flex h-9 items-center gap-1.5 rounded-lg px-2"
                      style={{ background: t?.bg ?? 'linear-gradient(135deg,#eee,#ddd)' }}
                    >
                      <i
                        className="block h-3.5 w-3.5 rounded-full"
                        style={{ background: t?.fg ?? '#888' }}
                      />
                      <i
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ background: t?.accent ?? '#bbb' }}
                      />
                      <i
                        className="ml-auto block h-1.5 w-6 rounded-full"
                        style={{ background: t?.line ?? '#ccc' }}
                      />
                    </span>
                    <span className={`text-[13px] font-semibold ${on ? 'text-fg' : 'text-muted'}`}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* accent */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.accent}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((a) => {
                const on = accent === a.value
                return (
                  <button
                    key={a.value || 'theme'}
                    type="button"
                    title={labels[ACCENT_LABEL[a.value] ?? 'accentTheme']}
                    onClick={() => {
                      setAccent(a.value)
                      dirty()
                    }}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      on ? 'border-fg' : 'border-line'
                    }`}
                    style={{
                      background:
                        a.value ||
                        `repeating-conic-gradient(${tokens.muted} 0% 25%, transparent 0% 50%) 50% / 8px 8px`,
                    }}
                  />
                )
              })}
              {/* free color: anything the presets don't cover */}
              <label
                className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-line transition-transform hover:scale-110"
                title={labels.customColor}
                style={{
                  background:
                    'conic-gradient(#f44,#fa0,#ff4,#4f4,#4ff,#44f,#f4f,#f44)',
                }}
              >
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#2f55ff'}
                  onChange={(e) => {
                    setAccent(e.target.value)
                    dirty()
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </section>

          {/* layout: real proportions vs uniform crops */}
          <section>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.layout}
            </p>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              {labels.layoutHint}
            </p>
            <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line p-1">
              {LAYOUT_CHOICES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  className={seg(layout === l.value)}
                  onClick={() => {
                    setLayout(l.value)
                    dirty()
                  }}
                >
                  {layoutLabel(l.value)}
                </button>
              ))}
            </div>
          </section>

          {/* grid: columns + corners */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.columns} · {labels.radius}
            </p>
            <div className="flex flex-col gap-2.5">
              <div
                className={`flex w-fit items-center gap-1 rounded-full border border-line p-1 ${
                  columnsLocked ? 'pointer-events-none opacity-40' : ''
                }`}
                title={columnsLocked ? labels.columnsLocked : undefined}
              >
                {COLUMN_CHOICES.map((c) => (
                  <button key={c} type="button" disabled={columnsLocked} className={seg(columns === c)} onClick={() => { setColumns(c); dirty() }}>
                    {formatMessage(labels.columnsShort, { n: c }, locale)}
                  </button>
                ))}
              </div>
              <div className="flex w-fit items-center gap-1 rounded-full border border-line p-1">
                {RADIUS_CHOICES.map((r) => (
                  <button key={r.value} type="button" className={seg(radius === r.value)} onClick={() => { setRadius(r.value); dirty() }}>
                    {labels[RADIUS_LABEL[r.value] ?? 'radiusSoft']}
                  </button>
                ))}
              </div>
              {/* breathing room between photos, Gallera-style */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>{labels.gap}</span>
                  <span>{gap}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={2}
                  value={gap}
                  onChange={(e) => {
                    setGap(Number(e.target.value))
                    dirty()
                  }}
                  className="w-full"
                  style={{ accentColor: '#26242a' }}
                />
              </div>
            </div>
          </section>

          {/* typography */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.headingFont}
            </p>
            <div className="flex flex-col gap-1.5">
              {FONT_PRESETS.map((f) => {
                const on = font === f.value
                return (
                  <button
                    key={f.value || 'theme'}
                    type="button"
                    onClick={() => {
                      setFont(f.value)
                      dirty()
                    }}
                    className={`flex items-baseline justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      on ? 'border-fg bg-fg/[0.04]' : 'border-line hover:border-muted'
                    }`}
                  >
                    <span
                      className="text-[17px]"
                      style={{ fontFamily: f.family ?? tokens.fontDisplay }}
                    >
                      {sampleTitle}
                    </span>
                    <span className="text-xs text-muted">{labels[FONT_LABEL[f.value] ?? 'fontTheme']}</span>
                  </button>
                )
              })}
            </div>
            {/* the «system» font: hints, buttons, caps labels */}
            <p className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.bodyFont}
            </p>
            <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line p-1">
              {FONT_PRESETS.map((f) => (
                <button
                  key={f.value || 'theme'}
                  type="button"
                  className={seg(bodyFont === f.value)}
                  style={{ fontFamily: f.family ?? undefined }}
                  onClick={() => {
                    setBodyFont(f.value)
                    dirty()
                  }}
                >
                  {labels[FONT_LABEL[f.value] ?? 'fontTheme']}
                </button>
              ))}
            </div>
          </section>

          {/* cover: treatment, title size, focal point */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.cover}
            </p>
            <div className="mb-3 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-line p-1">
              {COVER_CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={seg(cover === c.value)}
                  onClick={() => {
                    setCover(c.value)
                    dirty()
                  }}
                >
                  {labels[COVER_LABEL[c.value]]}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted">
                <span>{labels.titleSize}</span>
                <span>{titleScale}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={140}
                step={5}
                value={titleScale}
                onChange={(e) => {
                  setTitleScale(Number(e.target.value))
                  dirty()
                }}
                className="w-full"
                style={{ accentColor: '#26242a' }}
              />
            </div>
            {cover !== 'minimal' && (
              <>
                <p className="mb-3 text-xs leading-relaxed text-muted">
                  {labels.focalAim}
                </p>
                <button
                  type="button"
                  aria-label={labels.focal}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setFocalX(Math.round(((e.clientX - r.left) / r.width) * 100))
                    setFocalY(Math.round(((e.clientY - r.top) / r.height) * 100))
                    dirty()
                  }}
                  className="relative h-24 w-full overflow-hidden rounded-xl border border-line"
                  style={
                    coverUrl
                      ? { background: `center / cover no-repeat url("${coverUrl}")` }
                      : { background: `linear-gradient(135deg, ${tokens.muted}, ${tokens.line})` }
                  }
                >
                  <span
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
                    style={{ left: `${focalX}%`, top: `${focalY}%`, background: previewAccent }}
                  />
                </button>
              </>
            )}
          </section>
        </aside>

        {/* ---------- live preview ---------- */}
        <div className="order-1 flex flex-col border-b border-line bg-[#f3f2ee] p-4 sm:p-7 lg:order-2 lg:border-b-0">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
              {labels.preview}
            </p>
            <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
              <button type="button" className={seg(device === 'desktop')} onClick={() => setDevice('desktop')}>
                {labels.desktop}
              </button>
              <button type="button" className={seg(device === 'phone')} onClick={() => setDevice('phone')}>
                {labels.phone}
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-start justify-center">
            <div
              className={`overflow-hidden shadow-[0_24px_60px_-32px_rgba(13,12,10,.45)] transition-all ${
                device === 'phone'
                  ? 'w-[300px] rounded-[30px] border-[6px] border-[#1a1917]'
                  : 'w-full max-w-[620px] rounded-2xl border border-line'
              }`}
              style={{ background: tokens.bg, color: tokens.fg, fontFamily: previewBodyFont }}
            >
              {/* cover — mirrors the chosen treatment */}
              <div
                className={`relative flex ${cover === 'left' ? 'items-end' : 'items-center'}`}
                style={{
                  height: cover === 'minimal' ? undefined : device === 'phone' ? 180 : 200,
                  ...(cover === 'minimal'
                    ? { background: tokens.bg }
                    : coverUrl
                      ? {
                          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.42)), url("${coverUrl}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: `${focalX}% ${focalY}%`,
                        }
                      : { background: `linear-gradient(160deg, ${tokens.muted}, ${tokens.fg})` }),
                }}
              >
                <div
                  className={`w-full p-4 ${cover === 'left' ? 'text-left' : 'text-center'} ${
                    cover === 'minimal' ? 'pb-2 pt-10' : ''
                  }`}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.25em]"
                    style={{
                      fontFamily: tokens.fontLabel,
                      color: cover === 'minimal' ? tokens.muted : 'rgba(255,255,255,.8)',
                    }}
                  >
                    {new Date().getFullYear()}
                  </p>
                  <p
                    style={{
                      color: cover === 'minimal' ? tokens.fg : '#fff',
                      fontFamily: previewFont,
                      fontWeight: tokens.displayWeight,
                      textTransform: tokens.displayTransform as React.CSSProperties['textTransform'],
                      letterSpacing: tokens.displayTracking,
                      fontSize: Math.round(((device === 'phone' ? 22 : 28) * titleScale) / 100),
                      lineHeight: 1.1,
                      textShadow: cover === 'minimal' ? undefined : '0 1px 12px rgba(0,0,0,.35)',
                    }}
                  >
                    {sampleTitle}
                  </p>
                </div>
              </div>

              {/* action bar — mirrors the client gallery */}
              <div
                className="flex items-center gap-2 px-4 py-2.5 text-[11px]"
                style={{ borderBottom: `1px solid ${tokens.line}`, fontFamily: previewLabelFont }}
              >
                <span style={{ color: previewAccent }}>♥ 3 {labels.picked}</span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: tokens.muted }}
                >
                  ▶ {labels.slideshow}
                </span>
                <span
                  className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: tokens.fg, color: tokens.bg }}
                >
                  {labels.downloadAll}
                </span>
              </div>

              {/* photo grid — REAL photos. Masonry renders with CSS columns
                  (like the client gallery) — a grid with mixed aspect ratios
                  leaves holes under the shorter tiles. */}
              <div
                className="p-3"
                style={
                  layout === 'masonry'
                    ? {
                        columns: previewCols,
                        columnGap: Math.max(2, Math.round(gap / 2)),
                      }
                    : layout === 'rows'
                      ? {
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-start',
                          gap: Math.max(2, Math.round(gap / 2)),
                        }
                      : {
                        display: 'grid',
                        gap: Math.max(2, Math.round(gap / 2)),
                        gridTemplateColumns: `repeat(${previewCols}, 1fr)`,
                        gridAutoFlow: layout === 'collage' ? 'dense' : undefined,
                      }
                }
              >
                {tiles.map((url, i) => (
                  <div
                    key={url + i}
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: tileAspect(i),
                      borderRadius: radius,
                      background: `center / cover no-repeat url("${url}")`,
                      ...(layout === 'masonry'
                        ? {
                            breakInside: 'avoid' as const,
                            marginBottom: Math.max(2, Math.round(gap / 2)),
                          }
                        : tileSpan(i)),
                    }}
                  >
                    {i === 1 && (
                      <span
                        className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[11px]"
                        style={{ color: previewAccent }}
                      >
                        ♥
                      </span>
                    )}
                  </div>
                ))}
                {Array.from({ length: placeholderCount }).map((_, i) => (
                  <div
                    key={`ph-${i}`}
                    style={{
                      aspectRatio: tileAspect(tiles.length + i),
                      borderRadius: radius,
                      background: `linear-gradient(160deg, ${tokens.line}, ${tokens.muted})`,
                      opacity: 0.6,
                      ...(layout === 'masonry'
                        ? {
                            breakInside: 'avoid' as const,
                            marginBottom: Math.max(2, Math.round(gap / 2)),
                          }
                        : tileSpan(tiles.length + i)),
                    }}
                  />
                ))}
                {/* «Рядки»: the last row keeps its height instead of stretching */}
                {layout === 'rows' && <span aria-hidden style={{ flex: '1000000 1 0' }} />}
              </div>

              {/* footer signature — display font, like the real gallery */}
              <p
                className="pb-4 text-center text-[13px]"
                style={{ color: tokens.muted, fontFamily: previewFont }}
              >
                {labels.brandLine}
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

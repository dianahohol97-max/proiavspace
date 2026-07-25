'use client'

import { useMemo, useState, useTransition } from 'react'
import { resolveTokens } from '@/lib/site/themes'
import { THEME_CATALOG } from '@/lib/site/themes'
import {
  ACCENT_PRESETS,
  COLUMN_CHOICES,
  FONT_PRESETS,
  RADIUS_CHOICES,
  fontFamily,
  type GalleryStyle,
} from '@/lib/gallery/style'

interface DesignerLabels {
  styleLabel: string
  styleSave: string
  styleSaved: string
  accent: string
  columns: string
  radius: string
  font: string
  preview: string
}

/**
 * Live per-gallery design customizer: theme preset + accent / columns / corner
 * radius / display font, with an instant preview that mirrors the real client
 * gallery tokens. Saves through the gallery-theme server action.
 */
export function GalleryDesigner({
  action,
  themeOptions,
  initialTheme,
  initialStyle,
  labels,
}: {
  action: (formData: FormData) => Promise<void>
  themeOptions: { value: string; label: string }[]
  initialTheme: string
  initialStyle: GalleryStyle
  labels: DesignerLabels
}) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState(initialTheme)
  const [accent, setAccent] = useState(initialStyle.accent ?? '')
  const [columns, setColumns] = useState(initialStyle.columns ?? 3)
  const [radius, setRadius] = useState(initialStyle.radius ?? 10)
  const [font, setFont] = useState(initialStyle.font ?? '')

  // Tokens of the chosen theme drive the preview surface (bg/fg/accent/font).
  const tokens = useMemo(() => {
    const entry = THEME_CATALOG.find((e) => e.value === theme)
    return resolveTokens(entry?.theme ?? 'tysha', entry?.mode ?? 'light')
  }, [theme])
  const previewAccent = accent || (tokens.bg === '#1b1a18' ? '#8fa2ff' : '#2f55ff')
  const previewFont = fontFamily(font) ?? tokens.fontDisplay

  const dirty = () => setSaved(false)
  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-fg'
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
        setSaved(false)
        startTransition(async () => {
          await action(fd)
          setSaved(true)
        })
      }}
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <div className="flex flex-col gap-5">
        {/* theme */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="w-24 text-sm text-muted" htmlFor="gallery-theme">
            {labels.styleLabel}
          </label>
          <select
            id="gallery-theme"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value)
              dirty()
            }}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
          >
            {themeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* accent */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm text-muted">{labels.accent}</span>
          {ACCENT_PRESETS.map((a) => {
            const on = accent === a.value
            return (
              <button
                key={a.value || 'theme'}
                type="button"
                title={a.label}
                onClick={() => {
                  setAccent(a.value)
                  dirty()
                }}
                className={`h-7 w-7 rounded-full border-2 ${on ? 'border-fg' : 'border-line'}`}
                style={{
                  background: a.value || `repeating-conic-gradient(${tokens.muted} 0% 25%, transparent 0% 50%) 50% / 8px 8px`,
                }}
              />
            )
          })}
        </div>

        {/* columns */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm text-muted">{labels.columns}</span>
          {COLUMN_CHOICES.map((c) => (
            <button key={c} type="button" className={pill(columns === c)} onClick={() => { setColumns(c); dirty() }}>
              {c}
            </button>
          ))}
        </div>

        {/* radius */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm text-muted">{labels.radius}</span>
          {RADIUS_CHOICES.map((r) => (
            <button key={r.value} type="button" className={pill(radius === r.value)} onClick={() => { setRadius(r.value); dirty() }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* font */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm text-muted">{labels.font}</span>
          {FONT_PRESETS.map((f) => (
            <button key={f.value || 'theme'} type="button" className={pill(font === f.value)} onClick={() => { setFont(f.value); dirty() }}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-fg px-5 py-2 text-sm transition-colors hover:bg-fg hover:text-bg disabled:opacity-50"
          >
            {labels.styleSave}
          </button>
          {saved && <span className="text-sm text-accent">✓ {labels.styleSaved}</span>}
        </div>
      </div>

      {/* live preview */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{labels.preview}</p>
        <div
          className="overflow-hidden rounded-xl border border-line"
          style={{ background: tokens.bg, color: tokens.fg }}
        >
          <div
            style={{
              height: 92,
              background: `linear-gradient(135deg, ${tokens.muted}, ${tokens.line})`,
              display: 'flex',
              alignItems: 'flex-end',
              padding: 12,
            }}
          >
            <span
              style={{
                fontFamily: previewFont,
                fontWeight: tokens.displayWeight as unknown as number,
                textTransform: tokens.displayTransform as React.CSSProperties['textTransform'],
                fontSize: 20,
                color: '#fff',
                textShadow: '0 1px 8px rgba(0,0,0,.4)',
              }}
            >
              Марта і Богдан
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 8,
              padding: 12,
            }}
          >
            {Array.from({ length: columns * 2 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  aspectRatio: i % 3 === 0 ? '3 / 4' : '1 / 1',
                  borderRadius: radius,
                  background: `linear-gradient(160deg, ${tokens.line}, ${tokens.muted})`,
                }}
              >
                {i === 1 && (
                  <span style={{ position: 'absolute', top: 4, right: 6, color: previewAccent, fontSize: 13 }}>
                    ♥
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  )
}

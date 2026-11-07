'use client'

/**
 * The selected text: content (lines split by Enter), font (all with
 * Cyrillic), size, colour, alignment, direction (spine text runs top to
 * bottom), line spacing.
 */
import { useEffect } from 'react'
import { ALBUM_FONTS, loadAlbumFont } from '@/lib/album/fonts'
import type { AlbumText, TextAlign } from '@/lib/album/types'
import { btn, input, label } from './ui'

const SWATCHES = ['#1f1f1f', '#ffffff', '#6b5b4b', '#b08d57', '#7a1f2b', '#2f4a3a']

export function TextInspector({
  text,
  onChange,
  onDelete,
}: {
  text: AlbumText
  onChange(patch: Partial<AlbumText>, gesture?: string): void
  onDelete(): void
}) {
  useEffect(() => {
    for (const f of ALBUM_FONTS) void loadAlbumFont(f.id).catch(() => undefined)
  }, [])

  const aligns: [TextAlign, string][] = [
    ['left', 'Ліворуч'],
    ['center', 'По центру'],
    ['right', 'Праворуч'],
  ]
  const directions: [number, string][] = [
    [0, 'Горизонтально'],
    [90, 'Корінець ↓'],
    [-90, 'Знизу вгору'],
  ]

  return (
    <div className="flex flex-col gap-4" data-testid="text-inspector">
      <label className="flex flex-col gap-1" htmlFor="text-content">
        <span className={label}>Текст</span>
        <textarea
          id="text-content"
          rows={3}
          className={`${input} resize-y`}
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value }, `text-${text.id}`)}
        />
        <span className="text-xs text-muted">Новий рядок — Enter. Переносів автоматично немає, як у Photoshop (точковий текст).</span>
      </label>
      <label className="flex flex-col gap-1" htmlFor="text-font">
        <span className={label}>Шрифт</span>
        <select id="text-font" className={input} value={text.font} onChange={(e) => onChange({ font: e.target.value })}>
          {ALBUM_FONTS.map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: `"${f.family}"` }}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1" htmlFor="text-size">
          <span className={label}>Розмір, pt</span>
          <input
            id="text-size"
            type="number"
            min={4}
            max={400}
            step={0.5}
            className={input}
            value={text.sizePt}
            onChange={(e) => onChange({ sizePt: Math.min(Math.max(Number(e.target.value) || 4, 4), 400) }, `size-${text.id}`)}
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="text-leading">
          <span className={label}>Інтерліньяж</span>
          <input
            id="text-leading"
            type="number"
            min={0.8}
            max={3}
            step={0.05}
            className={input}
            value={text.lineHeight}
            onChange={(e) => onChange({ lineHeight: Math.min(Math.max(Number(e.target.value) || 1.25, 0.8), 3) }, `lead-${text.id}`)}
          />
        </label>
      </div>
      <div>
        <p className={label}>Колір</p>
        <div className="mt-2 flex items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              className={`h-7 w-7 rounded-full border ${text.color.toLowerCase() === c ? 'ring-2 ring-fg ring-offset-2' : 'border-line'}`}
              style={{ background: c }}
              aria-label={`Колір ${c}`}
            />
          ))}
          <input type="color" value={text.color} onChange={(e) => onChange({ color: e.target.value }, `color-${text.id}`)} aria-label="Свій колір" className="h-7 w-9" />
        </div>
      </div>
      <div>
        <p className={label}>Вирівнювання</p>
        <div className="mt-2 flex gap-1">
          {aligns.map(([value, name]) => (
            <button key={value} className={`${btn} ${text.align === value ? '!border-fg' : ''}`} onClick={() => onChange({ align: value })} aria-pressed={text.align === value}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Напрям</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {directions.map(([value, name]) => (
            <button key={value} className={`${btn} ${text.rotation === value ? '!border-fg' : ''}`} onClick={() => onChange({ rotation: value })} aria-pressed={text.rotation === value}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">Перетягуйте текст прямо на розвороті. У PDF і PSD він лишається текстом, у JPEG — частиною зображення.</p>
      <button className={btn} onClick={onDelete}>
        Видалити текст
      </button>
    </div>
  )
}

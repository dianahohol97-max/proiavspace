'use client'

/**
 * Template library: page templates (1–6 photos, with margins or full bleed)
 * for the left/right page, and templates across the whole spread. Each tile
 * is a tiny diagram resolved for the album's real format.
 */
import { useMemo, useState } from 'react'
import { formatFor, pageBoxes, type SpreadFormat } from '@/lib/album/geometry'
import { PAGE_TEMPLATES, SPREAD_TEMPLATES, pagesLayout, parseLayout, resolveLayout } from '@/lib/album/templates'
import type { AlbumSpread, PrintSpec } from '@/lib/album/types'

type Target = 'left' | 'right' | 'spread'

function Diagram({ layout, format, spec, half }: { layout: string; format: SpreadFormat; spec: PrintSpec; half?: 'left' | 'right' }) {
  const rects = resolveLayout(layout, format, { marginMm: spec.marginMm, gapMm: spec.gapMm })
  const [l, r] = pageBoxes(format)
  const box = half === 'left' ? l : half === 'right' ? r : { x: 0, y: 0, w: format.widthMm, h: format.heightMm }
  const shown = half ? rects.filter((rect) => rect.x + rect.w / 2 >= box.x && rect.x + rect.w / 2 <= box.x + box.w) : rects
  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block h-full w-full bg-white" preserveAspectRatio="xMidYMid meet">
      {shown.map((rect, i) => (
        <rect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h} className="fill-neutral-300" />
      ))}
      {!half && <line x1={format.widthMm / 2} x2={format.widthMm / 2} y1={0} y2={format.heightMm} className="stroke-neutral-400" strokeWidth={format.widthMm / 300} />}
    </svg>
  )
}

export function TemplatePicker({ spread, spec, onApply }: { spread: AlbumSpread; spec: PrintSpec; onApply(layout: string): void }) {
  const [target, setTarget] = useState<Target>('left')
  const format = formatFor(spec, spread.kind)
  const parsed = parseLayout(spread.layout)
  const current = useMemo(
    () =>
      parsed.kind === 'pages'
        ? { left: parsed.left.id, right: parsed.right.id }
        : { left: 'p0', right: 'p0' },
    [parsed]
  )
  const pageAspect = (format.widthMm - format.spineMm) / 2 / format.heightMm
  const tabs: [Target, string][] = [
    ['left', spread.kind === 'cover' ? 'Задня' : 'Ліва'],
    ['right', spread.kind === 'cover' ? 'Лице' : 'Права'],
    ['spread', 'Розворот'],
  ]

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-full bg-bg p-1" role="tablist" aria-label="До чого застосувати шаблон">
        {tabs.map(([key, text]) => (
          <button
            key={key}
            role="tab"
            aria-selected={target === key}
            onClick={() => setTarget(key)}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-bold ${target === key ? 'bg-white text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
          >
            {text}
          </button>
        ))}
      </div>
      {target === 'spread' ? (
        <div className="grid grid-cols-2 gap-2">
          {SPREAD_TEMPLATES.map((tpl) => {
            const layout = `spread:${tpl.id}`
            return (
              <button
                key={tpl.id}
                onClick={() => onApply(layout)}
                title={tpl.name}
                aria-label={`Шаблон: ${tpl.name}`}
                className={`overflow-hidden rounded-md border p-1 text-left ${spread.layout === layout ? 'border-fg' : 'border-line hover:border-muted'}`}
              >
                <div style={{ aspectRatio: `${format.widthMm} / ${format.heightMm}` }}>
                  <Diagram layout={layout} format={format} spec={spec} />
                </div>
                <p className="mt-1 truncate text-[10.5px] font-semibold text-muted">{tpl.name}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {PAGE_TEMPLATES.map((tpl) => {
            const layout = target === 'left' ? pagesLayout(tpl.id, current.right) : pagesLayout(current.left, tpl.id)
            const active = parsed.kind === 'pages' && current[target] === tpl.id
            return (
              <button
                key={tpl.id}
                onClick={() => onApply(layout)}
                title={tpl.name}
                aria-label={`Шаблон: ${tpl.name}`}
                className={`overflow-hidden rounded-md border p-1 ${active ? 'border-fg' : 'border-line hover:border-muted'}`}
              >
                <div style={{ aspectRatio: String(pageAspect) }}>
                  <Diagram layout={pagesLayout(tpl.id, tpl.id)} format={format} spec={spec} half="left" />
                </div>
                <p className="mt-1 truncate text-[10px] font-semibold text-muted">{tpl.cells.length || '—'}{tpl.bleed ? ' · обріз' : ''}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

/**
 * Portfolio filter for a one-page site: «Усі · Весілля · Хрестини …». No
 * pages, no URLs — it only hides the frames of other directions inside the
 * grid (items carry data-cat) and marks the grid with data-filter so a
 * theme can switch to a simpler layout while filtered. Without JS the bar is
 * not rendered and every frame stays visible.
 */
export function CardFilterBar({
  gridId,
  filters,
  allLabel,
  className,
  chipClassName,
  activeClassName,
}: {
  gridId: string
  filters: { label: string; count: number }[]
  allLabel: string
  className?: string
  chipClassName?: string
  activeClassName?: string
}) {
  const [active, setActive] = useState('')
  useEffect(() => {
    const grid = document.getElementById(gridId)
    if (!grid) return
    grid.dataset.filter = active
    grid.querySelectorAll<HTMLElement>('[data-cat]').forEach((el) => {
      el.hidden = !!active && el.dataset.cat !== active
    })
  }, [active, gridId])
  const total = filters.reduce((n, f) => n + f.count, 0)
  return (
    <div className={className} role="group" aria-controls={gridId}>
      {[{ label: '', text: allLabel, count: total }, ...filters.map((f) => ({ label: f.label, text: f.label, count: f.count }))].map(
        (f) => (
          <button
            key={f.label || '_all'}
            type="button"
            aria-pressed={active === f.label}
            className={`${chipClassName ?? ''} ${active === f.label ? (activeClassName ?? '') : ''}`}
            onClick={() => setActive(f.label)}
          >
            {f.text}
            <sup>{f.count}</sup>
          </button>
        )
      )}
    </div>
  )
}

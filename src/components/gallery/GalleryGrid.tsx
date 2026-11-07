'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  chunkSize,
  estimateChunkHeight,
  gridColumns,
  masonryTileHeight,
  type GridLayout,
} from './gridLayout'
import s from './GalleryExperience.module.css'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface GridTileInfo {
  /** Tile width in CSS px — picks the light or the full preview. */
  width: number
  /** Masonry tile with a known aspect ratio: fill the fixed-height box. */
  fill: boolean
}

interface Geometry {
  /** Content width of the grid (inside the page padding). */
  width: number
  viewport: number
  /** Distance from the top of the document to the grid. */
  offset: number
}

/**
 * The gallery grid, virtualized with TanStack Virtual: only the rows near the
 * viewport are in the DOM, so a 1500-photo gallery scrolls like a 30-photo one
 * on a phone. The page itself scrolls (window virtualizer), cover and sticky
 * bar stay as they are.
 *
 *   - masonry → one virtual item per photo, placed in the shortest of N lanes
 *     (TanStack `lanes`). Heights come from the stored width/height, so nothing
 *     jumps. Photos read left-to-right instead of CSS columns' top-to-bottom.
 *   - square / portrait / collage / editorial → one virtual item per chunk of
 *     tiles; each chunk is a CSS grid with the very same classes as before.
 */
export function GalleryGrid<T extends { id: string; width: number | null; height: number | null }>({
  items,
  layout,
  columns: desiredColumns,
  gap,
  className,
  renderTile,
}: {
  items: T[]
  layout: GridLayout
  columns: number
  gap: number
  /** The grid's own classes (theme padding, uniform/collage/editorial). */
  className: string
  renderTile: (item: T, index: number, info: GridTileInfo) => ReactNode
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [geometry, setGeometry] = useState<Geometry | null>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => {
      const rect = host.getBoundingClientRect()
      const next: Geometry = {
        width: host.clientWidth,
        viewport: window.innerWidth,
        offset: Math.round(rect.top + window.scrollY),
      }
      setGeometry((prev) =>
        prev && prev.width === next.width && prev.viewport === next.viewport && prev.offset === next.offset
          ? prev
          : next
      )
    }
    update()
    // The cover above the grid is 88vh and fonts load late: watch the whole
    // page, not just the grid, so the scroll offset stays right.
    const observer = new ResizeObserver(update)
    observer.observe(host)
    observer.observe(document.body)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const width = geometry?.width ?? 0
  const columns = gridColumns(layout, desiredColumns, geometry?.viewport ?? 1280)
  const masonry = layout === 'masonry'
  const columnWidth = Math.max((width - gap * (columns - 1)) / columns, 1)
  const perChunk = masonry ? 1 : chunkSize(layout, columns)
  const count = masonry ? items.length : Math.ceil(items.length / perChunk)

  const virtualizer = useWindowVirtualizer({
    count: geometry ? count : 0,
    lanes: masonry ? columns : 1,
    overscan: masonry ? 4 * columns : 2,
    scrollMargin: geometry?.offset ?? 0,
    estimateSize: (index) => {
      if (masonry) {
        const item = items[index]
        const height = masonryTileHeight(item?.width, item?.height, columnWidth)
        return (height ?? columnWidth) + gap
      }
      const start = index * perChunk
      return estimateChunkHeight(layout, items.slice(start, start + perChunk), columns, width, gap)
    },
    getItemKey: (index) => (masonry ? items[index]?.id ?? index : `${perChunk}:${index}`),
  })

  // New column width or column count: every estimate changes.
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, columnWidth, columns, perChunk, items])

  const virtualItems = virtualizer.getVirtualItems()
  const scrollMargin = virtualizer.options.scrollMargin

  const content = !geometry
    ? null
    : virtualItems.map((row) => {
      const top = row.start - scrollMargin
      if (masonry) {
        const item = items[row.index]
        if (!item) return null
        const height = masonryTileHeight(item.width, item.height, columnWidth)
        return (
          <div
            key={row.key}
            data-index={row.index}
            // Unknown size (rare: no stored dimensions) — let the browser lay
            // it out and measure; known sizes are exact and never re-measured.
            ref={height === null ? virtualizer.measureElement : undefined}
            className={s.vCell}
            style={{
              transform: `translate3d(${row.lane * (columnWidth + gap)}px, ${top}px, 0)`,
              width: columnWidth,
              height: height === null ? undefined : height + gap,
              paddingBottom: gap,
            }}
          >
            {renderTile(item, row.index, { width: columnWidth, fill: height !== null })}
          </div>
        )
      }
      const start = row.index * perChunk
      const slice = items.slice(start, start + perChunk)
      return (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className={s.vChunk}
          style={{
            transform: `translate3d(0, ${top}px, 0)`,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            paddingBottom: gap,
          }}
        >
          {slice.map((item, offset) =>
            renderTile(item, start + offset, { width: columnWidth, fill: false })
          )}
        </div>
      )
    })

  return (
    <main className={`${className} ${s.virtualHost}`} data-layout={layout} data-count={items.length}>
      <div
        ref={hostRef}
        className={s.vHost}
        style={{
          // Before the first measurement (server render) keep the page roughly
          // as tall as the grid will be, so the scroll position isn't lost.
          height: geometry ? Math.max(virtualizer.getTotalSize() - gap, 0) : undefined,
          minHeight: geometry ? undefined : '100vh',
        }}
      >
        {content}
      </div>
    </main>
  )
}

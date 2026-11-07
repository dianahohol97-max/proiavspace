'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  EAGER_TILES,
  SSR_TILES,
  assignMasonryLanes,
  chunkSize,
  estimateChunkHeight,
  gridColumns,
  gridSizes,
  masonryBreakpointColumns,
  masonryRatio,
  tileSpan,
  type GridLayout,
} from './gridLayout'
import s from './GalleryExperience.module.css'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface GridTileInfo {
  /** Masonry tile: fill a box of the photo's proportions (object-fit cover). */
  fill: boolean
  /** Aspect ratio of that box («w / h»), for the server-rendered fallback. */
  aspect?: string
  /** `sizes` for the tile's srcset — the same on the server and in the browser. */
  sizes: string
  /** One of the first tiles: load at once instead of lazily. */
  eager: boolean
}

interface Geometry {
  /** Content width of the grid (inside the page padding). */
  width: number
  viewport: number
  /** Distance from the top of the document to the grid. */
  offset: number
}

type Tile = { id: string; width: number | null; height: number | null }
type RenderTile<T> = (item: T, index: number, info: GridTileInfo) => ReactNode

/**
 * The gallery grid.
 *
 * Server render / no JavaScript: the first SSR_TILES tiles as plain CSS — a
 * CSS grid with the layout's own classes, or for masonry flex columns per
 * breakpoint — with every tile's proportions known up front, so the first
 * screen is never empty while the scripts load.
 *
 * After hydration (before the next paint): the same tiles, at the same
 * positions and with the same image URLs, virtualized with TanStack Virtual:
 * only rows near the viewport stay in the DOM, so 1500 photos scroll like 30.
 *   - masonry → lanes come from assignMasonryLanes (proportions only, so they
 *     match the fallback), and every lane is its own window virtualizer of
 *     fixed-height tiles;
 *   - square / portrait / collage / editorial → chunks of whole rows, each a
 *     CSS grid with the same classes; chunks are measured.
 */
export function GalleryGrid<T extends Tile>({
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
  renderTile: RenderTile<T>
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

  const masonry = layout === 'masonry'
  const ratios = useMemo(() => items.map((item) => masonryRatio(item.width, item.height)), [items])
  const info = (index: number): GridTileInfo => ({
    fill: masonry,
    aspect: masonry ? `1 / ${ratios[index]}` : undefined,
    sizes: gridSizes(layout, desiredColumns, gap, tileSpan(layout, index)),
    eager: index < EAGER_TILES,
  })

  let content: ReactNode
  if (!geometry) {
    content = masonry ? (
      <MasonryFallback items={items} ratios={ratios} desired={desiredColumns} renderTile={renderTile} info={info} />
    ) : (
      <div className={s.ssrGrid}>
        {items.slice(0, SSR_TILES).map((item, index) => renderTile(item, index, info(index)))}
      </div>
    )
  } else if (masonry) {
    content = (
      <VirtualMasonry
        items={items}
        ratios={ratios}
        columns={gridColumns(layout, desiredColumns, geometry.viewport)}
        width={geometry.width}
        gap={gap}
        offset={geometry.offset}
        renderTile={renderTile}
        info={info}
      />
    )
  } else {
    content = (
      <VirtualChunks
        items={items}
        layout={layout}
        columns={gridColumns(layout, desiredColumns, geometry.viewport)}
        width={geometry.width}
        gap={gap}
        offset={geometry.offset}
        renderTile={renderTile}
        info={info}
      />
    )
  }

  return (
    <main className={`${className} ${s.virtualHost}`} data-layout={layout} data-count={items.length}>
      <div ref={hostRef} className={s.vHost} data-virtual={geometry ? '' : undefined}>
        {content}
      </div>
    </main>
  )
}

/* ---------- server / no-JS fallback for masonry ---------- */

function MasonryFallback<T extends Tile>({
  items,
  ratios,
  desired,
  renderTile,
  info,
}: {
  items: T[]
  ratios: number[]
  desired: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const head = ratios.slice(0, SSR_TILES)
  const { phone, tablet, desktop } = masonryBreakpointColumns(desired)
  // One block per distinct column count; CSS shows the one for the viewport.
  const variants: { columns: number; show: string }[] = []
  for (const [columns, show] of [
    [phone, s.ssrPhone],
    [tablet, s.ssrTablet],
    [desktop, s.ssrDesktop],
  ] as const) {
    const same = variants.find((v) => v.columns === columns)
    if (same) same.show += ` ${show}`
    else variants.push({ columns, show })
  }
  return (
    <>
      {variants.map(({ columns, show }) => (
        <div key={columns} className={`${s.ssrMasonry} ${show}`}>
          {assignMasonryLanes(head, columns).lanes.map((lane, laneIndex) => (
            <div key={laneIndex} className={s.ssrLane}>
              {lane.map((index) => renderTile(items[index], index, info(index)))}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

/* ---------- virtualized masonry: one window virtualizer per lane ---------- */

function VirtualMasonry<T extends Tile>(props: {
  items: T[]
  ratios: number[]
  columns: number
  width: number
  gap: number
  offset: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  // Remount when the column count changes: MasonryLanes calls one hook per
  // lane, so the number of hooks must stay fixed for the component's life.
  return <MasonryLanes key={props.columns} {...props} />
}

function MasonryLanes<T extends Tile>({
  items,
  ratios,
  columns,
  width,
  gap,
  offset,
  renderTile,
  info,
}: {
  items: T[]
  ratios: number[]
  columns: number
  width: number
  gap: number
  offset: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const lanes = useMemo(() => assignMasonryLanes(ratios, columns).lanes, [ratios, columns])
  const columnWidth = Math.max((width - gap * (columns - 1)) / columns, 1)

  // One window virtualizer per lane (fixed count — see VirtualMasonry). Every
  // height is known from the photo's proportions, so nothing is measured.
  const virtualizers = lanes.map((lane) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWindowVirtualizer({
      count: lane.length,
      overscan: 4,
      scrollMargin: offset,
      estimateSize: (row) => columnWidth * ratios[lane[row]] + gap,
      getItemKey: (row) => items[lane[row]]?.id ?? row,
    })
  )
  useEffect(() => {
    for (const virtualizer of virtualizers) virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnWidth, gap, lanes])

  // DOM in gallery order (tab order, screen readers), whatever the lane.
  const cells: { index: number; key: string | number | bigint; lane: number; start: number; size: number }[] = []
  virtualizers.forEach((virtualizer, laneIndex) => {
    for (const row of virtualizer.getVirtualItems()) {
      cells.push({ index: lanes[laneIndex][row.index], key: row.key, lane: laneIndex, start: row.start, size: row.size })
    }
  })
  cells.sort((a, b) => a.index - b.index)

  const total = Math.max(0, ...virtualizers.map((v) => v.getTotalSize())) - gap
  return (
    <div style={{ position: 'relative', height: Math.max(total, 0) }}>
      {cells.map((cell) => {
        const item = items[cell.index]
        if (!item) return null
        return (
          <div
            key={String(cell.key)}
            className={s.vCell}
            style={{
              transform: `translate3d(${cell.lane * (columnWidth + gap)}px, ${cell.start - offset}px, 0)`,
              width: columnWidth,
              height: cell.size,
              paddingBottom: gap,
            }}
          >
            {renderTile(item, cell.index, info(cell.index))}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- virtualized cropped layouts: chunks of whole rows ---------- */

function VirtualChunks<T extends Tile>({
  items,
  layout,
  columns,
  width,
  gap,
  offset,
  renderTile,
  info,
}: {
  items: T[]
  layout: GridLayout
  columns: number
  width: number
  gap: number
  offset: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const perChunk = chunkSize(layout, columns)
  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(items.length / perChunk),
    overscan: 2,
    scrollMargin: offset,
    estimateSize: (chunk) => {
      const start = chunk * perChunk
      return estimateChunkHeight(layout, items.slice(start, start + perChunk), columns, width, gap)
    },
    getItemKey: (chunk) => `${perChunk}:${chunk}`,
  })
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, width, columns, perChunk, items])

  return (
    <div style={{ position: 'relative', height: Math.max(virtualizer.getTotalSize() - gap, 0) }}>
      {virtualizer.getVirtualItems().map((row) => {
        const start = row.index * perChunk
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className={s.vChunk}
            style={{
              transform: `translate3d(0, ${row.start - offset}px, 0)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              paddingBottom: gap,
            }}
          >
            {items
              .slice(start, start + perChunk)
              .map((item, inChunk) => renderTile(item, start + inChunk, info(start + inChunk)))}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  EAGER_TILES,
  HIGH_PRIORITY_TILES,
  assignMasonryLanes,
  chunkSize,
  estimateChunkHeight,
  gridColumns,
  gridSizes,
  hasDimensions,
  headCount,
  masonryBreakpointColumns,
  masonryRatio,
  tileSpan,
  type GridLayout,
} from './gridLayout'
import s from './GalleryExperience.module.css'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface GridTileInfo {
  /** Masonry tile: a box of the photo's proportions that the media fills. */
  fill: boolean
  /** Masonry tile without stored dimensions: 4:5 slot, photo shown whole. */
  contain: boolean
  /** Aspect ratio of the masonry box («1 / h÷w»). */
  aspect?: string
  /** `sizes` for the tile's srcset — the same on the server and in the browser. */
  sizes: string
  /** Load at once (grid on the first screen) instead of lazily. */
  eager: boolean
  /** fetchpriority="high": the very first tiles on the first screen. */
  priority: boolean
}

interface Geometry {
  viewport: number
  /** Content width of the grid (inside the page padding). */
  width: number
  /** Document offset of the grid's top. */
  offset: number
  /** Height of the server-rendered head (cropped layouts). */
  head: number
}

type Tile = { id: string; width: number | null; height: number | null }
type RenderTile<T> = (item: T, index: number, info: GridTileInfo) => ReactNode

/**
 * The gallery grid: a server-rendered head plus a virtualized tail.
 *
 * Head — the first ~24 tiles (headCount), rendered on the server as plain CSS:
 * a CSS grid with the layout's own classes, or for masonry flex columns per
 * breakpoint, every tile sized from the photo's proportions. It is visible
 * without JavaScript and is NEVER replaced after hydration: its images, its
 * layout and the page's LCP element stay the very elements the HTML painted.
 *
 * Tail — every tile after the head, virtualized with TanStack Virtual once the
 * grid's width is known: only rows near the viewport are in the DOM, so 1500
 * photos scroll like 30.
 *   - masonry: lanes from assignMasonryLanes (proportions only, so the tail
 *     continues the head's columns exactly), one window virtualizer per lane;
 *   - square / portrait / collage / editorial: chunks of whole rows right
 *     below the head, each a CSS grid with the same classes (measured).
 */
export function GalleryGrid<T extends Tile>({
  items,
  layout,
  columns: desiredColumns,
  gap,
  aboveFold,
  className,
  renderTile,
}: {
  items: T[]
  layout: GridLayout
  columns: number
  gap: number
  /** The grid is on the first screen (no photo cover above it). */
  aboveFold: boolean
  /** The grid's own classes (theme padding, uniform/collage/editorial). */
  className: string
  renderTile: RenderTile<T>
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const [geometry, setGeometry] = useState<Geometry | null>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => {
      const rect = host.getBoundingClientRect()
      const next: Geometry = {
        viewport: window.innerWidth,
        width: host.clientWidth,
        offset: Math.round(rect.top + window.scrollY),
        head: headRef.current ? headRef.current.getBoundingClientRect().height : 0,
      }
      setGeometry((prev) =>
        prev &&
        prev.width === next.width &&
        prev.viewport === next.viewport &&
        prev.offset === next.offset &&
        Math.abs(prev.head - next.head) < 0.5
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
    if (headRef.current) observer.observe(headRef.current)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const masonry = layout === 'masonry'
  const ratios = useMemo(() => items.map((item) => masonryRatio(item.width, item.height)), [items])
  const head = headCount(layout, desiredColumns, items.length)
  const info = (index: number): GridTileInfo => ({
    fill: masonry,
    contain: masonry && !hasDimensions(items[index]?.width, items[index]?.height),
    aspect: masonry ? `1 / ${ratios[index]}` : undefined,
    sizes: gridSizes(layout, desiredColumns, gap, tileSpan(layout, index)),
    eager: aboveFold && index < EAGER_TILES,
    priority: aboveFold && index < HIGH_PRIORITY_TILES,
  })

  const columns = geometry ? gridColumns(layout, desiredColumns, geometry.viewport) : 0
  // Masonry lanes for the current column count (greedy: the head's lanes are
  // a prefix of these), and the grid's full height from proportions alone.
  const lanes = useMemo(
    () => (masonry && columns ? assignMasonryLanes(ratios, columns).lanes : []),
    [masonry, ratios, columns]
  )
  const columnWidth = geometry && columns ? Math.max((geometry.width - gap * (columns - 1)) / columns, 1) : 1
  const masonryHeight = lanes.length
    ? Math.max(0, ...lanes.map((lane) => lane.reduce((sum, index) => sum + columnWidth * ratios[index] + gap, 0))) - gap
    : 0
  const masonryTail =
    geometry && masonry ? (
      <MasonryTail
        key={columns}
        items={items}
        ratios={ratios}
        lanes={lanes}
        head={head}
        columnWidth={columnWidth}
        gap={gap}
        offset={geometry.offset}
        renderTile={renderTile}
        info={info}
      />
    ) : null

  return (
    <main className={`${className} ${s.virtualHost}`} data-layout={layout} data-count={items.length}>
      <div
        ref={hostRef}
        className={s.vHost}
        data-virtual={geometry ? '' : undefined}
        style={masonryTail ? { height: Math.max(masonryHeight, 0) } : undefined}
      >
        {masonry ? (
          <MasonryHead items={items} ratios={ratios} head={head} desired={desiredColumns} renderTile={renderTile} info={info} />
        ) : (
          <div ref={headRef} className={s.ssrGrid}>
            {items.slice(0, head).map((item, index) => renderTile(item, index, info(index)))}
          </div>
        )}
        {masonry
          ? masonryTail
          : geometry &&
            head < items.length && (
              <ChunkTail
                key={columns}
                items={items}
                head={head}
                layout={layout}
                columns={columns}
                width={geometry.width}
                gap={gap}
                offset={geometry.offset + geometry.head + gap}
                renderTile={renderTile}
                info={info}
              />
            )}
      </div>
    </main>
  )
}

/* ---------- masonry head: flex columns per breakpoint, plain CSS ---------- */

function MasonryHead<T extends Tile>({
  items,
  ratios,
  head,
  desired,
  renderTile,
  info,
}: {
  items: T[]
  ratios: number[]
  head: number
  desired: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const headRatios = ratios.slice(0, head)
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
          {assignMasonryLanes(headRatios, columns).lanes.map((lane, laneIndex) => (
            <div key={laneIndex} className={s.ssrLane}>
              {lane.map((index) => renderTile(items[index], index, info(index)))}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

/* ---------- masonry tail: one window virtualizer per lane ---------- */

function MasonryTail<T extends Tile>({
  items,
  ratios,
  lanes,
  head,
  columnWidth,
  gap,
  offset,
  renderTile,
  info,
}: {
  items: T[]
  ratios: number[]
  lanes: number[][]
  head: number
  columnWidth: number
  gap: number
  offset: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const tile = (index: number) => columnWidth * ratios[index] + gap
  const headEnds = lanes.map((lane) => lane.filter((index) => index < head).reduce((sum, index) => sum + tile(index), 0))
  const tails = useMemo(() => lanes.map((lane) => lane.filter((index) => index >= head)), [lanes, head])

  // One window virtualizer per lane; the lane count is fixed for this mount
  // (the parent remounts on a new column count). Heights are exact.
  const virtualizers = tails.map((tail, lane) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWindowVirtualizer({
      count: tail.length,
      overscan: 4,
      scrollMargin: offset + headEnds[lane],
      estimateSize: (row) => tile(tail[row]),
      getItemKey: (row) => items[tail[row]]?.id ?? row,
    })
  )
  useEffect(() => {
    for (const virtualizer of virtualizers) virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnWidth, gap, tails])

  // DOM in gallery order (tab order, screen readers), whatever the lane.
  const cells: { index: number; key: string; lane: number; top: number; size: number }[] = []
  virtualizers.forEach((virtualizer, lane) => {
    for (const row of virtualizer.getVirtualItems()) {
      cells.push({ index: tails[lane][row.index], key: String(row.key), lane, top: row.start - offset, size: row.size })
    }
  })
  cells.sort((a, b) => a.index - b.index)

  return (
    <div className={s.vTail}>
      {cells.map((cell) => {
        const item = items[cell.index]
        if (!item) return null
        return (
          <div
            key={cell.key}
            className={s.vCell}
            style={{
              transform: `translate3d(${cell.lane * (columnWidth + gap)}px, ${cell.top}px, 0)`,
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

/* ---------- cropped layouts tail: chunks of whole rows below the head ---------- */

function ChunkTail<T extends Tile>({
  items,
  head,
  layout,
  columns,
  width,
  gap,
  offset,
  renderTile,
  info,
}: {
  items: T[]
  head: number
  layout: GridLayout
  columns: number
  width: number
  gap: number
  /** Document offset of the tail (below the head and one gap). */
  offset: number
  renderTile: RenderTile<T>
  info: (index: number) => GridTileInfo
}) {
  const perChunk = chunkSize(layout, columns)
  const virtualizer = useWindowVirtualizer({
    count: Math.ceil((items.length - head) / perChunk),
    overscan: 2,
    scrollMargin: offset,
    estimateSize: (chunk) => {
      const start = head + chunk * perChunk
      return estimateChunkHeight(layout, items.slice(start, start + perChunk), columns, width, gap)
    },
    getItemKey: (chunk) => `${perChunk}:${chunk}`,
  })
  useEffect(() => {
    virtualizer.measure()
  }, [virtualizer, width, columns, perChunk, items, head])

  return (
    <div
      className={s.vChunkTail}
      style={{ marginTop: gap, height: Math.max(virtualizer.getTotalSize() - gap, 0) }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const start = head + row.index * perChunk
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

/**
 * Pure layout maths for the virtualized gallery grid (GalleryGrid.tsx). The
 * numbers mirror GalleryExperience.module.css exactly, so a virtualized grid
 * looks the same as the CSS-only grid it replaced:
 *   - masonry: `columns: --g-cols`, 2 at ≤ 900 px, 1 at ≤ 560 px;
 *   - square / portrait / collage: `repeat(--g-cols)`, 2 at ≤ 900 px (phones too);
 *   - editorial: 3 columns, 2 at ≤ 900 px;
 *   - rows (justified): no columns — rows of one height, every photo whole
 *     (see justifyRows); `columns` only picks the target row height.
 */

export type GridLayout = 'masonry' | 'square' | 'portrait' | 'collage' | 'editorial' | 'rows'

/** Column count the CSS grid would use at this viewport width. */
export function gridColumns(layout: GridLayout, desired: number, viewportWidth: number): number {
  if (layout === 'editorial') return viewportWidth <= 900 ? 2 : 3
  // «Рядки» has no real columns; for `sizes` a tile is about as wide as a
  // masonry column (a lone landscape on a phone takes the full width).
  if (viewportWidth <= 560) return layout === 'masonry' || layout === 'rows' ? 1 : 2
  if (viewportWidth <= 900) return 2
  return Math.max(1, Math.round(desired))
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Cropped layouts are virtualized in chunks: each chunk is its own CSS grid
 * with the original classes, so `:nth-child` patterns keep working. A chunk
 * must be a whole number of the layout's repeating pattern AND fill whole rows,
 * otherwise the seams between chunks would show:
 *   - square / portrait: one row;
 *   - editorial: 4 tiles ([wide][sq] / [sq][wide], or 3 rows at 2 columns);
 *   - collage: every 6th tile is 2×2, so 6 tiles cover 9 cells; the chunk is
 *     the smallest multiple of 6 tiles whose cells fill whole rows.
 */
export function chunkSize(layout: GridLayout, columns: number): number {
  if (layout === 'editorial') return 4
  if (layout === 'collage') return 6 * (columns / gcd(9, columns))
  return columns
}

/** Height ÷ width of a cropped tile (`--g-tile`). */
export function tileRatio(layout: GridLayout): number {
  return layout === 'portrait' ? 4 / 3 : 1
}

type Dims = { width: number | null; height: number | null }

/** Estimated chunk height (the virtualizer then measures the real one). */
export function estimateChunkHeight(
  layout: GridLayout,
  tiles: readonly Dims[],
  columns: number,
  width: number,
  gap: number
): number {
  const count = tiles.length
  const cell = Math.max((width - gap * (columns - 1)) / columns, 1)
  if (layout === 'collage') {
    const big = Math.ceil(count / 6)
    return Math.ceil((count + 3 * big) / columns) * (cell + gap)
  }
  if (layout === 'editorial') {
    if (columns >= 3) {
      // Rows of [wide][square] / [square][wide]. A wide tile keeps its photo's
      // own proportions, so a tall frame makes its row taller than the square.
      const wideWidth = 2 * cell + gap
      let total = 0
      for (let row = 0; row * 2 < count; row++) {
        const wide = tiles[row % 2 === 0 ? row * 2 : row * 2 + 1] ?? tiles[row * 2]
        const natural = wide?.width && wide?.height ? (wideWidth * wide.height) / wide.width : (wideWidth * 2) / 3
        const alone = row * 2 + 1 >= count
        total += (alone ? wideWidth / 2 : Math.max(cell, natural)) + gap
      }
      return total
    }
    // 2 columns: [wide 3:2, full width] [square square] [wide] per 4 tiles
    const wides = Math.ceil(count / 4) + (count % 4 === 0 ? 1 : 0)
    const squares = count - wides
    return wides * ((width * 2) / 3 + gap) + Math.ceil(squares / 2) * (cell + gap)
  }
  return Math.ceil(count / columns) * (cell * tileRatio(layout) + gap)
}

/**
 * A photo without stored width/height (an old HEIC the browser couldn't
 * decode at upload, …) gets a 4:5 slot and is shown whole inside it
 * (object-fit: contain on the tile's neutral background) — never cropped.
 */
export const UNKNOWN_RATIO = 5 / 4

export function hasDimensions(width: number | null | undefined, height: number | null | undefined): boolean {
  return !!width && !!height && width > 0 && height > 0
}

/** Height ÷ width of a masonry tile. */
export function masonryRatio(width: number | null | undefined, height: number | null | undefined): number {
  return hasDimensions(width, height) ? (height as number) / (width as number) : UNKNOWN_RATIO
}

/**
 * Masonry lane for every tile: the shortest column so far, measured in tile
 * heights relative to the column width (plus a fixed allowance for the gap).
 * It depends on the photos' proportions and the column count only — never on
 * the pixel width — so the server-rendered fallback and the virtualized grid
 * put every photo in the same column, and swapping one for the other moves
 * nothing.
 */
const GAP_ALLOWANCE = 0.04

export function assignMasonryLanes(
  ratios: readonly number[],
  columns: number
): { lanes: number[][]; laneOf: number[] } {
  const lanes: number[][] = Array.from({ length: columns }, () => [])
  const ends = new Array<number>(columns).fill(0)
  const laneOf = new Array<number>(ratios.length)
  for (let index = 0; index < ratios.length; index++) {
    let best = 0
    for (let lane = 1; lane < columns; lane++) if (ends[lane] < ends[best] - 1e-9) best = lane
    lanes[best].push(index)
    laneOf[index] = best
    ends[best] += ratios[index] + GAP_ALLOWANCE
  }
  return { lanes, laneOf }
}

/** Distinct masonry column counts across the breakpoints (phone, tablet, desktop). */
export function masonryBreakpointColumns(desired: number): { phone: number; tablet: number; desktop: number } {
  return {
    phone: gridColumns('masonry', desired, 400),
    tablet: gridColumns('masonry', desired, 800),
    desktop: gridColumns('masonry', desired, 1280),
  }
}

/** About how many tiles the server renders; they stay in the DOM for good. */
export const SSR_TILES = 24
/**
 * When the grid is on the first screen («Мінімал» cover): the first tiles load
 * at once, and the very first ones with fetchpriority="high". Under a photo
 * cover every tile is lazy, so the cover gets the bandwidth first.
 */
export const EAGER_TILES = 6
export const HIGH_PRIORITY_TILES = 3

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

/**
 * The server-rendered head of the grid. It is never replaced: after hydration
 * only the tiles after it are virtualized, so the head's images, layout and
 * LCP element stay exactly as the HTML painted them. For cropped layouts the
 * head must end on a whole chunk at EVERY breakpoint (CSS picks the columns),
 * so the virtualized tail continues the pattern seamlessly.
 */
export function headCount(layout: GridLayout, desired: number, total: number): number {
  let unit = 1
  if (layout !== 'masonry' && layout !== 'rows') {
    for (const viewport of [400, 800, 1280]) unit = lcm(unit, chunkSize(layout, gridColumns(layout, desired, viewport)))
  }
  return Math.min(total, Math.ceil(SSR_TILES / unit) * unit)
}

/**
 * Columns a tile spans: collage makes every 6th tile 2×2, editorial makes
 * tiles 4n+1 and 4n (1-based) wide. Index is the tile's position in the gallery
 * (chunks are aligned to these patterns, so it equals the position in its chunk).
 */
export function tileSpan(layout: GridLayout, index: number): 1 | 2 {
  if (layout === 'collage') return index % 6 === 0 ? 2 : 1
  if (layout === 'editorial') return index % 4 === 0 || index % 4 === 3 ? 2 : 1
  return 1
}

/**
 * `sizes` for a grid tile, from the layout alone (no measurement), so the
 * server and the browser pick the very same srcset candidate and no image is
 * downloaded twice. Mirrors the CSS breakpoints; page padding is
 * clamp(14px, 3vw, 32px) and the grid is at most 1280 px wide.
 */
export function gridSizes(layout: GridLayout, desired: number, gap: number, span: 1 | 2): string {
  const width = (content: string, columns: number) => {
    const cols = Math.min(span, columns)
    // (content − (n−1)·gap) / n · span + (span−1)·gap
    return `calc((${content} - ${(columns - 1) * gap}px) / ${columns} * ${cols} + ${(cols - 1) * gap}px)`
  }
  const phone = gridColumns(layout, desired, 400)
  const tablet = gridColumns(layout, desired, 800)
  const desktop = gridColumns(layout, desired, 1280)
  return [
    `(max-width: 560px) ${width('100vw - 28px', phone)}`,
    `(max-width: 900px) ${width('94vw', tablet)}`,
    `(min-width: 1280px) ${width('1216px', desktop)}`,
    width('100vw - 64px', desktop),
  ].join(', ')
}

/**
 * Grid tiles offer both renditions; the browser picks by tile size and screen
 * density. The light WebP is declared as 1350w (its real 1080 px plus 25 %
 * slack): a phone tile — even 1 column on a 3× iPhone, ≈1200 device px —
 * takes the ~150 KB WebP, and only a big tile on a dense desktop screen
 * (editorial's wide frame, 2-column grids) takes the 2048 px preview.
 */
export function gridSrcSet(item: { previewUrl: string; gridUrl?: string | null }): string | undefined {
  return item.gridUrl ? `${item.gridUrl} 1350w, ${item.previewUrl} 2048w` : undefined
}

export function gridSrc(item: { previewUrl: string; gridUrl?: string | null }): string {
  return item.gridUrl || item.previewUrl
}

/* ---------- «Рядки» (justified rows, as on Pixieset / Flickr) ---------- */

/**
 * Target row height in px, by breakpoint. The SAME numbers are in
 * GalleryExperience.module.css (`--g-row-h`): the server-rendered head wraps
 * with CSS flexbox, the virtualized tail with justifyRows, and both must break
 * the rows at the same photos. On desktop the «columns» pick sets it: more
 * columns, lower rows, more photos per row.
 */
export const ROW_HEIGHT_PHONE = 100
export const ROW_HEIGHT_TABLET = 200

export function rowDesktopHeight(desired: number): number {
  return desired <= 2 ? 340 : desired >= 4 ? 180 : 240
}

export function rowTargetHeight(desired: number, viewportWidth: number): number {
  if (viewportWidth <= 560) return ROW_HEIGHT_PHONE
  if (viewportWidth <= 900) return ROW_HEIGHT_TABLET
  return rowDesktopHeight(desired)
}

/** Width ÷ height of a «Рядки» tile (unknown size: the same 4:5 slot as masonry). */
export function rowAspect(width: number | null | undefined, height: number | null | undefined): number {
  return 1 / masonryRatio(width, height)
}

export interface JustifiedRow {
  /** First tile (gallery index) and one past the last. */
  start: number
  end: number
  /** Row height in px; every tile of the row has it, widths follow the photos. */
  height: number
  /** The gallery's final row: not stretched, left-aligned at the target height. */
  last: boolean
}

/**
 * Splits photos into justified rows. It reproduces CSS `flex-wrap` exactly —
 * each tile's basis is aspect × target height, a tile goes on the line while
 * the bases plus gaps fit, then the line grows in proportion to the aspects —
 * so the server's flexbox head and these rows break at the same photos.
 * Every full row fills the width exactly: height = (width − gaps) ÷ Σ aspect.
 * Nothing is cropped: each tile has its photo's proportions.
 */
export function justifyRows(
  aspects: readonly number[],
  width: number,
  target: number,
  gap: number
): JustifiedRow[] {
  const rows: JustifiedRow[] = []
  if (width <= 0 || target <= 0) return rows
  let start = 0
  let used = 0
  let sum = 0
  const close = (end: number, last: boolean) => {
    const fitted = (width - gap * (end - start - 1)) / sum
    // A row that holds one photo wider than the screen shrinks to fit (CSS
    // flex-shrink); the final row is never stretched beyond the target.
    rows.push({ start, end, height: last ? Math.min(target, fitted) : fitted, last })
  }
  for (let index = 0; index < aspects.length; index++) {
    const aspect = aspects[index] > 0 ? aspects[index] : 1 / UNKNOWN_RATIO
    const basis = aspect * target
    if (index > start && used + gap + basis > width + 1e-6) {
      close(index, false)
      start = index
      used = 0
      sum = 0
    }
    used += (index > start ? gap : 0) + basis
    sum += aspect
  }
  if (aspects.length > start) close(aspects.length, true)
  return rows
}

/** Total height of the rows (gaps between rows, none after the last). */
export function rowsHeight(rows: readonly JustifiedRow[], gap: number): number {
  return rows.reduce((sum, row) => sum + row.height, 0) + gap * Math.max(rows.length - 1, 0)
}

/**
 * Where the server-rendered head ends once the width is known: it is extended
 * to the end of the row holding its last tile, so that row is complete (and
 * justified) and the virtualized tail starts on a fresh row.
 */
export function rowsHeadEnd(rows: readonly JustifiedRow[], head: number): number {
  if (head <= 0) return 0
  const row = rows.find((r) => r.start < head && head <= r.end)
  return row ? row.end : head
}

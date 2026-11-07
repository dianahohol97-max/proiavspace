/**
 * Pure layout maths for the virtualized gallery grid (GalleryGrid.tsx). The
 * numbers mirror GalleryExperience.module.css exactly, so a virtualized grid
 * looks the same as the CSS-only grid it replaced:
 *   - masonry: `columns: --g-cols`, 2 at ≤ 900 px, 1 at ≤ 560 px;
 *   - square / portrait / collage: `repeat(--g-cols)`, 2 at ≤ 900 px (phones too);
 *   - editorial: 3 columns, 2 at ≤ 900 px.
 */

export type GridLayout = 'masonry' | 'square' | 'portrait' | 'collage' | 'editorial'

/** Column count the CSS grid would use at this viewport width. */
export function gridColumns(layout: GridLayout, desired: number, viewportWidth: number): number {
  if (layout === 'editorial') return viewportWidth <= 900 ? 2 : 3
  if (viewportWidth <= 560) return layout === 'masonry' ? 1 : 2
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

/** Masonry tile height for a known aspect ratio; null when the size is unknown. */
export function masonryTileHeight(
  width: number | null | undefined,
  height: number | null | undefined,
  columnWidth: number
): number | null {
  if (!width || !height) return null
  return (columnWidth * height) / width
}

/**
 * Grid tiles take the light ~1080 px WebP (`mobile`) whenever it is sharp
 * enough for the tile — always on phones — and the 2048 px preview only for a
 * big tile on a dense screen. Device pixel ratio is capped at 2: a 3× phone
 * screen gains nothing visible from a third more pixels in a grid tile.
 */
export const MOBILE_VARIANT_PX = 1080

export function pickGridSrc(
  item: { previewUrl: string; gridUrl?: string | null },
  tileCssWidth: number,
  devicePixelRatio: number
): string {
  if (!item.gridUrl) return item.previewUrl
  const needed = tileCssWidth * Math.min(Math.max(devicePixelRatio, 1), 2)
  return needed <= MOBILE_VARIANT_PX * 1.25 ? item.gridUrl : item.previewUrl
}

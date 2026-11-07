import type { PortfolioItem } from '../SiteRenderer'

type Orient = 'landscape' | 'portrait' | 'unknown'

export interface SpreadSlot {
  item: PortfolioItem
  /** 12-column desktop placement. */
  desk: {
    col: number
    span: number
    align: 'start' | 'end'
    ratio: string
    /** Second frame of a pair (for a small reveal stagger). */
    second: boolean
  }
  /** Two-column phone placement: full width or half of a pair. */
  mobile: { full: boolean; ratio: string }
}

const LANDSCAPE = '3 / 2'
const PORTRAIT = '4 / 5'
const WIDE = '16 / 9'

function orient(p: PortfolioItem): Orient {
  if (!p.width || !p.height) return 'unknown'
  return p.width >= p.height ? 'landscape' : 'portrait'
}

/**
 * The «Тиша» editorial spread: rows of «big + small» pairs that alternate
 * sides and alignment (top / bottom), and every third row — i.e. roughly
 * every 5th frame — one frame across the full content width. Frames take
 * 40–65% of the width, never the scattered quarter-width tiles of before.
 *
 * Orientation-aware when the pixel size is known (portfolio_assets keeps it
 * from upload): landscape frames get landscape slots, portrait frames
 * portrait ones, and only a landscape frame is ever stretched full width.
 * Unknown sizes fall back to the fixed rhythm (big = landscape, small =
 * portrait, full = wide), so older uploads still form a coherent spread.
 *
 * Phones: one full-width frame, then a pair side by side, repeating.
 */
export function layoutEditorial(items: PortfolioItem[]): SpreadSlot[] {
  const queue = [...items]
  const out: SpreadSlot[] = []
  let row = 0
  let pairNo = 0

  const ratioOf = (o: Orient, fallback: string) =>
    o === 'landscape' ? LANDSCAPE : o === 'portrait' ? PORTRAIT : fallback

  while (queue.length > 0) {
    const fullTurn = row % 3 === 2
    if (fullTurn || queue.length === 1) {
      // Full width needs a landscape (or unknown) frame; a lone portrait
      // left at the end sits centred instead.
      const idx = queue.findIndex((p) => orient(p) !== 'portrait')
      if (idx >= 0) {
        const [item] = queue.splice(idx, 1)
        out.push({
          item,
          desk: { col: 1, span: 12, align: 'start', ratio: WIDE, second: false },
          mobile: { full: true, ratio: LANDSCAPE },
        })
        row += 1
        continue
      }
      if (queue.length === 1) {
        const [item] = queue.splice(0, 1)
        out.push({
          item,
          desk: { col: 4, span: 6, align: 'start', ratio: PORTRAIT, second: false },
          mobile: { full: true, ratio: PORTRAIT },
        })
        break
      }
    }

    // A pair. The bigger slot goes to the landscape frame when there is one.
    let [a, b] = queue.splice(0, 2)
    const oa = orient(a)
    const ob = orient(b)
    if (oa === 'portrait' && ob === 'landscape') [a, b] = [b, a]
    const big = orient(a)
    const small = orient(b)
    const bothPortrait = big === 'portrait' && small === 'portrait'
    const bigSpan = bothPortrait ? 6 : 7
    const smallSpan = 5
    const bigLeft = pairNo % 2 === 0
    const align: 'start' | 'end' = pairNo % 2 === 0 ? 'start' : 'end'
    const bigSlot = (second: boolean) => ({
      col: bigLeft ? 1 : 12 - bigSpan + 1,
      span: bigSpan,
      align,
      ratio: ratioOf(big, LANDSCAPE),
      second,
    })
    const smallSlot = (second: boolean) => ({
      col: bigLeft ? 12 - smallSpan + 1 : 1,
      span: smallSpan,
      align,
      ratio: ratioOf(small, PORTRAIT),
      second,
    })
    const pairMobile = { full: false, ratio: PORTRAIT }
    if (bigLeft) {
      out.push({ item: a, desk: bigSlot(false), mobile: pairMobile })
      out.push({ item: b, desk: smallSlot(true), mobile: pairMobile })
    } else {
      out.push({ item: b, desk: smallSlot(false), mobile: pairMobile })
      out.push({ item: a, desk: bigSlot(true), mobile: pairMobile })
    }
    pairNo += 1
    row += 1
  }

  // Phones: «full, pair» rhythm over the final order — a full-width frame,
  // then two side by side. A frame left alone at the end goes full width.
  let k = 0
  for (let i = 0; i < out.length; i++) {
    const slot = out[i]
    const full = k % 3 === 0 || i === out.length - 1 && k % 3 === 1
    slot.mobile = full
      ? { full: true, ratio: orient(slot.item) === 'portrait' ? PORTRAIT : LANDSCAPE }
      : { full: false, ratio: PORTRAIT }
    k += 1
  }
  return out
}

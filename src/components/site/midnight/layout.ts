import type { PortfolioItem } from '../SiteRenderer'

type Orient = 'landscape' | 'portrait' | 'unknown'

export type MidnightRow = 'pair' | 'trio' | 'pause'

export interface MidnightSlot {
  item: PortfolioItem
  row: MidnightRow
  /** Position inside its row (0-based). */
  index: number
  desk: { col: number; span: number; ratio: string; offset: 0 | 1 | 2; bleed: boolean }
  mobile: { full: boolean; ratio: string }
}

function orient(p: PortfolioItem): Orient {
  if (!p.width || !p.height) return 'unknown'
  return p.width >= p.height ? 'landscape' : 'portrait'
}

const ROWS: MidnightRow[] = ['pair', 'trio', 'pause', 'trio', 'pair', 'pause']

/**
 * «Опівніч»'s rhythm — different from «Тиша»'s spreads: a wide pair with a
 * dark column between the frames, a «contact sheet» trio of portraits, then a
 * PAUSE: one frame across the whole screen with a long stretch of dark around
 * it. Orientation-aware when pixel sizes are known (landscape frames take the
 * wide slots and the pause, portraits the trio); unknown sizes keep the fixed
 * rhythm. Phones: pairs stay side by side; a trio opens with one full-width
 * frame; the pause stays full width.
 */
export function layoutMidnight(items: PortfolioItem[]): MidnightSlot[] {
  const queue = [...items]
  const out: MidnightSlot[] = []
  let r = 0
  let pairNo = 0
  const take = (prefer: Orient | null): PortfolioItem => {
    const i = prefer ? queue.findIndex((p) => orient(p) === prefer) : -1
    return queue.splice(i >= 0 ? i : 0, 1)[0]
  }

  while (queue.length > 0) {
    let row = ROWS[r % ROWS.length]
    if (row === 'trio' && queue.length < 3) row = queue.length === 2 ? 'pair' : 'pause'
    if (row === 'pair' && queue.length === 1) row = 'pause'
    if (row === 'pause' && !queue.some((p) => orient(p) !== 'portrait') && queue.length >= 2) row = 'pair'

    if (row === 'pause') {
      const item = take(queue.some((p) => orient(p) === 'landscape') ? 'landscape' : null)
      const o = orient(item)
      out.push({
        item,
        row,
        index: 0,
        desk: o === 'portrait'
          ? { col: 4, span: 6, ratio: '4 / 5', offset: 0, bleed: false }
          : { col: 1, span: 12, ratio: '21 / 9', offset: 0, bleed: true },
        mobile: { full: true, ratio: o === 'portrait' ? '4 / 5' : '3 / 2' },
      })
    } else if (row === 'pair') {
      const big = take('landscape')
      const small = take('portrait')
      const left = pairNo % 2 === 0
      const bigRatio = orient(big) === 'portrait' ? '4 / 5' : '3 / 2'
      const smallRatio = orient(small) === 'landscape' ? '3 / 2' : '4 / 5'
      const bigSlot = { col: left ? 1 : 6, span: 7, ratio: bigRatio, offset: 0 as const, bleed: false }
      const smallSlot = { col: left ? 9 : 1, span: 4, ratio: smallRatio, offset: 2 as const, bleed: false }
      const half = { full: false, ratio: '4 / 5' }
      if (left) {
        out.push({ item: big, row, index: 0, desk: bigSlot, mobile: half })
        out.push({ item: small, row, index: 1, desk: smallSlot, mobile: half })
      } else {
        out.push({ item: small, row, index: 0, desk: smallSlot, mobile: half })
        out.push({ item: big, row, index: 1, desk: bigSlot, mobile: half })
      }
      pairNo += 1
    } else {
      for (let i = 0; i < 3; i++) {
        const item = take('portrait')
        out.push({
          item,
          row,
          index: i,
          desk: { col: 1 + i * 4, span: 4, ratio: orient(item) === 'landscape' ? '3 / 2' : '4 / 5', offset: ([0, 1, 0] as const)[i], bleed: false },
          mobile: i === 0
            ? { full: true, ratio: orient(item) === 'landscape' ? '3 / 2' : '4 / 5' }
            : { full: false, ratio: '4 / 5' },
        })
      }
    }
    r += 1
  }
  return out
}

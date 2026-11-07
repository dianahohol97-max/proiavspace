import type { PortfolioItem } from '../SiteRenderer'

export type JournalRow =
  | { kind: 'feature'; items: [PortfolioItem]; flip: boolean }
  | { kind: 'pair'; items: [PortfolioItem, PortfolioItem] }
  | { kind: 'triptych'; items: [PortfolioItem, PortfolioItem, PortfolioItem] }

const PATTERN: JournalRow['kind'][] = ['feature', 'pair', 'triptych', 'feature', 'pair']

/**
 * «Журнал» pages: a FEATURE (one big frame beside its caption column, like an
 * opening page), a PAIR (two frames, the second set lower), a TRIPTYCH (three
 * equal frames) — then the feature again, mirrored. Nine frames fill exactly
 * one round; fewer frames fall back to the largest row that still fits.
 */
export function layoutJournal(items: PortfolioItem[]): JournalRow[] {
  const queue = [...items]
  const rows: JournalRow[] = []
  let features = 0
  let r = 0
  while (queue.length > 0) {
    let kind = PATTERN[r % PATTERN.length]
    if (kind === 'triptych' && queue.length < 3) kind = queue.length === 2 ? 'pair' : 'feature'
    if (kind === 'pair' && queue.length < 2) kind = 'feature'
    if (kind === 'feature') {
      rows.push({ kind, items: [queue.shift()!], flip: features % 2 === 1 })
      features += 1
    } else if (kind === 'pair') {
      rows.push({ kind, items: [queue.shift()!, queue.shift()!] })
    } else {
      rows.push({ kind, items: [queue.shift()!, queue.shift()!, queue.shift()!] })
    }
    r += 1
  }
  return rows
}

/** Aspect ratio from the pixel size, else portrait (editorial frames mostly are). */
export function ratio(p: PortfolioItem, fallback = '4 / 5'): string {
  return p.width && p.height ? `${p.width} / ${p.height}` : fallback
}

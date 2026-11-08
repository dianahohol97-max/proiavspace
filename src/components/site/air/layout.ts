import type { PortfolioItem } from '../SiteRenderer'

export interface AirPrint {
  item: PortfolioItem
  /** Place in its cluster: 0 big, 1 medium, 2 small. */
  role: 0 | 1 | 2
  mirror: boolean
  /** Resting tilt in degrees (prints on a table are never perfectly square). */
  tilt: number
  ratio: string
}

const TILTS = [-1.4, 1.1, -0.7, 0.9, -1.1, 0.6, 1.3, -0.9, 0.5]

function ratioOf(p: PortfolioItem): string {
  return p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5'
}

/**
 * «Повітря»'s collage: clusters of three prints laid on a table — a big one,
 * a medium one overlapping its edge, a small one tucked in — alternating
 * sides. Real aspect ratios when known (nothing is cropped into a slot), a
 * slight resting tilt per print. Groups of three; a remainder becomes a
 * shorter cluster.
 */
export function layoutAir(items: PortfolioItem[]): AirPrint[][] {
  const clusters: AirPrint[][] = []
  for (let i = 0; i < items.length; i += 3) {
    const mirror = clusters.length % 2 === 1
    clusters.push(
      items.slice(i, i + 3).map((item, k) => ({
        item,
        role: k as 0 | 1 | 2,
        mirror,
        tilt: TILTS[(i + k) % TILTS.length],
        ratio: ratioOf(item),
      }))
    )
  }
  return clusters
}

const TIME = /^\s*(\d{1,2})[:.](\d{2})\s*[·•\-—–|]\s*(.+)$/

/**
 * «День у світлі» frames: photos whose caption starts with a time —
 * «08:40 · Ранок біля вікна» — in the order of the day. The time is how a
 * photographer opts a frame in (no extra field needed).
 */
export function dayMoments(items: PortfolioItem[]): { item: PortfolioItem; time: string; label: string; minutes: number }[] {
  return items
    .map((item) => {
      const m = TIME.exec(item.caption ?? '')
      if (!m) return null
      const h = Number(m[1])
      const min = Number(m[2])
      if (h > 23 || min > 59) return null
      return { item, time: `${String(h).padStart(2, '0')}:${m[2]}`, label: m[3].trim(), minutes: h * 60 + min }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.minutes - b.minutes)
}

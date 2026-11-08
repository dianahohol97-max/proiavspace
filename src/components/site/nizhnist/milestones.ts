import type { PortfolioItem } from '../SiteRenderer'

const AGE = /^\s*(новонароджен\S*|(\d+(?:[.,]\d+)?)\s*(тиж\S*|міс\S*|р(?:ік|оки|оків)?\.?))\s*[·•\-—–|]\s*(.+)$/i

/**
 * «Рік малюка»: frames whose caption starts with an age — «3 міс · Перша
 * усмішка», «1 рік · Свічка на торті», «новонароджений · …» — in the order
 * of age. The caption is how the photographer opts a frame in.
 */
export function milestones(items: PortfolioItem[]): { item: PortfolioItem; age: string; label: string; days: number }[] {
  return items
    .map((item) => {
      const m = AGE.exec(item.caption ?? '')
      if (!m) return null
      const n = m[2] ? Number(m[2].replace(',', '.')) : 0
      const unit = (m[3] ?? '').toLowerCase()
      const days = !m[2] ? 0 : unit.startsWith('тиж') ? n * 7 : unit.startsWith('міс') ? n * 30 : n * 365
      return { item, age: m[1].trim(), label: m[4].trim(), days }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.days - b.days)
}

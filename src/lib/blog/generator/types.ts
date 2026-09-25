import type { Block } from '@/lib/blog/articles'

/** A queued topic (blog_topics row) or an ad-hoc brief for a rewrite. */
export interface Topic {
  id?: string
  slug?: string
  title: string
  /** Target search query — must appear in seoTitle, description, first paragraph. */
  query: string
  angle: string
  /** Mandatory extras: table columns, special sections, "annual update", … */
  brief?: string
}

/** One researched fact. `value: null` means the search did not find it. */
export interface Fact {
  claim: string
  value: string | null
  /** For prices: amount + ISO currency (USD/EUR/UAH). */
  amount?: number | null
  currency?: string | null
  url: string | null
  /** "вересень 2026" — when the fact was read. */
  checked: string
  note?: string
}

/** What the writing step returns (before price markers are expanded). */
export interface Draft {
  title: string
  seoTitle: string
  description: string
  tags: string[]
  body: Block[]
}

/** A price marker after expansion — kept for the source check. */
export interface PriceRef {
  amount: number | null
  currency: string
  url: string
  text: string
}

export interface Rates {
  /** ISO date of the NBU rate (dd.mm.yyyy for display is derived). */
  date: string
  /** UAH per unit, e.g. { USD: 41.3, EUR: 48.2 }. */
  uah: Record<string, number>
}

export type Level = 'error' | 'warning'

export interface Issue {
  level: Level
  check: string
  message: string
}

export interface QualityReport {
  ok: boolean
  checkedAt: string
  words: number
  stats: {
    intro: number
    h2: number
    tables: number
    faq: number
    images: number
    prices: number
    productLinks: string[]
    articleLinks: string[]
    externalLinks: number
  }
  issues: Issue[]
}

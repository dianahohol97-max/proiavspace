import type { Block } from '@/lib/blog/articles'
import { fmtRateDate, monthYear } from './nbu'
import type { PriceRef, Rates } from './types'

/**
 * Prices are never written by the model as plain text. It emits a marker and
 * the code formats it, converts to ₴ at the NBU rate and attaches the source:
 *
 *   {{price 14.99 USD | https://vendor.com/pricing}}
 *     → 14,99 $ ≈ 619 ₴ ([станом на вересень 2026](https://vendor.com/pricing))
 *   {{price 3000 UAH | https://…}} → 3 000 ₴ ([станом на вересень 2026](https://…))
 *   {{price ? USD | https://…}}    → ціну уточнюйте [на сайті](https://…)
 */
const MARKER = /\{\{\s*price\s+([\d.,]+|\?)\s*([A-Za-z]{3})?\s*\|\s*([^}\s]+)\s*\}\}/g

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', UAH: '₴', GBP: '£', PLN: 'zł' }
const NBSP = ' '

export function fmtNumber(n: number): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2)
  const [int, frac] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return frac ? `${grouped},${frac}` : grouped
}

function expandText(text: string, rates: Rates, refs: PriceRef[]): string {
  const asOf = monthYear(rates.date)
  return text.replace(MARKER, (_whole, rawAmount: string, rawCur: string | undefined, url: string) => {
    const currency = (rawCur ?? 'UAH').toUpperCase()
    if (rawAmount === '?') {
      const out = `ціну уточнюйте [на сайті](${url})`
      refs.push({ amount: null, currency, url, text: out })
      return out
    }
    const amount = Number(rawAmount.replace(',', '.'))
    const symbol = SYMBOL[currency] ?? currency
    let out = `${fmtNumber(amount)}${NBSP}${symbol}`
    if (currency !== 'UAH') {
      const rate = rates.uah[currency]
      if (rate) out += ` ≈ ${fmtNumber(Math.round(amount * rate))}${NBSP}₴`
    }
    out += ` ([станом на ${asOf}](${url}))`
    refs.push({ amount, currency, url, text: out })
    return out
  })
}

/** Expand every price marker in the body. Returns new blocks + the price refs. */
export function expandPrices(body: Block[], rates: Rates): { body: Block[]; prices: PriceRef[] } {
  const prices: PriceRef[] = []
  const t = (s: string) => expandText(s, rates, prices)
  const out = body.map((b): Block => {
    switch (b.type) {
      case 'p':
      case 'h2':
      case 'h3':
        return { ...b, text: t(b.text) }
      case 'ul':
      case 'ol':
        return { ...b, items: b.items.map(t) }
      case 'table':
        return { ...b, caption: b.caption && t(b.caption), head: b.head.map(t), rows: b.rows.map((r) => r.map(t)) }
      case 'faq':
        return { ...b, items: b.items.map((i) => ({ q: i.q, a: t(i.a) })) }
      default:
        return b
    }
  })

  // One line on the exchange rate, right before the FAQ (or at the end).
  const foreign = [...new Set(prices.filter((p) => p.amount !== null && p.currency !== 'UAH').map((p) => p.currency))]
  if (foreign.length) {
    const list = foreign
      .filter((c) => rates.uah[c])
      .map((c) => `1${NBSP}${SYMBOL[c] ?? c} = ${fmtNumber(Number(rates.uah[c].toFixed(2)))}${NBSP}₴`)
      .join(', ')
    const note: Block = {
      type: 'p',
      text: `Гривневі суми в статті пораховано за [офіційним курсом НБУ](https://bank.gov.ua/ua/markets/exchangerates) станом на ${fmtRateDate(rates.date)}: ${list}. Оплата карткою може відрізнятися на банківську комісію за конвертацію.`,
    }
    const faqAt = out.findIndex((b) => b.type === 'faq' || (b.type === 'h2' && /питанн|faq/i.test(b.text)))
    out.splice(faqAt >= 0 ? faqAt : out.length, 0, note)
  }
  return { body: out, prices }
}

/** Markers left unexpanded (malformed) — reported by the quality check. */
export function hasRawMarkers(body: Block[]): boolean {
  return JSON.stringify(body).includes('{{')
}

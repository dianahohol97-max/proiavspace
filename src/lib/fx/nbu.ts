/**
 * Official USD→UAH rate from the National Bank of Ukraine, for marketing
 * pages that compare dollar-priced services with our hryvnia tariffs.
 *
 * Never hardcode a rate: if the NBU API is down or answers with something
 * unexpected, callers get `null` and show dollar prices only.
 */
const NBU_USD_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json'

/** Human-facing source link shown next to converted prices. */
export const NBU_SOURCE_URL = 'https://bank.gov.ua/ua/markets/exchangerates'

export interface NbuRate {
  /** UAH per 1 USD. */
  rate: number
  /** Date the rate is set for, DD.MM.YYYY (as the NBU publishes it). */
  date: string
}

export async function getNbuUsdRate(): Promise<NbuRate | null> {
  try {
    const res = await fetch(NBU_USD_URL, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const row = Array.isArray(data) ? (data[0] as { rate?: unknown; exchangedate?: unknown } | undefined) : undefined
    const rate = typeof row?.rate === 'number' ? row.rate : NaN
    const date = typeof row?.exchangedate === 'string' ? row.exchangedate : ''
    if (!Number.isFinite(rate) || rate <= 0 || !/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return null
    return { rate, date }
  } catch {
    // Network error, timeout, bad JSON — the page renders USD only.
    return null
  }
}

/** `{{price:16}}`, `{{price:16.5}}` — a dollar amount to show with its hryvnia equivalent. */
const PRICE_MARKER = /\{\{price:(\d+(?:\.\d+)?)\}\}/g
/** `{{fx-date}}` — the date of the rate used, DD.MM.YYYY. */
const DATE_MARKER = /\{\{fx-date\}\}/g
/**
 * `{{fx-if}}…{{fx-end}}` — text that only makes sense with a rate (e.g. the
 * «Ціни в гривнях — за курсом НБУ на {{fx-date}}» note); dropped without one.
 */
const IF_RATE_BLOCK = /\{\{fx-if\}\}([\s\S]*?)\{\{fx-end\}\}/g

export function hasFxMarkers(text: string): boolean {
  return text.includes('{{price:') || text.includes('{{fx-')
}

function usd(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

/**
 * Substitute the markers. Prices become «$16 ≈ 720 ₴» / «$16 ≈ 720 UAH»
 * (hryvnias rounded to whole units) — the rate date is stated once, in a note
 * next to the prices, via {{fx-date}}. Without a rate: «$16», and every
 * {{fx-if}}…{{fx-end}} block disappears.
 */
export function renderFx(text: string, rate: NbuRate | null, locale: string): string {
  const en = locale === 'en'
  return text
    .replace(IF_RATE_BLOCK, (_, inner: string) => (rate ? inner : ''))
    .replace(DATE_MARKER, () => rate?.date ?? '')
    .replace(PRICE_MARKER, (_, raw: string) => {
      const amount = Number(raw)
      if (!rate) return usd(amount)
      const uah = Math.round(amount * rate.rate).toLocaleString(en ? 'en-US' : 'uk-UA')
      return en ? `${usd(amount)} ≈ ${uah} UAH` : `${usd(amount)} ≈ ${uah} ₴`
    })
}

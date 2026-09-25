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
/** `{{fx-source}}` — where the rate comes from; empty when there is no rate. */
const SOURCE_MARKER = /\{\{fx-source\}\}/g

export function hasFxMarkers(text: string): boolean {
  return text.includes('{{price:') || text.includes('{{fx-source}}')
}

function usd(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

/**
 * Substitute price markers: «$16 (≈ 660 ₴ за курсом НБУ на 25.09.2026)» /
 * «$16 (≈ 660 UAH at the NBU rate of 25.09.2026)». Hryvnias are rounded to
 * whole units. Without a rate: «$16».
 */
export function renderFx(text: string, rate: NbuRate | null, locale: string): string {
  const en = locale === 'en'
  return text
    .replace(PRICE_MARKER, (_, raw: string) => {
      const amount = Number(raw)
      if (!rate) return usd(amount)
      const uah = Math.round(amount * rate.rate).toLocaleString(en ? 'en-US' : 'uk-UA')
      return en
        ? `${usd(amount)} (≈ ${uah} UAH at the NBU rate of ${rate.date})`
        : `${usd(amount)} (≈ ${uah} ₴ за курсом НБУ на ${rate.date})`
    })
    .replace(SOURCE_MARKER, () => {
      if (!rate) return ''
      return en
        ? `Hryvnia equivalents use the official National Bank of Ukraine rate of ${rate.date}: $1 = ${rate.rate.toFixed(2)} UAH ([bank.gov.ua](${NBU_SOURCE_URL})).`
        : `Гривневі суми — за офіційним курсом НБУ на ${rate.date}: $1 = ${rate.rate.toFixed(2).replace('.', ',')} ₴ ([bank.gov.ua](${NBU_SOURCE_URL})).`
    })
}

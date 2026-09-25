import type { Rates } from './types'

const NBU = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange'

/** Official NBU rates (UAH per unit) for the given day — default today. */
export async function fetchNbuRates(
  currencies: string[] = ['USD', 'EUR'],
  day: Date = new Date()
): Promise<Rates> {
  const date = day.toISOString().slice(0, 10)
  const yyyymmdd = date.replace(/-/g, '')
  const uah: Record<string, number> = {}
  await Promise.all(
    currencies.map(async (code) => {
      const res = await fetch(`${NBU}?valcode=${code}&date=${yyyymmdd}&json`)
      if (!res.ok) throw new Error(`НБУ ${code}: HTTP ${res.status}`)
      const [row] = (await res.json()) as { rate?: number }[]
      if (!row?.rate) throw new Error(`НБУ не повернув курс ${code} на ${date}`)
      uah[code] = row.rate
    })
  )
  return { date, uah }
}

/** "USD=41.25,EUR=48.1" → Rates (CLI override when NBU is unreachable). */
export function parseRates(spec: string, date: string): Rates {
  const uah: Record<string, number> = {}
  for (const pair of spec.split(',')) {
    const [code, value] = pair.split('=')
    if (code && value) uah[code.trim().toUpperCase()] = Number(value)
  }
  return { date, uah }
}

export function fmtRateDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

const MONTHS = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
]

/** "вересень 2026" — the «станом на» label. */
export function monthYear(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

import { isLocale, type Locale } from '@/lib/i18n/config'
import { formatNumber, formatUah, intlLocale } from '@/lib/i18n/format'
import type { EmailCopy } from './types'
import { uk } from './locales/uk'
import { en } from './locales/en'
import { pl } from './locales/pl'
import { de } from './locales/de'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { it } from './locales/it'
import { ro } from './locales/ro'
import { pt } from './locales/pt'

export type { EmailCopy } from './types'

const COPY: Record<Locale, EmailCopy> = { uk, en, pl, de, es, fr, it, ro, pt }

/** The letter's language: any of the 9, anything else → Ukrainian. */
export function emailLocale(value: unknown): Locale {
  return typeof value === 'string' && isLocale(value) ? value : 'uk'
}

export function emailCopy(locale: string): EmailCopy {
  return COPY[emailLocale(locale)]
}

/**
 * A date in a letter, Kyiv time. Ukrainian keeps the approved «08.11.2026»;
 * the other languages spell the month («8 November 2026»), which reads the
 * same everywhere (no 11/08 vs 08/11 confusion).
 */
export function emailDate(date: Date | string, locale: string): string {
  const l = emailLocale(locale)
  if (l === 'uk') return new Date(date).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
  return new Date(date).toLocaleDateString(intlLocale(l), {
    timeZone: 'Europe/Kyiv',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** «129 ₴», «12,90 ₴» (uk, as approved); Intl currency elsewhere. */
export function emailMoney(amount: number, locale: string): string {
  const l = emailLocale(locale)
  if (l === 'uk') {
    const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',')
    return `${text} ₴`
  }
  return formatUah(amount, l)
}

/** «2,4 ГБ» / «2.4 GB» / «850 МБ». */
export function emailSize(bytes: number, locale: string): string {
  const l = emailLocale(locale)
  const units = COPY[l].units
  const gb = bytes / 1024 ** 3
  const one = (v: number) =>
    l === 'uk' ? v.toFixed(1).replace('.', ',') : formatNumber(Number(v.toFixed(1)), l, { maximumFractionDigits: 1 })
  if (gb >= 1024) return `${one(gb / 1024)} ${units.tb}`
  if (gb >= 1) return `${one(gb)} ${units.gb}`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} ${units.mb}`
}

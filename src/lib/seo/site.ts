import type { Locale } from '@/lib/i18n/config'

/** Canonical origin. Every absolute URL in metadata, JSON-LD and the sitemap derives from it. */
export const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

/** The brand as it is written everywhere — titles, footer, copyright. */
export const BRAND = 'проЯв'
/** Latin form of the brand (English copy, slugs, domain). */
export const BRAND_LATIN = 'proiav'

/**
 * Marketing pages are indexed only in these languages. The other locales are
 * client-facing (galleries, booking, photographer sites): their marketing
 * pages render the English copy with Ukrainian payment realities, so they
 * stay noindex,follow until they are genuinely localized.
 */
export const INDEXED_LOCALES: readonly Locale[] = ['uk', 'en']

export function isIndexedLocale(locale: string): boolean {
  return (INDEXED_LOCALES as readonly string[]).includes(locale)
}

/** Absolute URL for a site path (`/uk/halerei` → `https://proiav.space/uk/halerei`). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Official brand profiles (Instagram, Threads, Telegram…) → Organization.sameAs.
 * Empty until the accounts exist; add full URLs here and nothing else changes.
 */
export const BRAND_PROFILES: string[] = []

export const OG_LOCALE: Record<string, string> = {
  uk: 'uk_UA',
  en: 'en_US',
  pl: 'pl_PL',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
  ro: 'ro_RO',
  pt: 'pt_PT',
}

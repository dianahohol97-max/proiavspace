// All 9 languages are fully translated: dashboard, landing, pricing, legal
// texts (translations, the Ukrainian edition is binding), client pages, AI
// culling. tests/audit-storage/i18n-parity.test.ts keeps them in sync — a new
// string goes into every language. Glossary: docs/i18n/GLOSSARY.md.
export const locales = ['uk', 'en', 'pl', 'de', 'es', 'fr', 'it', 'ro', 'pt'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'uk'

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/** Short display labels for the language switchers (client + site). */
export const localeLabels: Record<Locale, string> = {
  uk: 'UA',
  en: 'EN',
  pl: 'PL',
  de: 'DE',
  es: 'ES',
  fr: 'FR',
  it: 'IT',
  ro: 'RO',
  pt: 'PT',
}

/** Full endonyms — shown in the photographer's dashboard language picker. */
export const localeNames: Record<Locale, string> = {
  uk: 'Українська',
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ro: 'Română',
  pt: 'Português',
}

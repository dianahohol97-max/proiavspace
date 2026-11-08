import type { Locale } from './config'
import { uk } from './dictionaries/uk'
import { en } from './dictionaries/en'

/** The Ukrainian dictionary is the source of truth for the shape. */
export type Dictionary = {
  [Section in keyof typeof uk]: { [Key in keyof (typeof uk)[Section]]: string }
}

/**
 * Typed as partial so a string added to uk/en doesn't break the build before
 * it is translated — the parity test (i18n-parity.test.ts) fails instead, and
 * at runtime the missing key falls back to English.
 */
type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> }
export type PartialDictionary = DeepPartial<Dictionary>

/** The other 7 languages, loaded on demand and overlaid on English. */
const partialLoaders: Partial<Record<Locale, () => Promise<PartialDictionary>>> = {
  pl: () => import('./dictionaries/pl').then((m) => m.pl),
  de: () => import('./dictionaries/de').then((m) => m.de),
  es: () => import('./dictionaries/es').then((m) => m.es),
  fr: () => import('./dictionaries/fr').then((m) => m.fr),
  it: () => import('./dictionaries/it').then((m) => m.it),
  ro: () => import('./dictionaries/ro').then((m) => m.ro),
  pt: () => import('./dictionaries/pt').then((m) => m.pt),
}

/** Overlay a partial dictionary onto the English base (one level per section). */
function mergeDictionary(base: Dictionary, over: PartialDictionary): Dictionary {
  const out: Record<string, Record<string, string>> = {}
  for (const section of Object.keys(base) as (keyof Dictionary)[]) {
    out[section] = { ...base[section], ...(over[section] ?? {}) }
  }
  return out as unknown as Dictionary
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === 'uk') return uk
  if (locale === 'en') return en
  const loader = partialLoaders[locale]
  if (!loader) return en
  return mergeDictionary(en, await loader())
}

/**
 * Site content — one JSON document per site (sites.content). Blocks are
 * shared across themes; this is the only thing the photographer edits.
 */

export interface PricingItem {
  name: string
  price: string
  /** What the price includes — one line per item. */
  includes: string[]
}

/** The text blocks that can be translated per language (hero + about). */
export interface SiteTextBlocks {
  hero: { title: string; subtitle: string }
  about: { text: string }
}

export interface SiteContent {
  /** imageId = a portfolio asset id chosen as the hero photo (shared across
   *  languages). Empty → themes fall back to the first portfolio photo. */
  hero: { title: string; subtitle: string; imageId: string }
  about: { text: string }
  pricing: { items: PricingItem[] }
  contact: {
    email: string
    phone: string
    instagram: string
    bookingUrl: string
  }
  /**
   * Per-language overrides of the text blocks, keyed by locale (e.g. 'en',
   * 'pl', 'de'). The base fields above are the default (Ukrainian); a client
   * on /{locale}/s/... sees the matching translation, falling back per field.
   */
  translations: Record<string, SiteTextBlocks>
  settings: {
    /** Extra languages the site is offered in (besides the Ukrainian base). */
    languages: string[]
    /** Render the lead form in the contact block. */
    leadForm: boolean
  }
}

export const EMPTY_CONTENT: SiteContent = {
  hero: { title: '', subtitle: '', imageId: '' },
  about: { text: '' },
  pricing: { items: [] },
  contact: { email: '', phone: '', instagram: '', bookingUrl: '' },
  translations: {},
  settings: { languages: [], leadForm: false },
}

/**
 * Content as the visitor should see it: on a non-Ukrainian route the
 * translated text blocks override the base ones (falling back per field, so a
 * missing translation never blanks a block).
 */
export function localizedSiteContent(content: SiteContent, locale: string): SiteContent {
  if (locale === 'uk') return content
  const t = content.translations[locale]
  if (!t) return content
  return {
    ...content,
    hero: {
      title: t.hero.title || content.hero.title,
      subtitle: t.hero.subtitle || content.hero.subtitle,
      // The hero photo is shared across languages — never overridden per locale.
      imageId: content.hero.imageId,
    },
    about: { text: t.about.text || content.about.text },
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseTextBlocks(value: unknown): SiteTextBlocks {
  const t = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const hero = (t.hero ?? {}) as Record<string, unknown>
  const about = (t.about ?? {}) as Record<string, unknown>
  return {
    hero: { title: asString(hero.title), subtitle: asString(hero.subtitle) },
    about: { text: asString(about.text) },
  }
}

/** Tolerant parse of sites.content — missing fields fall back to empty. */
export function parseSiteContent(value: unknown): SiteContent {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const hero = (v.hero ?? {}) as Record<string, unknown>
  const about = (v.about ?? {}) as Record<string, unknown>
  const pricing = (v.pricing ?? {}) as Record<string, unknown>
  const contact = (v.contact ?? {}) as Record<string, unknown>
  const settings = (
    typeof v.settings === 'object' && v.settings !== null ? v.settings : {}
  ) as Record<string, unknown>
  const items = Array.isArray(pricing.items) ? pricing.items : []

  // Per-language translations.
  const rawTranslations = (
    typeof v.translations === 'object' && v.translations !== null ? v.translations : {}
  ) as Record<string, unknown>
  const translations: Record<string, SiteTextBlocks> = {}
  for (const [loc, tv] of Object.entries(rawTranslations)) {
    translations[loc] = parseTextBlocks(tv)
  }
  // Migrate the legacy single `en` block into translations.en.
  if (!translations.en && typeof v.en === 'object' && v.en !== null) {
    const legacy = parseTextBlocks(v.en)
    if (legacy.hero.title || legacy.hero.subtitle || legacy.about.text) translations.en = legacy
  }

  // Enabled languages: explicit list, else derived from the legacy bilingual flag.
  let languages = Array.isArray(settings.languages)
    ? settings.languages.filter((l): l is string => typeof l === 'string' && l !== 'uk')
    : []
  if (languages.length === 0 && settings.bilingual === true) languages = ['en']

  return {
    hero: {
      title: asString(hero.title),
      subtitle: asString(hero.subtitle),
      imageId: asString(hero.imageId),
    },
    about: { text: asString(about.text) },
    pricing: {
      items: items
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map((i) => ({
          name: asString(i.name),
          price: asString(i.price),
          includes: Array.isArray(i.includes)
            ? i.includes.filter((line): line is string => typeof line === 'string' && !!line)
            : // legacy shape: a single description becomes the first line
              typeof i.description === 'string' && i.description
              ? [i.description]
              : [],
        }))
        .filter((i) => i.name),
    },
    contact: {
      email: asString(contact.email),
      phone: asString(contact.phone),
      instagram: asString(contact.instagram),
      bookingUrl: asString(contact.bookingUrl),
    },
    translations,
    settings: {
      languages,
      leadForm: settings.leadForm === true,
    },
  }
}

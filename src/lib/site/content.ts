/**
 * Site content — one JSON document per site (sites.content). Blocks are
 * shared across themes; this is the only thing the photographer edits.
 */

export interface PricingItem {
  name: string
  price: string
  /** What the price includes — one line per item. */
  includes: string[]
  /** Highlighted as «найчастіше обирають» (themes that support it). */
  featured?: boolean
}

/** One step of the «Як ми працюємо» block. */
export interface ProcessStep {
  title: string
  text: string
}

/** One couple's review in the «Відгуки» block. */
export interface Testimonial {
  /** Who wrote it, e.g. «Марта і Богдан». */
  names: string
  text: string
  /** Optional portfolio asset id shown as a small round photo. */
  photoId: string
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
  /** imageId = optional portfolio asset id used as the photographer's portrait. */
  about: { text: string; imageId: string }
  pricing: { items: PricingItem[] }
  /** «Як ми працюємо» — optional; themes render it only when non-empty. */
  process: { steps: ProcessStep[] }
  /** «Відгуки» — optional; themes render it only when non-empty. */
  testimonials: { items: Testimonial[] }
  contact: {
    email: string
    phone: string
    instagram: string
    bookingUrl: string
  }
  /**
   * Chosen cover per portfolio album, keyed by category name → portfolio asset
   * id. Absent → the album falls back to its first photo.
   */
  albumCovers: Record<string, string>
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
    /** Show a booking section wired to the photographer's own booking page. */
    booking: boolean
  }
}

export const EMPTY_CONTENT: SiteContent = {
  hero: { title: '', subtitle: '', imageId: '' },
  about: { text: '', imageId: '' },
  pricing: { items: [] },
  process: { steps: [] },
  testimonials: { items: [] },
  contact: { email: '', phone: '', instagram: '', bookingUrl: '' },
  albumCovers: {},
  translations: {},
  settings: { languages: [], leadForm: false, booking: false },
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
    about: { text: t.about.text || content.about.text, imageId: content.about.imageId },
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
  const processRaw = (v.process ?? {}) as Record<string, unknown>
  const testimonialsRaw = (v.testimonials ?? {}) as Record<string, unknown>

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

  // Album covers: category → asset id (both strings).
  const rawCovers = (
    typeof v.albumCovers === 'object' && v.albumCovers !== null ? v.albumCovers : {}
  ) as Record<string, unknown>
  const albumCovers: Record<string, string> = {}
  for (const [cat, id] of Object.entries(rawCovers)) {
    if (typeof id === 'string' && id) albumCovers[cat] = id
  }

  return {
    hero: {
      title: asString(hero.title),
      subtitle: asString(hero.subtitle),
      imageId: asString(hero.imageId),
    },
    about: { text: asString(about.text), imageId: asString(about.imageId) },
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
          ...(i.featured === true ? { featured: true } : {}),
        }))
        .filter((i) => i.name),
    },
    process: {
      steps: (Array.isArray(processRaw.steps) ? processRaw.steps : [])
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map((i) => ({ title: asString(i.title), text: asString(i.text) }))
        .filter((i) => i.title || i.text),
    },
    testimonials: {
      items: (Array.isArray(testimonialsRaw.items) ? testimonialsRaw.items : [])
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map((i) => ({ names: asString(i.names), text: asString(i.text), photoId: asString(i.photoId) }))
        .filter((i) => i.text),
    },
    contact: {
      email: asString(contact.email),
      phone: asString(contact.phone),
      instagram: asString(contact.instagram),
      bookingUrl: asString(contact.bookingUrl),
    },
    albumCovers,
    translations,
    settings: {
      languages,
      leadForm: settings.leadForm === true,
      booking: settings.booking === true,
    },
  }
}

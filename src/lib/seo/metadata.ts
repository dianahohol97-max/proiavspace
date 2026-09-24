import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/config'
import { BRAND, BRAND_LATIN, OG_LOCALE, isIndexedLocale } from './site'

export interface PageSeo {
  /** Locale the page is rendered in (the URL prefix). */
  locale: Locale
  /** Path WITHOUT the locale prefix: '' for the home page, '/halerei', '/blog/slug'. */
  path: string
  /**
   * Page topic. Inner pages get «{title} — проЯв» (≤ 60 chars in total);
   * pass `absoluteTitle` for the home page, which has its own wording.
   */
  title: string
  absoluteTitle?: boolean
  /** 140–160 characters. */
  description: string
  /**
   * Languages this exact page exists in. Drives hreflang (only when there is
   * more than one) and the canonical: a page rendered in a locale it doesn't
   * exist in (e.g. a Ukrainian article under /en) canonicalizes to the first.
   */
  languages?: readonly Locale[]
  /** Social card. Defaults to the brand card /og.png. */
  image?: { url: string; alt: string; width?: number; height?: number }
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  tags?: string[]
  /** Force noindex,follow (e.g. demo pages about products we don't promote). */
  noindex?: boolean
}

const ROBOTS_INDEX: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
}

const ROBOTS_NOINDEX: Metadata['robots'] = { index: false, follow: true }

export function fullTitle(topic: string, locale: Locale): string {
  return `${topic} — ${locale === 'uk' ? BRAND : BRAND_LATIN}`
}

/**
 * The single place page metadata is built. title / description / canonical /
 * hreflang / Open Graph / Twitter all come from the same input, so twitter:*
 * always mirrors og:* of THIS page (never the home page's copy).
 */
export function buildMetadata(seo: PageSeo): Metadata {
  const languages = seo.languages ?? ['uk']
  // Self-canonical wherever the page genuinely exists in this locale, and in
  // non-indexed locales (they are noindex — pointing a noindex page's
  // canonical elsewhere mixes signals). Only a uk-only page rendered under an
  // indexed foreign locale (/en/blog/…) canonicalizes to its real language.
  const canonicalLocale =
    languages.includes(seo.locale) || !isIndexedLocale(seo.locale) ? seo.locale : languages[0]
  const canonical = `/${canonicalLocale}${seo.path}`
  const title = seo.absoluteTitle ? seo.title : fullTitle(seo.title, seo.locale)
  // A Ukrainian-only page rendered under /en stays indexable and simply
  // canonicalizes to /uk — mixing noindex with a cross-URL canonical sends
  // Google contradictory signals. Non-indexed locales are noindex,follow.
  const indexable = !seo.noindex && isIndexedLocale(seo.locale)

  const alternates: Metadata['alternates'] = { canonical }
  const indexedLanguages = languages.filter(isIndexedLocale)
  // hreflang only from pages that are themselves part of the cluster
  // (annotations must be reciprocal).
  const inCluster = indexable && indexedLanguages.length > 1 && indexedLanguages.includes(canonicalLocale)
  if (inCluster) {
    const map: Record<string, string> = {}
    for (const l of indexedLanguages) map[l] = `/${l}${seo.path}`
    map['x-default'] = `/${indexedLanguages.includes('uk') ? 'uk' : indexedLanguages[0]}${seo.path}`
    alternates.languages = map
  }

  const image = seo.image ?? {
    url: '/og.png',
    alt: seo.locale === 'uk' ? 'проЯв — онлайн-галереї для фотографів' : 'proiav — online client galleries for photographers',
  }
  const ogImage = { width: 1200, height: 630, ...image }

  const alternateLocale =
    inCluster
      ? indexedLanguages.filter((l) => l !== seo.locale).map((l) => OG_LOCALE[l])
      : undefined
  const openGraph: Metadata['openGraph'] = {
    ...(alternateLocale ? { alternateLocale } : {}),
    type: seo.type ?? 'website',
    siteName: BRAND,
    locale: OG_LOCALE[seo.locale] ?? 'uk_UA',
    url: canonical,
    title,
    description: seo.description,
    images: [ogImage],
    ...(seo.type === 'article'
      ? {
          publishedTime: seo.publishedTime,
          modifiedTime: seo.modifiedTime ?? seo.publishedTime,
          tags: seo.tags,
        }
      : {}),
  }
  return {
    title: { absolute: title },
    description: seo.description,
    alternates,
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description: seo.description,
      images: [{ url: ogImage.url, alt: ogImage.alt }],
    },
    robots: indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX,
  }
}

/** Cut long prose to a ≤ 160-char description on a word boundary. */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]+$/, '')}…`
}

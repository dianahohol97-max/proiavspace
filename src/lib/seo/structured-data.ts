/**
 * schema.org builders for the marketing pages. Every page emits one
 * `@graph` with Organization + WebSite (referenced by @id), plus whatever the
 * page itself is: BreadcrumbList, SoftwareApplication, FAQPage, Article.
 *
 * Not used on client galleries / photographer sites: those carry the
 * photographer's identity only (zero-branding principle).
 */
import { GALLERY_PLANS, type GalleryPlanId } from '@/lib/plans'
import { BASE_URL, BRAND, BRAND_LATIN, absoluteUrl } from './site'

export type JsonLdNode = Record<string, unknown>

export const ORG_ID = `${BASE_URL}/#org`
export const SITE_ID = `${BASE_URL}/#website`
export const APP_ID = `${BASE_URL}/#app`

/** Brand profiles (Instagram, Threads, Telegram…), comma-separated in env. */
function sameAs(): string[] {
  return (process.env.NEXT_PUBLIC_SOCIAL_LINKS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function organizationNode(): JsonLdNode {
  const links = sameAs()
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND,
    alternateName: ['прояв', 'Прояв', BRAND_LATIN, 'proiav.space'],
    url: `${BASE_URL}/uk`,
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
    ...(links.length ? { sameAs: links } : {}),
  }
}

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: BRAND,
    alternateName: BRAND_LATIN,
    url: `${BASE_URL}/uk`,
    inLanguage: ['uk', 'en'],
    publisher: { '@id': ORG_ID },
  }
}

export interface Crumb {
  name: string
  /** Path with locale (`/uk/halerei`). */
  path: string
}

export function breadcrumbNode(crumbs: Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  }
}

export function softwareApplicationNode(opts: {
  description: string
  url: string
  planNames: Record<GalleryPlanId, string>
}): JsonLdNode {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: BRAND,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Client photo gallery',
    operatingSystem: 'Web',
    url: absoluteUrl(opts.url),
    description: opts.description,
    publisher: { '@id': ORG_ID },
    offers: (Object.keys(GALLERY_PLANS) as GalleryPlanId[]).map((id) => ({
      '@type': 'Offer',
      name: opts.planNames[id],
      price: GALLERY_PLANS[id].priceUahMonth,
      priceCurrency: 'UAH',
      ...(GALLERY_PLANS[id].priceUahMonth > 0
        ? {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: GALLERY_PLANS[id].priceUahMonth,
              priceCurrency: 'UAH',
              unitCode: 'MON',
              referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
            },
          }
        : {}),
      url: absoluteUrl(opts.url),
    })),
  }
}

export function faqNode(items: { q: string; a: string }[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}

export function articleNode(opts: {
  path: string
  title: string
  description: string
  datePublished: string
  dateModified: string
  image: string
  tags: string[]
  author?: { name: string; url?: string }
}): JsonLdNode {
  const url = absoluteUrl(opts.path)
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: opts.title,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    inLanguage: 'uk',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: absoluteUrl(opts.image),
    keywords: opts.tags.join(', '),
    author: opts.author
      ? { '@type': 'Person', name: opts.author.name, ...(opts.author.url ? { url: opts.author.url } : {}) }
      : { '@type': 'Organization', name: `Команда ${BRAND}`, url: `${BASE_URL}/uk` },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** Wrap page nodes into one graph, always led by Organization + WebSite. */
export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': [organizationNode(), websiteNode(), ...nodes] }
}

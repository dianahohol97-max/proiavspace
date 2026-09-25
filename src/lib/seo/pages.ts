import type { Locale } from '@/lib/i18n/config'
import { AUTHORS } from '@/lib/blog/authors'
import { PRODUCT_PAGES, productPageLanguages } from '@/lib/landing/product-pages'

/**
 * Registry of static marketing pages: the sitemap, breadcrumbs and the
 * dynamic OG cards all read from here, so a new page is one entry.
 */
export interface MarketingPage {
  id: string
  /** Path without locale. */
  path: string
  /** Languages the page exists in (first = canonical fallback). */
  languages: readonly Locale[]
  /** Short name for breadcrumbs (uk). */
  crumb: string
  /** Headline for the generated share card (uk). */
  ogTitle: string
  /** Small label above the headline on the share card. */
  ogKicker: string
  priority: number
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Hidden from the sitemap (still reachable). */
  unlisted?: boolean
}

const STATIC_PAGES: MarketingPage[] = [
  {
    id: 'home',
    path: '',
    languages: ['uk', 'en'],
    crumb: 'Головна',
    ogTitle: 'Онлайн-галерея для фотографа',
    ogKicker: 'Усе, що стається після зйомки',
    priority: 1,
    changeFrequency: 'weekly',
  },
  {
    id: 'gallery-demo',
    path: '/gallery-demo',
    languages: ['uk', 'en'],
    crumb: 'Демо галереї',
    ogTitle: 'Демо клієнтської галереї',
    ogKicker: 'Подивіться очима клієнта',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    id: 'blog',
    path: '/blog',
    languages: ['uk'],
    crumb: 'Блог',
    ogTitle: 'Блог для фотографів',
    ogKicker: 'Журнал проЯв',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    id: 'oferta',
    path: '/oferta',
    languages: ['uk', 'en'],
    crumb: 'Публічна оферта',
    ogTitle: 'Публічна оферта',
    ogKicker: 'Документи',
    priority: 0.2,
    changeFrequency: 'yearly',
  },
  {
    id: 'privacy',
    path: '/privacy',
    languages: ['uk', 'en'],
    crumb: 'Політика конфіденційності',
    ogTitle: 'Політика конфіденційності',
    ogKicker: 'Документи',
    priority: 0.2,
    changeFrequency: 'yearly',
  },
]

/** Product & comparison pages (drafts are unlisted). */
const PRODUCT_ENTRIES: MarketingPage[] = PRODUCT_PAGES.map((p) => ({
  id: p.id,
  path: p.path,
  languages: productPageLanguages(p),
  crumb: p.crumb,
  ogTitle: p.ogTitle ?? p.h1,
  ogKicker: p.kicker,
  priority: p.id === 'halerei' ? 0.9 : p.id === 'tsiny' ? 0.8 : 0.7,
  changeFrequency: 'monthly',
  unlisted: p.draft,
}))

/** Blog author pages. */
const AUTHOR_ENTRIES: MarketingPage[] = AUTHORS.map((a) => ({
  id: `autor-${a.slug}`,
  path: `/autor/${a.slug}`,
  languages: ['uk'],
  crumb: a.name,
  ogTitle: a.name,
  ogKicker: 'Авторка блогу проЯв',
  priority: 0.4,
  changeFrequency: 'monthly',
}))

export const MARKETING_PAGES: MarketingPage[] = [...STATIC_PAGES, ...PRODUCT_ENTRIES, ...AUTHOR_ENTRIES]

export function getMarketingPage(id: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((p) => p.id === id)
}

/** The site-wide brand share card (home page, fallbacks). */
export function brandOgImage(locale: string): string {
  return ogImagePath(locale === 'uk' ? 'page.home' : 'page.home-en')
}

/** Generated share card for a registry page. */
export function ogImagePath(key: string): string {
  return `/og/${key}.png`
}

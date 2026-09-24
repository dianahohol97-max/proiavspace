import type { Locale } from '@/lib/i18n/config'

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

export const MARKETING_PAGES: MarketingPage[] = [
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

export function getMarketingPage(id: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((p) => p.id === id)
}

/** Generated share card for a registry page. */
export function ogImagePath(key: string): string {
  return `/og/${key}.png`
}

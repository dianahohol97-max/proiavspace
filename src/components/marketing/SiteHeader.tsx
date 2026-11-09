import { primaryNav } from '@/lib/seo/nav'
import { getDictionary } from '@/lib/i18n'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { getLandingCopy } from '@/lib/landing/copy'
import { MarketingHeader, type MarketingHeaderLabels } from './MarketingHeader'

/** Labels of the shared marketing header, in the page's language. */
export async function marketingHeaderLabels(locale: Locale): Promise<MarketingHeaderLabels> {
  const { pages } = await getDictionary(locale)
  const { nav } = getLandingCopy(locale)
  return {
    signIn: nav.signIn,
    ctaShort: nav.ctaShort,
    dashboard: nav.dashboard,
    homeAria: pages.homeAria,
    mainNavAria: pages.mainNavAria,
    menuOpen: pages.menuOpen,
    menuClose: pages.menuClose,
    language: pages.languageAria,
  }
}

/** Header for inner marketing pages (pricing, blog, help, product pages) — the landing's header. */
export async function SiteHeader({ locale: requested, current }: { locale: string; current?: string }) {
  const locale: Locale = isLocale(requested) ? requested : 'uk'
  return (
    <MarketingHeader
      locale={locale}
      links={primaryNav(locale)}
      labels={await marketingHeaderLabels(locale)}
      current={current}
      // Inner pages sit in max-w-5xl columns.
      maxWidth={1024}
    />
  )
}

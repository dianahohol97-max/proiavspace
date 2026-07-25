import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale, localeLabels, type Locale } from '@/lib/i18n/config'
import { jsonLdScript } from '@/lib/jsonld'
import { localizedSiteContent, parseSiteContent } from '@/lib/site/content'
import { isThemeId } from '@/lib/site/themes'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SiteRenderer, type PortfolioItem } from '@/components/site/SiteRenderer'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface SiteRow {
  theme: string
  mode: string
  content: unknown
  display_name: string | null
  logo_key: string | null
}

interface PortfolioRow {
  id: string
  preview_key: string | null
  category: string | null
  caption: string | null
}

/**
 * Photographer sites ARE meant to rank (unlike client galleries): the title
 * and description come from the photographer's own content, and — true to
 * the zero-branding principle — the platform's title template is escaped
 * with an absolute title, so «проЯв» never appears in their tab or snippet.
 */
export async function generateMetadata({
  params,
}: {
  params: { locale: string; handle: string }
}): Promise<Metadata> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.rpc('get_site', { p_handle: params.handle })
  const site = (data as SiteRow[] | null)?.[0]
  if (!site) return { robots: { index: false, follow: false } }

  const raw = parseSiteContent(site.content)
  const content = localizedSiteContent(raw, params.locale)
  const title = content.hero.title || site.display_name || params.handle
  const description =
    (content.about.text || content.hero.subtitle || title).replace(/\s+/g, ' ').slice(0, 160)

  // hreflang: every language this site is offered in points at the same page in
  // its locale, so Google clusters the translations instead of reading them as
  // duplicate content. Ukrainian is the base and the x-default.
  const siteLocales = ['uk', ...raw.settings.languages].filter(isLocale)
  const languages: Record<string, string> = { 'x-default': `/uk/s/${params.handle}` }
  for (const l of siteLocales) languages[l] = `/${l}/s/${params.handle}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${params.locale}/s/${params.handle}`, languages },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/${params.locale}/s/${params.handle}`,
      locale: ogLocale(params.locale),
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  }
}

/** BCP-47-ish locale for Open Graph (`og:locale` wants language_TERRITORY). */
function ogLocale(locale: string): string {
  const map: Record<string, string> = {
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
  return map[locale] ?? 'uk_UA'
}

/**
 * Published photographer site. Everything on this page belongs to the
 * photographer's brand — the platform is invisible. Data comes through
 * security-definer RPCs; media through short-lived presigned R2 URLs.
 */
export default async function PublicSitePage({
  params,
}: {
  params: { locale: string; handle: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const [{ data: siteData }, { data: portfolioData }] = await Promise.all([
    supabase.rpc('get_site', { p_handle: params.handle }),
    supabase.rpc('get_site_portfolio', { p_handle: params.handle }),
  ])

  const site = (siteData as SiteRow[] | null)?.[0]
  if (!site || !isThemeId(site.theme)) notFound()

  const storage = getStorage()
  const logoUrl = site.logo_key
    ? await storage.getSignedReadUrl(site.logo_key, { expiresInSeconds: 60 * 60 })
    : null

  const portfolio: PortfolioItem[] = await Promise.all(
    ((portfolioData as PortfolioRow[] | null) ?? []).map(async (row) => ({
      id: row.id,
      previewUrl: row.preview_key
        ? await storage.getSignedReadUrl(row.preview_key, { expiresInSeconds: 60 * 60 })
        : null,
      category: row.category,
      caption: row.caption,
    }))
  )

  // Structured data for the PHOTOGRAPHER (their business, not ours). A richer
  // ProfessionalService node earns better rich-result eligibility: stable @id,
  // canonical url, offer catalogue from real prices, service area and language.
  const rawContent = parseSiteContent(site.content)
  const content = localizedSiteContent(rawContent, locale)
  const siteUrl = `${BASE_URL}/${locale}/s/${params.handle}`
  const prices = rawContent.pricing.items
    .map((i) => Number(i.price.replace(/[^\d]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${siteUrl}#business`,
    name: site.display_name ?? content.hero.title,
    url: siteUrl,
    description: content.about.text || content.hero.subtitle || undefined,
    email: content.contact.email || undefined,
    telephone: content.contact.phone || undefined,
    priceRange: prices.length ? `${Math.min(...prices)}–${Math.max(...prices)} UAH` : undefined,
    inLanguage: ['uk', ...rawContent.settings.languages].filter(isLocale),
    makesOffer: rawContent.pricing.items.length
      ? rawContent.pricing.items.map((i) => ({
          '@type': 'Offer',
          name: i.name,
          ...(Number(i.price.replace(/[^\d]/g, '')) > 0
            ? {
                price: Number(i.price.replace(/[^\d]/g, '')),
                priceCurrency: 'UAH',
              }
            : {}),
        }))
      : undefined,
    sameAs: content.contact.instagram
      ? [`https://instagram.com/${content.contact.instagram.replace(/^@/, '')}`]
      : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <SiteRenderer
        theme={site.theme}
        mode={site.mode === 'night' ? 'night' : 'light'}
        content={content}
        displayName={site.display_name}
        logoUrl={logoUrl}
        portfolio={portfolio}
        footer={{
          brand: site.display_name ?? (content.hero.title || params.handle),
          year: new Date().getFullYear(),
          links: [
            {
              href: `/${locale}/s/${params.handle}/legal/privacy`,
              label: locale === 'uk' ? 'Конфіденційність' : 'Privacy',
            },
            {
              href: `/${locale}/s/${params.handle}/legal/refund`,
              label: locale === 'uk' ? 'Оплата та повернення' : 'Payment & refunds',
            },
          ],
        }}
        labels={{
          portfolio: dict.publicSite.portfolio,
          about: dict.publicSite.about,
          pricing: dict.publicSite.pricing,
          contacts: dict.publicSite.contacts,
          book: dict.publicSite.book,
          photos: locale === 'uk' ? 'фото' : 'photos',
          viewSeries: locale === 'uk' ? 'Дивитись серію' : 'View series',
          close: locale === 'uk' ? 'Закрити' : 'Close',
        }}
        langSwitch={
          rawContent.settings.languages.length > 0
            ? {
                options: ['uk', ...rawContent.settings.languages]
                  .filter((l): l is Locale => isLocale(l))
                  .map((l) => ({
                    locale: l,
                    href: `/${l}/s/${params.handle}`,
                    label: localeLabels[l],
                    current: l === locale,
                  })),
              }
            : undefined
        }
        leadForm={
          rawContent.settings.leadForm
            ? {
                handle: params.handle,
                labels: {
                  title: dict.publicSite.leadTitle,
                  name: dict.publicSite.leadName,
                  contact: dict.publicSite.leadContact,
                  message: dict.publicSite.leadMessage,
                  send: dict.publicSite.leadSend,
                  sent: dict.publicSite.leadSent,
                  error: dict.publicSite.leadError,
                },
              }
            : undefined
        }
      />
    </>
  )
}

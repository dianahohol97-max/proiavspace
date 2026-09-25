import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Block } from '@/lib/blog/articles'
import { getNbuUsdRate, hasFxMarkers, renderFx, type NbuRate } from '@/lib/fx/nbu'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { getProductPage, productPageLanguages, type ProductPageContent } from '@/lib/landing/product-pages'
import { GALLERY_PLANS } from '@/lib/plans'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { brandOgImage, ogImagePath } from '@/lib/seo/pages'
import { BRAND, BRAND_LATIN, absoluteUrl } from '@/lib/seo/site'
import { SITE_ID, faqNode, graph, softwareApplicationNode, type Crumb } from '@/lib/seo/structured-data'
import { ArticleBody, RichText, stripLinks } from '@/components/blog/ArticleBody'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

/**
 * Product / comparison landing pages. Content lives in
 * src/lib/landing/product-pages.ts; this renders it with the shared header,
 * breadcrumbs, FAQ (+ FAQPage schema) and CTA. Ukrainian only, unless a page
 * lists more `languages` (with their copy in `translations`) — other locales 404.
 */
function resolve(id: string, locale: string): { page: ProductPageContent; locale: Locale } | null {
  const base = getProductPage(id)
  if (!base || !isLocale(locale) || !productPageLanguages(base).includes(locale)) return null
  const page = getProductPage(id, locale)
  return page ? { page, locale } : null
}

export function productPageMetadata(id: string, locale: string): Metadata {
  const found = resolve(id, locale)
  if (!found) return { robots: { index: false, follow: false } }
  const { page } = found
  return buildMetadata({
    locale: found.locale,
    path: page.path,
    languages: productPageLanguages(page),
    title: page.seoTitle,
    absoluteTitle: page.seoTitle.includes(BRAND) || page.seoTitle.includes(BRAND_LATIN),
    description: page.description,
    // Generated share cards are Ukrainian; other languages get the brand card.
    image:
      found.locale === 'uk'
        ? { url: ogImagePath(`page.${page.id}`), alt: page.h1 }
        : { url: brandOgImage(found.locale), alt: page.h1 },
    // Pages with unconfirmed facts ([УТОЧНИТИ]) stay out of the index.
    noindex: page.draft,
  })
}

function crumbs(page: ProductPageContent, locale: Locale): Crumb[] {
  return [
    { name: locale === 'uk' ? BRAND : BRAND_LATIN, path: `/${locale}` },
    ...(page.parent ? [page.parent] : []),
    { name: page.crumb, path: `/${locale}${page.path}` },
  ]
}

/** Fill {{price:…}} / {{fx-source}} markers; paragraphs left empty are dropped. */
function withFx(blocks: Block[], rate: NbuRate | null, locale: string): Block[] {
  const fx = (text: string) => renderFx(text, rate, locale).trim()
  return blocks.flatMap((block): Block[] => {
    switch (block.type) {
      case 'p': {
        const text = fx(block.text)
        return text ? [{ ...block, text }] : []
      }
      case 'ul':
      case 'ol':
        return [{ ...block, items: block.items.map(fx) }]
      case 'table':
        return [{ ...block, caption: block.caption && fx(block.caption), rows: block.rows.map((row) => row.map(fx)) }]
      case 'faq':
        return [{ ...block, items: block.items.map((item) => ({ q: fx(item.q), a: fx(item.a) })) }]
      default:
        return [block]
    }
  })
}

const UI = {
  uk: {
    start: 'Почати безкоштовно',
    demo: 'Подивитися демо галереї',
    note: `${GALLERY_PLANS.free.storageGb} ГБ безкоштовно назавжди. Без картки при реєстрації.`,
    related: 'Ще по темі',
    closingTitle: 'Наступну зйомку віддайте клієнту красиво',
    closingText: 'Створіть першу галерею за кілька хвилин — безкоштовно й без картки.',
    closingCta: 'Створити галерею',
  },
  en: {
    start: 'Start for free',
    demo: 'See the gallery demo',
    note: `${GALLERY_PLANS.free.storageGb} GB free forever. No card needed to sign up.`,
    related: 'Related',
    closingTitle: 'Deliver your next shoot beautifully',
    closingText: 'Create your first gallery in a few minutes, free and without a card.',
    closingCta: 'Create a gallery',
  },
}

export async function ProductPage({ id, locale: requested }: { id: string; locale: string }) {
  const found = resolve(id, requested)
  if (!found) notFound()
  const { page, locale } = found
  const ui = locale === 'uk' ? UI.uk : UI.en
  preloadBrandFonts(locale)

  const blocks: Block[] = [...page.body, ...(page.faq.length ? [{ type: 'faq' as const, items: page.faq }] : [])]
  // Only pages quoting dollar prices ask the NBU for the day's rate.
  const needsFx = hasFxMarkers(JSON.stringify(blocks))
  const body = needsFx ? withFx(blocks, await getNbuUsdRate(), locale) : blocks

  const path = `/${locale}${page.path}`
  const url = absoluteUrl(path)
  const nodes = [
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: page.h1,
      description: page.description,
      inLanguage: locale,
      isPartOf: { '@id': SITE_ID },
      ...(page.dateModified ? { dateModified: page.dateModified } : {}),
    },
    ...(page.faq.length ? [faqNode(page.faq.map((f) => ({ q: f.q, a: stripLinks(f.a) })))] : []),
    ...(page.withOffers ? [softwareApplicationNode({ description: page.description, url: path, planNames: PLAN_NAMES })] : []),
  ]

  return (
    <main className="min-h-screen">
      <JsonLd data={graph(...nodes)} />
      <SiteHeader locale={locale} current={path} />
      <Breadcrumbs items={crumbs(page, locale)} label={locale === 'uk' ? undefined : 'Breadcrumbs'} />

      <header className="mx-auto max-w-5xl px-6 pb-6 pt-10 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{page.kicker}</p>
        <h1 className="mt-4 max-w-4xl font-brand text-4xl leading-[1.05] tracking-tight sm:text-6xl">{page.h1}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          <RichText text={page.lede} />
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={`/${locale}/login`}
            className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {page.cta ?? ui.start} →
          </Link>
          <Link
            href={page.secondary?.href ?? `/${locale}/gallery-demo`}
            className="rounded-full border border-line px-7 py-3 text-sm font-bold text-fg no-underline transition-colors hover:border-fg"
          >
            {page.secondary?.label ?? ui.demo}
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">{ui.note}</p>
      </header>

      <div className="mx-auto max-w-[760px] px-6 pb-8">
        <ArticleBody blocks={body} locale={locale} />
      </div>

      {page.related.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="mb-6 font-brand text-2xl">{ui.related}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {page.related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-line bg-[#fbfbf8] p-5 font-semibold leading-snug text-fg no-underline transition-colors hover:border-accent-soft hover:text-accent"
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-line bg-[#eef1ff]">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-brand text-2xl sm:text-3xl">{ui.closingTitle}</h2>
            <p className="mt-2 max-w-md text-muted">{ui.closingText}</p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="shrink-0 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {ui.closingCta}
          </Link>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  )
}

const PLAN_NAMES = { free: 'Безкоштовний', basic: 'Базовий', plus: 'Плюс', pro: 'Максимальний' }

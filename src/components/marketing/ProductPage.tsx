import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { getProductPage, type ProductPageContent } from '@/lib/landing/product-pages'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { absoluteUrl } from '@/lib/seo/site'
import { SITE_ID, faqNode, graph, softwareApplicationNode, type Crumb } from '@/lib/seo/structured-data'
import { ArticleBody, RichText, stripLinks } from '@/components/blog/ArticleBody'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

/**
 * Ukrainian product / comparison landing pages. Content lives in
 * src/lib/landing/product-pages.ts; this renders it with the shared header,
 * breadcrumbs, FAQ (+ FAQPage schema) and CTA. Ukrainian only — other locales 404.
 */
export function productPageMetadata(id: string, locale: string): Metadata {
  const page = getProductPage(id)
  if (!page || locale !== 'uk') return { robots: { index: false, follow: false } }
  return buildMetadata({
    locale: 'uk',
    path: page.path,
    languages: ['uk'],
    title: page.seoTitle,
    absoluteTitle: page.seoTitle.includes('проЯв'),
    description: page.description,
    image: { url: ogImagePath(`page.${page.id}`), alt: page.h1 },
    // Pages with unconfirmed facts ([УТОЧНИТИ]) stay out of the index.
    noindex: page.draft,
  })
}

function crumbs(page: ProductPageContent): Crumb[] {
  return [{ name: 'проЯв', path: '/uk' }, ...(page.parent ? [page.parent] : []), { name: page.crumb, path: `/uk${page.path}` }]
}

export function ProductPage({ id, locale }: { id: string; locale: string }) {
  if (!isLocale(locale) || locale !== 'uk') notFound()
  const page = getProductPage(id)
  if (!page) notFound()
  preloadBrandFonts(locale)

  const url = absoluteUrl(`/uk${page.path}`)
  const nodes = [
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: page.h1,
      description: page.description,
      inLanguage: 'uk',
      isPartOf: { '@id': SITE_ID },
      ...(page.dateModified ? { dateModified: page.dateModified } : {}),
    },
    ...(page.faq.length ? [faqNode(page.faq.map((f) => ({ q: f.q, a: stripLinks(f.a) })))] : []),
    ...(page.withOffers ? [softwareApplicationNode({ description: page.description, url: `/uk${page.path}`, planNames: PLAN_NAMES })] : []),
  ]

  return (
    <main className="min-h-screen">
      <JsonLd data={graph(...nodes)} />
      <SiteHeader locale={locale} current={`/uk${page.path}`} />
      <Breadcrumbs items={crumbs(page)} />

      <header className="mx-auto max-w-5xl px-6 pb-6 pt-10 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{page.kicker}</p>
        <h1 className="mt-4 max-w-4xl font-brand text-4xl leading-[1.05] tracking-tight sm:text-6xl">{page.h1}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          <RichText text={page.lede} />
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/uk/login"
            className="rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {page.cta ?? 'Почати безкоштовно'} →
          </Link>
          <Link
            href={page.secondary?.href ?? '/uk/gallery-demo'}
            className="rounded-full border border-line px-7 py-3 text-sm font-bold text-fg no-underline transition-colors hover:border-fg"
          >
            {page.secondary?.label ?? 'Подивитися демо галереї'}
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">3 ГБ безкоштовно назавжди. Без картки при реєстрації.</p>
      </header>

      <div className="mx-auto max-w-[760px] px-6 pb-8">
        <ArticleBody blocks={[...page.body, ...(page.faq.length ? [{ type: 'faq' as const, items: page.faq }] : [])]} locale={locale} />
      </div>

      {page.related.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="mb-6 font-brand text-2xl">Ще по темі</h2>
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
            <h2 className="font-brand text-2xl sm:text-3xl">Наступну зйомку віддайте клієнту красиво</h2>
            <p className="mt-2 max-w-md text-muted">Створіть першу галерею за кілька хвилин — безкоштовно й без картки.</p>
          </div>
          <Link
            href="/uk/login"
            className="shrink-0 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            Створити галерею
          </Link>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  )
}

const PLAN_NAMES = { free: 'Безкоштовний', basic: 'Базовий', plus: 'Плюс', pro: 'Максимальний' }

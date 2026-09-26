import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getArticles } from '@/lib/blog/articles'
import { CATEGORIES, articlesIn, getCategory } from '@/lib/blog/categories'
import { isLocale } from '@/lib/i18n/config'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { absoluteUrl } from '@/lib/seo/site'
import { graph } from '@/lib/seo/structured-data'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string; topic: string } }): Metadata {
  const category = getCategory(params.topic)
  if (!category || !isLocale(params.locale)) return { robots: { index: false, follow: false } }
  return buildMetadata({
    locale: params.locale,
    path: `/blog/tema/${category.slug}`,
    languages: ['uk'],
    title: category.title,
    description: category.description,
    image: { url: ogImagePath(`tema.${category.slug}`), alt: category.title },
  })
}

function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Blog topic hub: an indexable page per theme, listing its articles. */
export default async function BlogTopicPage({ params }: { params: { locale: string; topic: string } }) {
  if (!isLocale(params.locale)) notFound()
  // Ukrainian-only content: other locales would serve it under the wrong
  // <html lang> as an indexable duplicate, so they go to the /uk copy.
  if (params.locale !== 'uk') permanentRedirect(`/uk/blog/tema/${params.topic}`)
  const category = getCategory(params.topic)
  if (!category) notFound()
  const locale = params.locale
  const articles = articlesIn(category, await getArticles())
  if (articles.length === 0) notFound()
  preloadBrandFonts(locale)

  const path = `/uk/blog/tema/${category.slug}`
  const jsonLd = graph({
    '@type': 'CollectionPage',
    '@id': `${absoluteUrl(path)}#page`,
    name: category.title,
    description: category.description,
    url: absoluteUrl(path),
    inLanguage: 'uk',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(`/uk/blog/${a.slug}`),
        name: a.title,
      })),
    },
  })

  return (
    <main className="min-h-screen">
      <JsonLd data={jsonLd} />
      <SiteHeader locale={locale} current={`/${locale}/blog`} />
      <Breadcrumbs
        items={[
          { name: 'проЯв', path: `/${locale}` },
          { name: 'Блог', path: `/${locale}/blog` },
          { name: category.name, path: `/${locale}/blog/tema/${category.slug}` },
        ]}
      />
      <section className="mx-auto max-w-5xl px-6 pb-4 pt-10 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Тема блогу</p>
        <h1 className="mt-4 max-w-3xl font-brand text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {category.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{category.intro}</p>
        <nav aria-label="Інші теми" className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.slug !== category.slug).map((c) => (
            <Link
              key={c.slug}
              href={`/uk/blog/tema/${c.slug}`}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-fg no-underline transition-colors hover:border-accent hover:text-accent"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </section>
      <div className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 pt-10 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/${locale}/blog/${article.slug}`}
            className="group flex flex-col rounded-2xl border border-line bg-[#fbfbf8] p-6 no-underline transition-all hover:-translate-y-0.5 hover:border-accent-soft"
          >
            <h2 className="font-brand text-xl leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
              {article.title}
            </h2>
            <p className="mt-3 line-clamp-3 flex-1 leading-relaxed text-muted">{article.description}</p>
            <p className="mt-5 text-xs uppercase tracking-widest text-muted">
              {fmtDate(article.updated ?? article.date)} · {article.readingMinutes} хв
            </p>
          </Link>
        ))}
      </div>
      <SiteFooter locale={locale} />
    </main>
  )
}

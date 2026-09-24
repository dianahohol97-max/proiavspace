import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { articleFaq, getArticle, getArticles } from '@/lib/blog/articles'
import { categoriesFor, relatedArticles } from '@/lib/blog/categories'
import { isLocale } from '@/lib/i18n/config'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { articleNode, faqNode, graph } from '@/lib/seo/structured-data'
import { ArticleBody, stripLinks } from '@/components/blog/ArticleBody'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string }
}): Promise<Metadata> {
  const article = await getArticle(params.slug)
  if (!article || !isLocale(params.locale)) return { robots: { index: false, follow: false } }
  return buildMetadata({
    locale: params.locale,
    path: `/blog/${article.slug}`,
    // Content is Ukrainian — other locales canonicalize to the /uk copy.
    languages: ['uk'],
    // H1s can be long; seoTitle is the ≤ 60-char <title>. Without one, the
    // brand suffix is added only when it still fits.
    title: article.seoTitle ?? (article.title.length > 50 ? article.title : `${article.title} — проЯв`),
    absoluteTitle: true,
    description: article.description,
    type: 'article',
    publishedTime: article.date,
    modifiedTime: article.updated ?? article.date,
    tags: article.tags,
    image: { url: ogImagePath(`blog.${article.slug}`), alt: article.title },
  })
}

function fmtDate(date: string, uk: boolean): string {
  return new Date(date).toLocaleDateString(uk ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ArticlePage({
  params,
}: {
  params: { locale: string; slug: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const uk = locale === 'uk'
  const article = await getArticle(params.slug)
  if (!article) notFound()
  preloadBrandFonts(locale)

  const all = await getArticles()
  const more = relatedArticles(article, all, 3)
  const topics = categoriesFor(article)
  const faq = articleFaq(article)
  const modified = article.updated ?? article.date

  const path = `/uk/blog/${article.slug}`
  const jsonLd = graph(
    articleNode({
      path,
      title: article.title,
      description: article.description,
      datePublished: article.date,
      dateModified: modified,
      image: ogImagePath(`blog.${article.slug}`),
      tags: article.tags,
    }),
    ...(faq.length ? [faqNode(faq.map((f) => ({ q: f.q, a: stripLinks(f.a) })))] : [])
  )

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="min-h-screen">
        <SiteHeader locale={locale} current={`/${locale}/blog`} />
        <Breadcrumbs
          items={[
            { name: 'проЯв', path: `/${locale}` },
            { name: 'Блог', path: `/${locale}/blog` },
            ...(topics[0] ? [{ name: topics[0].name, path: `/uk/blog/tema/${topics[0].slug}` }] : []),
            { name: article.title, path: `/${locale}/blog/${article.slug}` },
          ]}
        />

        {/* --- article header --- */}
        <article className="mx-auto max-w-[720px] px-6 pb-10 pt-8 sm:pt-14">
          {topics.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/uk/blog/tema/${topic.slug}`}
                  className="rounded-full bg-[#eceada] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted no-underline hover:text-fg"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          )}
          <h1 className="font-brand text-3xl leading-[1.1] tracking-tight sm:text-5xl">{article.title}</h1>
          <p className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            {modified !== article.date ? (
              <>
                <span>
                  {uk ? 'Оновлено ' : 'Updated '}
                  <time dateTime={modified}>{fmtDate(modified, uk)}</time>
                </span>
                <span className="h-1 w-1 rounded-full bg-muted" />
                <span>
                  {uk ? 'Опубліковано ' : 'Published '}
                  <time dateTime={article.date}>{fmtDate(article.date, uk)}</time>
                </span>
              </>
            ) : (
              <time dateTime={article.date}>{fmtDate(article.date, uk)}</time>
            )}
            <span className="h-1 w-1 rounded-full bg-muted" />
            <span>
              {article.readingMinutes} {uk ? 'хв читання' : 'min read'}
            </span>
          </p>

          <div className="mt-8 h-px w-full bg-line" />

          <ArticleBody blocks={article.body} locale={locale} />
        </article>

        {/* --- read next (by shared tags) --- */}
        {more.length > 0 && (
          <section className="border-t border-line">
            <div className="mx-auto max-w-5xl px-6 py-16">
              <h2 className="mb-8 font-brand text-2xl">{uk ? 'Читати далі' : 'Read next'}</h2>
              <div className="grid gap-6 sm:grid-cols-3">
                {more.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/${locale}/blog/${a.slug}`}
                    className="group flex flex-col rounded-2xl border border-line bg-[#fbfbf8] p-6 no-underline transition-all hover:-translate-y-0.5 hover:border-accent-soft"
                  >
                    <h3 className="font-brand text-lg leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
                      {a.title}
                    </h3>
                    <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{a.description}</p>
                    <p className="mt-4 text-xs uppercase tracking-widest text-muted">
                      {a.readingMinutes} {uk ? 'хв' : 'min'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
        <SiteFooter locale={locale} />
      </main>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticle, getArticles } from '@/lib/blog/articles'
import { isLocale } from '@/lib/i18n/config'
import { jsonLdScript } from '@/lib/jsonld'
import { ArticleBody } from '@/components/blog/ArticleBody'
import { Logo } from '@/components/Logo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string }
}): Promise<Metadata> {
  const article = await getArticle(params.slug)
  if (!article) return { robots: { index: false, follow: false } }
  return {
    title: article.title,
    description: article.description,
    // Content is Ukrainian — consolidate ranking on the /uk copy.
    alternates: { canonical: `/uk/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url: `/${params.locale}/blog/${article.slug}`,
      publishedTime: article.date,
    },
  }
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

  // A few more to read next (exclude the current one).
  const more = (await getArticles()).filter((a) => a.slug !== article.slug).slice(0, 3)

  const url = `${BASE_URL}/uk/blog/${article.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: 'uk',
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'проЯв' },
    publisher: { '@type': 'Organization', name: 'проЯв' },
  }

  const dateLine = new Date(article.date).toLocaleDateString(uk ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <main className="min-h-screen">
        {/* --- brand bar --- */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href={`/${locale}`} className="text-fg no-underline">
            <Logo />
          </Link>
          <Link
            href={`/${locale}/blog`}
            className="text-sm text-muted no-underline transition-colors hover:text-fg"
          >
            {uk ? 'Усі поради →' : 'All guides →'}
          </Link>
        </header>

        {/* --- article header --- */}
        <article className="mx-auto max-w-[720px] px-6 pb-10 pt-8 sm:pt-14">
          {article.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {article.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#eceada] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-brand text-3xl leading-[1.1] tracking-tight sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-6 flex items-center gap-3 text-sm text-muted">
            <span>{dateLine}</span>
            <span className="h-1 w-1 rounded-full bg-muted" />
            <span>
              {article.readingMinutes} {uk ? 'хв читання' : 'min read'}
            </span>
          </p>

          <div className="mt-8 h-px w-full bg-line" />

          <ArticleBody blocks={article.body} locale={locale} />
        </article>

        {/* --- read next --- */}
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
                    <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                      {a.description}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-widest text-muted">
                      {a.readingMinutes} {uk ? 'хв' : 'min'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  )
}

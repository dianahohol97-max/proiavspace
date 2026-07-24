import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticle } from '@/lib/blog/articles'
import { isLocale } from '@/lib/i18n/config'
import { jsonLdScript } from '@/lib/jsonld'
import { ArticleBody } from '@/components/blog/ArticleBody'

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link href={`/${locale}/blog`} className="text-sm text-muted hover:text-fg">
          {uk ? '← Усі статті' : '← All articles'}
        </Link>

        <p className="mt-6 text-xs uppercase tracking-widest text-muted">
          {new Date(article.date).toLocaleDateString(uk ? 'uk-UA' : 'en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · {article.readingMinutes} {uk ? 'хв читання' : 'min read'}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight">{article.title}</h1>

        <ArticleBody blocks={article.body} locale={locale} />

        <div className="mt-16 border-t border-line pt-8">
          <Link href={`/${locale}/blog`} className="text-sm text-accent underline">
            {uk ? '← Більше статей у блозі' : '← More articles'}
          </Link>
        </div>
      </main>
    </>
  )
}

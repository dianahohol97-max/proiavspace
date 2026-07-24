import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticles } from '@/lib/blog/articles'
import { isLocale } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const uk = params.locale === 'uk'
  const title = uk ? 'Блог для фотографів — проЯв' : 'Blog for photographers — proiav'
  const description = uk
    ? 'Практичні поради: як передати фото клієнту, обрати галерею, зробити сайт і приймати оплату. Для фотографів.'
    : 'Practical guides for photographers: delivering photos, choosing a gallery, building a site, taking payments.'
  return {
    title,
    description,
    alternates: { canonical: `/${params.locale}/blog` },
    openGraph: { type: 'website', title, description, url: `/${params.locale}/blog` },
  }
}

export default async function BlogHubPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const uk = locale === 'uk'
  const articles = await getArticles()

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/${locale}`} className="text-sm text-muted hover:text-fg">
        {uk ? '← На головну' : '← Home'}
      </Link>
      <h1 className="mt-6 font-display text-4xl">{uk ? 'Блог' : 'Blog'}</h1>
      <p className="mt-3 leading-relaxed text-muted">
        {uk
          ? 'Поради для фотографів: як передавати зйомки, продавати, будувати особистий бренд.'
          : 'Guides for photographers: delivering shoots, selling, building a personal brand.'}
      </p>

      {articles.length === 0 ? (
        <p className="mt-12 text-muted">{uk ? 'Незабаром тут з’являться статті.' : 'Articles coming soon.'}</p>
      ) : (
        <div className="mt-10 flex flex-col divide-y divide-line">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/${locale}/blog/${article.slug}`}
              className="group py-6 no-underline"
            >
              <h2 className="font-display text-xl text-fg transition-colors group-hover:text-accent">
                {article.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted">{article.description}</p>
              <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                {new Date(article.date).toLocaleDateString(uk ? 'uk-UA' : 'en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {article.readingMinutes} {uk ? 'хв' : 'min'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

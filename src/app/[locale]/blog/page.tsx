import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticles, type Article } from '@/lib/blog/articles'
import { CATEGORIES, articlesIn } from '@/lib/blog/categories'
import { isLocale } from '@/lib/i18n/config'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { graph } from '@/lib/seo/structured-data'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  return buildMetadata({
    locale,
    path: '/blog',
    languages: ['uk'],
    title: 'Блог для фотографів: галереї, клієнти, ціни',
    description:
      'Практичні статті для фотографів: як передати фото клієнту, обрати онлайн-галерею, встановити ціну на зйомку й працювати з клієнтами без нервів.',
    image: { url: ogImagePath('page.blog'), alt: 'Блог проЯв для фотографів' },
  })
}

function fmtDate(date: string, uk: boolean): string {
  return new Date(date).toLocaleDateString(uk ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function BlogHubPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const uk = locale === 'uk'
  const articles = await getArticles()
  const [featured, ...rest] = articles
  const topics = CATEGORIES.filter((c) => articlesIn(c, articles).length > 0)
  preloadBrandFonts(locale)

  return (
    <main className="min-h-screen">
      <JsonLd data={graph()} />
      <SiteHeader locale={locale} current={`/${locale}/blog`} />
      <Breadcrumbs
        items={[
          { name: 'проЯв', path: `/${locale}` },
          { name: 'Блог', path: `/${locale}/blog` },
        ]}
      />

      {/* --- masthead --- */}
      <section className="mx-auto max-w-5xl px-6 pb-4 pt-10 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          {uk ? 'Журнал проЯв' : 'proiav journal'}
        </p>
        <h1 className="mt-4 max-w-3xl font-brand text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          {uk ? 'Блог для фотографів: поради, що працюють' : 'Guides that work for photographers'}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          {uk
            ? 'Як передавати зйомки клієнтам, обирати онлайн-галерею, встановлювати ціни й будувати особистий бренд — практично й без води.'
            : 'Delivering shoots, pricing, building a personal brand and taking payments — practical, no fluff.'}
        </p>
        {topics.length > 0 && (
          <nav aria-label="Теми блогу" className="mt-8 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/uk/blog/tema/${topic.slug}`}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-fg no-underline transition-colors hover:border-accent hover:text-accent"
              >
                {topic.name}
              </Link>
            ))}
          </nav>
        )}
      </section>

      {articles.length === 0 ? (
        <p className="mx-auto max-w-5xl px-6 py-24 text-muted">
          {uk ? 'Незабаром тут з’являться статті.' : 'Articles coming soon.'}
        </p>
      ) : (
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-12">
          {/* --- featured --- */}
          {featured && <FeaturedCard article={featured} locale={locale} uk={uk} />}

          {/* --- grid --- */}
          {rest.length > 0 && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} locale={locale} uk={uk} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- footer CTA --- */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-brand text-2xl sm:text-3xl">
              {uk ? 'Готові спробувати проЯв?' : 'Ready to try proiav?'}
            </h2>
            <p className="mt-2 max-w-md text-muted">
              {uk
                ? 'Онлайн-галереї для клієнтів під вашим брендом. 3 ГБ безкоштовно, без картки.'
                : 'Client galleries under your brand. 3 GB free, no card.'}
            </p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="shrink-0 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {uk ? 'Почати безкоштовно' : 'Start for free'}
          </Link>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  )
}

function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-[#eceada] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function FeaturedCard({ article, locale, uk }: { article: Article; locale: string; uk: boolean }) {
  return (
    <Link
      href={`/${locale}/blog/${article.slug}`}
      className="group block rounded-3xl border border-line bg-[#fbfbf8] p-8 no-underline transition-colors hover:border-accent-soft sm:p-12"
    >
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-accent">
        {uk ? 'Нове' : 'Latest'}
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mt-5 max-w-3xl font-brand text-3xl leading-tight tracking-tight text-fg transition-colors group-hover:text-accent sm:text-4xl">
        {article.title}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{article.description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <TagChips tags={article.tags} />
        <p className="text-xs uppercase tracking-widest text-muted">
          {fmtDate(article.updated ?? article.date, uk)} · {article.readingMinutes} {uk ? 'хв' : 'min'}
        </p>
      </div>
    </Link>
  )
}

function ArticleCard({ article, locale, uk }: { article: Article; locale: string; uk: boolean }) {
  return (
    <Link
      href={`/${locale}/blog/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-[#fbfbf8] p-6 no-underline transition-all hover:-translate-y-0.5 hover:border-accent-soft"
    >
      <TagChips tags={article.tags.slice(0, 1)} />
      <h3 className="mt-4 font-brand text-xl leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
        {article.title}
      </h3>
      <p className="mt-3 line-clamp-3 flex-1 leading-relaxed text-muted">{article.description}</p>
      <p className="mt-5 text-xs uppercase tracking-widest text-muted">
        {fmtDate(article.updated ?? article.date, uk)} · {article.readingMinutes} {uk ? 'хв' : 'min'}
      </p>
    </Link>
  )
}

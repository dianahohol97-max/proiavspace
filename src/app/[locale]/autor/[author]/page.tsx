import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticles } from '@/lib/blog/articles'
import { AUTHORS, DEFAULT_AUTHOR, authorPath } from '@/lib/blog/authors'
import { preloadBrandFonts } from '@/lib/seo/fonts'
import { buildMetadata, clampDescription } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { absoluteUrl } from '@/lib/seo/site'
import { graph } from '@/lib/seo/structured-data'
import { AuthorAvatar } from '@/components/blog/AuthorAvatar'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { JsonLd } from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

function findAuthor(slug: string) {
  return AUTHORS.find((a) => a.slug === slug)
}

export function generateMetadata({ params }: { params: { locale: string; author: string } }): Metadata {
  const author = findAuthor(params.author)
  if (!author || params.locale !== 'uk') return { robots: { index: false, follow: false } }
  return buildMetadata({
    locale: 'uk',
    path: `/autor/${author.slug}`,
    languages: ['uk'],
    title: `${author.name}, авторка блогу`,
    description: clampDescription(`${author.bio} Усі статті авторки в блозі — тут.`),
    image: { url: ogImagePath(`page.autor-${author.slug}`), alt: author.name },
  })
}

function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Author page: name, short bio, portrait slot and her articles. */
export default async function AuthorPage({ params }: { params: { locale: string; author: string } }) {
  if (params.locale !== 'uk') notFound()
  const author = findAuthor(params.author)
  if (!author) notFound()
  preloadBrandFonts('uk')

  const articles = (await getArticles()).filter((a) => (a.author ?? DEFAULT_AUTHOR) === author.slug)
  const url = absoluteUrl(authorPath(author))
  const jsonLd = graph({
    '@type': 'ProfilePage',
    '@id': `${url}#page`,
    url,
    inLanguage: 'uk',
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: author.name,
      description: author.bio,
      url,
      ...(author.photo ? { image: absoluteUrl(author.photo) } : {}),
      worksFor: { '@id': absoluteUrl('/#org') },
    },
  })

  return (
    <main className="min-h-screen">
      <JsonLd data={jsonLd} />
      <SiteHeader locale="uk" current="/uk/blog" />
      <Breadcrumbs
        items={[
          { name: 'проЯв', path: '/uk' },
          { name: 'Блог', path: '/uk/blog' },
          { name: author.name, path: authorPath(author) },
        ]}
      />
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 pb-4 pt-10 sm:flex-row sm:items-center sm:pt-16">
        <AuthorAvatar author={author} size={112} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Авторка блогу</p>
          <h1 className="mt-3 font-brand text-4xl leading-[1.05] tracking-tight sm:text-5xl">{author.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{author.bio}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <h2 className="mb-6 font-brand text-2xl">Статті авторки</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/uk/blog/${article.slug}`}
              className="group flex flex-col rounded-2xl border border-line bg-[#fbfbf8] p-6 no-underline transition-all hover:-translate-y-0.5 hover:border-accent-soft"
            >
              <h3 className="font-brand text-xl leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
                {article.title}
              </h3>
              <p className="mt-3 line-clamp-3 flex-1 leading-relaxed text-muted">{article.description}</p>
              <p className="mt-5 text-xs uppercase tracking-widest text-muted">
                {fmtDate(article.updated ?? article.date)} · {article.readingMinutes} хв
              </p>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter locale="uk" />
    </main>
  )
}

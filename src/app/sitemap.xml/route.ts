import { createClient } from '@supabase/supabase-js'
import { articleImages, getArticles } from '@/lib/blog/articles'
import { CATEGORIES, articlesIn } from '@/lib/blog/categories'
import { MARKETING_PAGES, brandOgImage, ogImagePath } from '@/lib/seo/pages'
import { absoluteUrl, isIndexedLocale } from '@/lib/seo/site'

export const revalidate = 3600

/**
 * Hand-written sitemap (Next 14's MetadataRoute.Sitemap has no image
 * extension): every indexable marketing page with xhtml:link hreflang
 * alternates, blog articles and topics with lastmod, <image:image> entries,
 * and published photographer sites.
 *
 * Deliberately absent: client galleries (/g), booking pages (/b), the
 * dashboard, and every locale except uk/en (noindex until localized).
 */
interface Entry {
  path: string
  lastmod?: string
  changefreq?: string
  priority?: number
  alternates?: Record<string, string>
  images?: { loc: string; title?: string }[]
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

function render(entries: Entry[]): string {
  const urls = entries.map((e) => {
    const parts = [`<loc>${esc(absoluteUrl(e.path))}</loc>`]
    if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`)
    if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`)
    if (e.priority !== undefined) parts.push(`<priority>${e.priority.toFixed(1)}</priority>`)
    for (const [lang, href] of Object.entries(e.alternates ?? {})) {
      parts.push(`<xhtml:link rel="alternate" hreflang="${lang}" href="${esc(absoluteUrl(href))}"/>`)
    }
    for (const img of e.images ?? []) {
      parts.push(
        `<image:image><image:loc>${esc(absoluteUrl(img.loc))}</image:loc>${
          img.title ? `<image:title>${esc(img.title)}</image:title>` : ''
        }</image:image>`
      )
    }
    return `<url>${parts.join('')}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`
}

async function publishedSites(): Promise<Entry[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return []
  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data } = await supabase.rpc('get_published_site_handles')
    return ((data as { handle: string; updated_at: string }[] | null) ?? []).map((row) => ({
      path: `/uk/s/${row.handle}`,
      lastmod: isoDate(row.updated_at),
      changefreq: 'weekly',
      priority: 0.5,
    }))
  } catch {
    // The sitemap must never fail the request — marketing entries suffice.
    return []
  }
}

export async function GET() {
  const entries: Entry[] = []
  const articles = await getArticles()
  const newest = articles.map((a) => a.updated ?? a.date).sort().at(-1)

  for (const page of MARKETING_PAGES) {
    if (page.unlisted) continue
    const langs = page.languages.filter(isIndexedLocale)
    const alternates: Record<string, string> | undefined =
      langs.length > 1
        ? Object.fromEntries([
            ...langs.map((l) => [l, `/${l}${page.path}`]),
            ['x-default', `/${langs.includes('uk') ? 'uk' : langs[0]}${page.path}`],
          ])
        : undefined
    for (const locale of langs) {
      entries.push({
        path: `/${locale}${page.path}`,
        lastmod: page.id === 'blog' ? isoDate(newest) : undefined,
        changefreq: page.changeFrequency,
        priority: locale === 'uk' ? page.priority : Math.max(0.1, page.priority - 0.2),
        alternates,
        images: [{ loc: page.id === 'home' && locale !== 'uk' ? brandOgImage(locale) : ogImagePath(`page.${page.id}`), title: page.ogTitle }],
      })
    }
  }

  for (const category of CATEGORIES) {
    const inCat = articlesIn(category, articles)
    if (inCat.length === 0) continue
    entries.push({
      path: `/uk/blog/tema/${category.slug}`,
      lastmod: isoDate(inCat.map((a) => a.updated ?? a.date).sort().at(-1)),
      changefreq: 'weekly',
      priority: 0.5,
      images: [{ loc: ogImagePath(`tema.${category.slug}`), title: category.title }],
    })
  }

  for (const article of articles) {
    entries.push({
      path: `/uk/blog/${article.slug}`,
      lastmod: isoDate(article.updated ?? article.date),
      changefreq: 'monthly',
      priority: 0.6,
      images: [
        { loc: ogImagePath(`blog.${article.slug}`), title: article.title },
        ...articleImages(article).map((img) => ({ loc: img.src, title: img.alt })),
      ],
    })
  }

  entries.push(...(await publishedSites()))

  return new Response(render(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

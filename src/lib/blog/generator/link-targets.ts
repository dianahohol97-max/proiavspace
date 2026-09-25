import { createClient } from '@supabase/supabase-js'
import { currentSlug, getCuratedArticles } from '@/lib/blog/articles'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PRODUCT_PAGES } from '@/lib/landing/product-pages'

/** A page the generator may link to, with a one-line topic for the prompt. */
export interface LinkTarget {
  path: string
  title: string
}

export interface LinkTargets {
  product: LinkTarget[]
  articles: LinkTarget[]
  /** Other real pages a link may point at (author, login, blog hubs). */
  other: string[]
}

/** Indexable product pages (drafts are noindex, never linked). */
export function productTargets(): LinkTarget[] {
  return PRODUCT_PAGES.filter((p) => !p.draft).map((p) => ({ path: `/uk${p.path}`, title: p.h1 }))
}

const OTHER = ['/uk/login', '/uk/blog', '/uk/gallery-demo', '/uk/autor/eva-khudiuk']

function dbClient() {
  const admin = createSupabaseAdminClient()
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Every live page an article may link to: product pages + published articles. */
export async function loadLinkTargets(excludeSlug?: string): Promise<LinkTargets> {
  const articles = new Map<string, LinkTarget>()
  for (const a of getCuratedArticles()) articles.set(a.slug, { path: `/uk/blog/${a.slug}`, title: a.title })
  const db = dbClient()
  if (db) {
    const { data } = await db.from('blog_articles').select('slug, title').eq('status', 'published')
    for (const row of (data as { slug: string; title: string }[] | null) ?? []) {
      const slug = currentSlug(row.slug)
      articles.set(slug, { path: `/uk/blog/${slug}`, title: row.title })
    }
  }
  if (excludeSlug) articles.delete(currentSlug(excludeSlug))
  return { product: productTargets(), articles: [...articles.values()], other: OTHER }
}

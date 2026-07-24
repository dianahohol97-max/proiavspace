import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getArticles } from '@/lib/blog/articles'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Marketing pages + published photographer SITES (their Phase-2 SEO promise:
 * personal sites rank under the photographer's name). Client galleries and
 * booking pages are deliberately absent — they are noindex (privacy).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languages = { uk: `${BASE_URL}/uk`, en: `${BASE_URL}/en` }
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/uk`, changeFrequency: 'weekly', priority: 1, alternates: { languages } },
    { url: `${BASE_URL}/en`, changeFrequency: 'weekly', priority: 0.8, alternates: { languages } },
    { url: `${BASE_URL}/uk/blog`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  // Blog articles (Ukrainian; canonical on /uk).
  for (const article of await getArticles()) {
    entries.push({
      url: `${BASE_URL}/uk/blog/${article.slug}`,
      lastModified: new Date(article.date),
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  // Published photographer sites via a security-definer RPC (anon key).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && anonKey) {
    try {
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data } = await supabase.rpc('get_published_site_handles')
      for (const row of (data as { handle: string; updated_at: string }[] | null) ?? []) {
        entries.push({
          url: `${BASE_URL}/uk/s/${row.handle}`,
          lastModified: new Date(row.updated_at),
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    } catch {
      // The sitemap must never fail the request — marketing entries suffice.
    }
  }

  return entries
}

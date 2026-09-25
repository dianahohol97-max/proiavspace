import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/config'
import { BASE_URL } from '@/lib/seo/site'

/**
 * Everything public is crawlable; the photographer's dashboard, login, the
 * owner-only site preview, API and auth are not — in every locale.
 *
 * Client galleries (/g) and booking pages (/b) are NOT disallowed on purpose:
 * they carry meta noindex, and a crawler must be able to fetch the page to see
 * it. robots.txt-blocked URLs can still end up indexed from external links.
 */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ['dashboard', 'login', 'site-preview']
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          ...locales.flatMap((locale) => privatePaths.map((p) => `/${locale}/${p}`)),
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}

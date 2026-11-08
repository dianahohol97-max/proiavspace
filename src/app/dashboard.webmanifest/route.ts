import { NextResponse, type NextRequest } from 'next/server'
import { dashboardManifest } from '@/lib/app/manifest'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'

/** /dashboard.webmanifest[?lang=pl] — see lib/app/manifest.ts. Ukrainian by default. */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('lang') ?? 'uk'
  const locale = isLocale(requested) ? requested : 'uk'
  const dict = await getDictionary(locale)
  return new NextResponse(JSON.stringify(dashboardManifest(locale, dict.app)), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

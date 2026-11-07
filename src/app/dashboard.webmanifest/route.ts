import { NextResponse, type NextRequest } from 'next/server'
import { dashboardManifest } from '@/lib/app/manifest'

/** /dashboard.webmanifest[?lang=en] — see lib/app/manifest.ts. */
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('lang')
  const lang = !requested || requested === 'uk' ? 'uk' : 'en'
  return new NextResponse(JSON.stringify(dashboardManifest(lang)), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/lib/i18n/config'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Two jobs:
 *   1. Locale routing — every page URL is prefixed with /uk or /en;
 *      bare paths redirect to the default locale (uk).
 *   2. Supabase session refresh on every matched request.
 * API routes and the auth callback are excluded from locale handling
 * by the matcher below.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Canonicalize the platform host: www → apex, so Google indexes one URL
  // (matches the declared canonical https://proiav.space/…). A permanent 301.
  if ((request.headers.get('host') ?? '') === 'www.proiav.space') {
    const url = request.nextUrl.clone()
    url.host = 'proiav.space'
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 301)
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )

  if (!hasLocale) {
    const url = request.nextUrl.clone()
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next({ request })

  // Anonymous client identity for public galleries: an unguessable token in
  // an httpOnly cookie scopes favorites/retouch picks without registration.
  const isPublicGallery = locales.some((locale) => pathname.startsWith(`/${locale}/g/`))
  if (isPublicGallery && !request.cookies.get('ct')) {
    response.cookies.set('ct', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  return updateSession(request, response)
}

export const config = {
  matcher: [
    // Everything except API routes, auth callback, Next internals and files.
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}

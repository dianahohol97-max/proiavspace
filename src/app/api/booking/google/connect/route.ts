import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale } from '@/lib/i18n/config'
import { googleAuthUrl, isGoogleConfigured } from '@/lib/booking/googleCalendar'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Starts the Google Calendar OAuth flow for the logged-in photographer.
 * A random `state` is stored in an httpOnly cookie and echoed back to the
 * callback for CSRF protection; the return locale rides along so the callback
 * can send the photographer back to their dashboard in the right language.
 */
export async function GET(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get('locale') ?? ''
  const locale = isLocale(localeParam) ? localeParam : defaultLocale
  const bookingUrl = new URL(`/${locale}/dashboard/booking`, request.nextUrl.origin)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.nextUrl.origin))
  }
  if (!isGoogleConfigured()) {
    bookingUrl.searchParams.set('google', 'unconfigured')
    return NextResponse.redirect(bookingUrl)
  }

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(googleAuthUrl(state))
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  }
  response.cookies.set('g_oauth_state', state, cookieOpts)
  response.cookies.set('g_oauth_locale', locale, cookieOpts)
  return response
}

import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale } from '@/lib/i18n/config'
import { exchangeCode, getUserEmail } from '@/lib/booking/googleCalendar'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Google OAuth callback: verifies the CSRF state, swaps the code for a refresh
 * token, and stores it on the photographer's booking_settings (owner-scoped
 * under RLS). Only the refresh token and account email are kept — no access
 * token is persisted; each push mints a fresh one.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const localeCookie = request.cookies.get('g_oauth_locale')?.value ?? ''
  const locale = isLocale(localeCookie) ? localeCookie : defaultLocale
  const bookingUrl = new URL(`/${locale}/dashboard/booking`, url.origin)

  const clear = (res: NextResponse) => {
    res.cookies.delete('g_oauth_state')
    res.cookies.delete('g_oauth_locale')
    return res
  }
  const fail = () => {
    bookingUrl.searchParams.set('google', 'error')
    return clear(NextResponse.redirect(bookingUrl))
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('g_oauth_state')?.value
  if (url.searchParams.get('error') || !code || !state || !savedState || state !== savedState) {
    return fail()
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return clear(NextResponse.redirect(new URL(`/${locale}/login`, url.origin)))

  try {
    const tokens = await exchangeCode(code)
    if (!tokens.refresh_token) return fail()
    const email = await getUserEmail(tokens.access_token)
    const { error } = await supabase.from('booking_settings').upsert(
      {
        user_id: user.id,
        google_refresh_token: tokens.refresh_token,
        google_email: email,
        google_calendar_id: 'primary',
      },
      { onConflict: 'user_id' }
    )
    if (error) throw new Error(error.message)
  } catch {
    return fail()
  }

  bookingUrl.searchParams.set('google', 'connected')
  return clear(NextResponse.redirect(bookingUrl))
}

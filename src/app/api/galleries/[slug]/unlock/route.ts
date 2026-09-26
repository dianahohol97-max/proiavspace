import { NextResponse, type NextRequest } from 'next/server'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery-access'
import { defaultLocale, isLocale } from '@/lib/i18n/config'
import { verifyPassword } from '@/lib/password'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Password gate for public galleries. On a correct password the response sets
 * an httpOnly HMAC cookie and redirects back to the gallery page.
 * The scrypt hash is no longer selectable by the anon/authenticated key (it is
 * revoked at the column level), so it is read here via the service-role client
 * — the only place that ever touches the hash, and always server-side.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const formData = await request.formData()
  const password = String(formData.get('password') ?? '')
  // Only a known locale may go into the redirect path — `/evil.com` here would
  // turn the gallery URL into `//evil.com/...`, an open redirect.
  const rawLocale = String(formData.get('locale') ?? 'uk')
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const galleryUrl = new URL(`/${locale}/g/${params.slug}`, request.url)

  const admin = createSupabaseAdminClient()
  if (!admin) {
    // Fail closed: without the service role we cannot verify the password.
    galleryUrl.searchParams.set('error', 'password')
    return NextResponse.redirect(galleryUrl, { status: 303 })
  }
  const { data: gallery } = await admin
    .from('galleries')
    .select('id, password_hash')
    .eq('slug', params.slug)
    .single()

  if (!gallery) {
    return NextResponse.redirect(galleryUrl, { status: 303 })
  }

  if (gallery.password_hash && !verifyPassword(password, gallery.password_hash)) {
    galleryUrl.searchParams.set('error', 'password')
    return NextResponse.redirect(galleryUrl, { status: 303 })
  }

  const response = NextResponse.redirect(galleryUrl, { status: 303 })
  response.cookies.set(unlockCookieName(gallery.id), unlockCookieValue(gallery.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return response
}

import { NextResponse, type NextRequest } from 'next/server'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery-access'
import { defaultLocale, isLocale } from '@/lib/i18n/config'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const preferredRegion = 'fra1'

/**
 * «Відкрити як клієнт» (Дизайн → Превʼю): the photographer opens their own
 * gallery exactly as a client sees it. For a password gallery the owner gets
 * the same unlock cookie a client gets after typing the password — they set
 * that password, so nothing is bypassed. `?preview=1` keeps the visit out of
 * the gallery's view count. Anyone else (or a signed-out browser) is simply
 * sent to the gallery, where the usual password form applies.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const rawLocale = request.nextUrl.searchParams.get('locale') ?? defaultLocale
  // Only a known locale goes into the redirect path (no open redirect).
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale
  const galleryUrl = new URL(`/${locale}/g/${encodeURIComponent(params.slug)}`, request.url)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(galleryUrl, { status: 303 })

  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, has_password')
    .eq('slug', params.slug)
    .eq('owner_id', user.id)
    .maybeSingle<{ id: string; has_password: boolean }>()
  if (!gallery) return NextResponse.redirect(galleryUrl, { status: 303 })

  galleryUrl.searchParams.set('preview', '1')
  const response = NextResponse.redirect(galleryUrl, { status: 303 })
  if (!gallery.has_password) return response

  // The hash is readable by the service role only (column grant, 0020).
  const admin = createSupabaseAdminClient()
  const { data } = admin
    ? await admin.from('galleries').select('password_hash').eq('id', gallery.id).maybeSingle<{ password_hash: string | null }>()
    : { data: null }
  if (data?.password_hash) {
    response.cookies.set(unlockCookieName(gallery.id), unlockCookieValue(gallery.id, data.password_hash), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }
  return response
}

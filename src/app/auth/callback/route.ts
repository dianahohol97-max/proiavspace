import { NextResponse, type NextRequest } from 'next/server'
import { REF_COOKIE, normalizeRefCode } from '@/lib/referrals'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Only allow same-origin, in-app redirect targets. Anything else — an absolute
 * URL, a protocol-relative `//evil.com`, a backslash trick — falls back to the
 * dashboard, so `?next=` can never bounce the freshly-authenticated visitor to
 * an attacker-controlled site (open redirect / token phishing).
 */
function safeNext(next: string | null): string {
  if (!next) return '/uk/dashboard'
  // Must be a single leading slash followed by a non-slash/backslash char.
  if (!/^\/[^/\\]/.test(next)) return '/uk/dashboard'
  // URL parsing strips tabs/newlines, so `/\t/evil.com` would become
  // `//evil.com`: reject control characters, whitespace and backslashes outright.
  if (/[\u0000-\u0020\u007f\\]/.test(next)) return '/uk/dashboard'
  // Belt and braces: the resolved target must stay on our origin.
  const base = 'https://proiav.invalid'
  if (new URL(next, base).origin !== base) return '/uk/dashboard'
  return next
}

/**
 * Magic-link / OAuth / e-mail-confirmation landing: exchange the auth code for
 * a session, then continue. With a referral cookie present, this is also
 * where a Google or magic-link signup gets linked to its inviter
 * (claim_referral: fresh accounts without a referrer only; no-op otherwise).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const supabase = createSupabaseServerClient()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  const response = NextResponse.redirect(new URL(next, request.url))
  const ref = normalizeRefCode(request.cookies.get(REF_COOKIE)?.value)
  if (ref) {
    const { error } = await supabase.rpc('claim_referral', { p_code: ref })
    // Consumed either way: the account is linked, was already linked, or is
    // too old to link — none of which a retry would change.
    if (!error) response.cookies.set(REF_COOKIE, '', { maxAge: 0, path: '/' })
  }
  return response
}

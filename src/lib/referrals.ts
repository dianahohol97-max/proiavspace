import type { NextRequest, NextResponse } from 'next/server'

/**
 * Referral program rules — the single place for the numbers. The database
 * functions (migration 0044) take the caps as parameters, so changing a value
 * here changes it everywhere.
 *
 *   • A referrer earns REFERRAL_RATE of EVERY successful payment their
 *     referred photographer makes: as проЯв credit, or as cash for an
 *     ambassador. The referred photographer gets nothing (for now).
 *   • Credit has no cap. An ambassador's cash stops after
 *     AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL payments of each referral.
 *   • Self-referral (same account / e-mail / saved card) earns nothing.
 *   • A refund reverses the reward.
 */
export const REFERRAL_RATE = 0.1
export const AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL = 12

/** Referral share of a UAH amount, in kopecks. */
export function referralRewardKop(amountUah: number): number {
  return Math.round(amountUah * 100 * REFERRAL_RATE)
}

/**
 * The ?ref= code travels in a cookie for REF_COOKIE_DAYS, so signing up later,
 * with Google or a magic link, or after a detour through the landing still
 * links to the inviter. Readable by the login page (not httpOnly): the code is
 * public by design.
 */
export const REF_COOKIE = 'proiav_ref'
export const REF_COOKIE_DAYS = 30

/** Codes are 8 lowercase hex chars; anything else is not a code at all. */
export function normalizeRefCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toLowerCase()
  return /^[0-9a-f]{8}$/.test(code) ? code : null
}

/**
 * Middleware step: a valid ?ref= on any page is stored in the ref cookie,
 * unless one is already there (the first inviter wins). Returns the code that
 * was stored, or null.
 */
export function captureRefParam(request: NextRequest, response: NextResponse): string | null {
  const code = normalizeRefCode(request.nextUrl.searchParams.get('ref'))
  if (!code || request.cookies.get(REF_COOKIE)) return null
  response.cookies.set(REF_COOKIE, code, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * REF_COOKIE_DAYS,
    path: '/',
  })
  return code
}

/** Browser side: the ref cookie's value, if any. */
export function readRefCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${REF_COOKIE}=([^;]*)`))
  return match ? normalizeRefCode(decodeURIComponent(match[1])) : null
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Auth-aware header actions. A logged-in visitor who returns to the marketing
 * page sees «Кабінет» → dashboard instead of a sign-in prompt, so going home
 * never looks like a logout. Renders the signed-out CTA first (matches the
 * static SSR markup) and swaps to the dashboard link once the browser session
 * is known.
 *
 * The Supabase client (~45 KB of JS) is NOT part of the landing bundle: it is
 * imported on demand, and only when a session cookie (`sb-…-auth-token`, maybe
 * chunked as `.0`, `.1`) is present. Most landing visitors are signed out and
 * never download it.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/

export function useAuthed(): boolean | null {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!SESSION_COOKIE.test(document.cookie)) {
      setAuthed(false)
      return
    }
    let active = true
    let unsubscribe: (() => void) | undefined
    import('@/lib/supabase/browser').then(({ createSupabaseBrowserClient }) => {
      if (!active) return
      const supabase = createSupabaseBrowserClient()
      supabase.auth.getSession().then(({ data }) => {
        if (active) setAuthed(Boolean(data.session))
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setAuthed(Boolean(session))
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  return authed
}

export interface AuthNavLabels {
  signIn: string
  ctaShort: string
  dashboard: string
}

/**
 * Header bar: «Увійти» + «Почати безкоштовно →», or «Кабінет →» once signed in.
 * Class names come from the header that renders it.
 */
export function AuthNav({
  locale,
  labels,
  authed,
  linkClassName,
  ctaClassName,
}: {
  locale: string
  labels: AuthNavLabels
  authed: boolean | null
  linkClassName?: string
  ctaClassName?: string
}) {
  if (authed) {
    return (
      <Link href={`/${locale}/dashboard`} className={ctaClassName}>
        {labels.dashboard} <span aria-hidden="true">→</span>
      </Link>
    )
  }

  return (
    <>
      <Link href={`/${locale}/login`} className={linkClassName}>
        {labels.signIn}
      </Link>
      <Link href={`/${locale}/login`} className={ctaClassName}>
        {labels.ctaShort} <span aria-hidden="true">→</span>
      </Link>
    </>
  )
}

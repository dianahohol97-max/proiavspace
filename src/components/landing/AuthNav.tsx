'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import s from '@/app/[locale]/landing.module.css'

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
export function AuthNav({
  locale,
  labels,
}: {
  locale: string
  labels: { signIn: string; ctaShort: string; dashboard: string }
}) {
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

  if (authed) {
    return (
      <Link href={`/${locale}/dashboard`} className={s.pillHot}>
        {labels.dashboard} <span>→</span>
      </Link>
    )
  }

  return (
    <>
      <Link href={`/${locale}/login`}>{labels.signIn}</Link>
      <Link href={`/${locale}/login`} className={s.pillHot}>
        {labels.ctaShort} <span>→</span>
      </Link>
    </>
  )
}

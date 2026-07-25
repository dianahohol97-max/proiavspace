'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import s from '@/app/[locale]/landing.module.css'

/**
 * Auth-aware header actions. A logged-in visitor who returns to the marketing
 * page sees «Кабінет» → dashboard instead of a sign-in prompt, so going home
 * never looks like a logout. Renders the signed-out CTA first (matches the
 * static SSR markup) and swaps to the dashboard link once the browser session
 * is known.
 */
export function AuthNav({
  locale,
  labels,
}: {
  locale: string
  labels: { signIn: string; ctaShort: string; dashboard: string }
}) {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthed(Boolean(data.session))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session))
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
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

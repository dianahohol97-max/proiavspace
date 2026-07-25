'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config'
import { getDictionary, type Dictionary } from '@/lib/i18n'

type Mode = 'signin' | 'signup' | 'magic'
type Status = 'idle' | 'busy' | 'magicSent' | 'confirmSent' | 'error'

export default function LoginPage() {
  const params = useParams<{ locale: string }>()
  const router = useRouter()
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale

  const [dict, setDict] = useState<Dictionary | null>(null)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    void getDictionary(locale).then(setDict)
  }, [locale])

  // Already signed in? Don't show the form — go straight to the dashboard, so
  // returning from the marketing page never asks a logged-in user to re-login.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(`/${locale}/dashboard`)
    })
  }, [locale, router])

  if (!dict) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
  const callbackUrl = `${appUrl}/auth/callback?next=/${locale}/dashboard`

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('busy')
    const supabase = createSupabaseBrowserClient()

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      })
      setStatus(error ? 'error' : 'magicSent')
      return
    }

    if (mode === 'signup') {
      // Carry a referral code (?ref=) into the signup so the DB trigger can
      // credit the referrer.
      const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: ref ? { ref } : undefined,
        },
      })
      if (error) {
        setStatus('error')
      } else if (data.session) {
        // Email confirmation disabled in Supabase → session is live already.
        window.location.assign(`/${locale}/dashboard`)
      } else {
        setStatus('confirmSent')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setStatus('error')
    } else {
      window.location.assign(`/${locale}/dashboard`)
    }
  }

  async function signInWithGoogle() {
    setStatus('busy')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) setStatus('error')
    // On success the browser navigates away to Google.
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: 'signin', label: dict.auth.tabSignin },
    { id: 'signup', label: dict.auth.tabSignup },
    { id: 'magic', label: dict.auth.tabMagic },
  ]

  const sentMessage =
    status === 'magicSent'
      ? dict.auth.magicLinkSent
      : status === 'confirmSent'
        ? dict.auth.confirmSent
        : null

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-3xl">{dict.auth.title}</h1>

      {sentMessage ? (
        <p className="mt-8 leading-relaxed text-muted">{sentMessage}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={status === 'busy'}
            className="mt-8 flex items-center justify-center gap-3 border border-line px-6 py-3 text-sm transition-colors hover:border-fg disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.03c2.2-2.1 3.5-5.1 3.5-8.6"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-4.9l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24"
              />
              <path
                fill="#FBBC05"
                d="M5.2 14.5c-.25-.7-.4-1.6-.4-2.5s.15-1.7.4-2.5l-.01-.16-3.7-2.8-.12.06C.5 8.1 0 10 0 12s.5 3.9 1.4 5.5l3.8-3"
              />
              <path
                fill="#EA4335"
                d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l3.8 3c1-2.8 3.6-4.9 6.8-4.9"
              />
            </svg>
            {dict.auth.googleButton}
          </button>

          <div className="mt-8 flex border-b border-line text-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id)
                  setStatus('idle')
                }}
                className={`px-4 py-2 transition-colors ${
                  mode === tab.id
                    ? 'border-b-2 border-fg text-fg'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="text-sm text-muted" htmlFor="email">
              {dict.auth.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
              placeholder="you@example.com"
            />

            {mode !== 'magic' && (
              <>
                <label className="text-sm text-muted" htmlFor="password">
                  {dict.auth.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
                  placeholder="••••••••"
                />
                {mode === 'signup' && (
                  <p className="text-xs text-muted">{dict.auth.passwordHint}</p>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={status === 'busy'}
              className="mt-2 border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-50"
            >
              {mode === 'signin'
                ? dict.auth.signinButton
                : mode === 'signup'
                  ? dict.auth.signupButton
                  : dict.auth.magicLinkButton}
            </button>
            {status === 'error' && (
              <p className="text-sm text-accent">
                {mode === 'magic'
                  ? dict.auth.error
                  : mode === 'signup'
                    ? dict.auth.signupError
                    : dict.auth.passwordError}
              </p>
            )}
          </form>
        </>
      )}
    </main>
  )
}

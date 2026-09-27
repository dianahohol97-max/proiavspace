'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config'
import { getDictionary, type Dictionary } from '@/lib/i18n'

type Status = 'checking' | 'ready' | 'invalid' | 'busy' | 'done' | 'error'

/**
 * Second half of «Забули пароль?» (audit EM-01). The e-mailed link goes
 * through /auth/callback, which exchanges the one-time code for a session and
 * forwards here; the photographer sets a new password with updateUser().
 * Without that session the link was invalid or already used.
 */
export default function ResetPasswordPage() {
  const params = useParams<{ locale: string }>()
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    void getDictionary(locale).then(setDict)
  }, [locale])

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => setStatus(data.session ? 'ready' : 'invalid'))
  }, [])

  if (!dict) return null

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('busy')
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password })
    if (error) {
      setStatus('error')
      return
    }
    setStatus('done')
    window.location.assign(`/${locale}/dashboard`)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-3xl">{dict.auth.newPasswordTitle}</h1>
      {status === 'invalid' ? (
        <p className="mt-8 leading-relaxed text-muted">
          {dict.auth.resetLinkInvalid}{' '}
          <a href={`/${locale}/login`} className="underline">
            {dict.auth.backToSignin}
          </a>
        </p>
      ) : status === 'done' ? (
        <p className="mt-8 leading-relaxed text-muted">{dict.auth.newPasswordDone}</p>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="text-sm text-muted" htmlFor="password">
            {dict.auth.newPasswordLabel}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
            placeholder="••••••••"
          />
          <p className="text-xs text-muted">{dict.auth.passwordHint}</p>
          <button
            type="submit"
            disabled={status === 'busy' || status === 'checking'}
            className="mt-2 border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-50"
          >
            {dict.auth.newPasswordButton}
          </button>
          {status === 'error' && <p className="text-sm text-accent">{dict.auth.newPasswordError}</p>}
        </form>
      )}
    </main>
  )
}

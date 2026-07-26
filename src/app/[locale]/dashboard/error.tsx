'use client'

import { useEffect, useState } from 'react'

/** Names whatever foreign code touched the DOM — shows up in screenshots. */
function domMarkers(): string {
  try {
    const found: string[] = []
    const cls = document.documentElement.className
    if (/translated-/.test(cls)) found.push('google-translate')
    if (document.querySelector('font[style*="vertical-align"]')) found.push('translated-text')
    if (document.querySelector('grammarly-extension,[data-gr-ext-installed]')) found.push('grammarly')
    if (document.querySelector('[data-lastpass-icon-root],[data-lastpass-root]')) found.push('lastpass')
    if (document.querySelector('com-1password-button,[data-com-onepassword-filled]')) found.push('1password')
    if (document.querySelector('[data-dashlane-rid],[data-dashlane-created]')) found.push('dashlane')
    if (document.querySelector('[data-bwautofill],[data-bitwarden-watching]')) found.push('bitwarden')
    if (document.querySelector('[data-np-autofill-field-id],[data-np-uid]')) found.push('nordpass')
    return found.join(' · ')
  } catch {
    return ''
  }
}

/**
 * Dashboard error boundary. Replaces the raw white "client-side exception"
 * screen with a recoverable state: a retry button (React re-renders the
 * segment) and a full reload. It also surfaces the underlying message/digest
 * so a failure can be diagnosed from a screenshot instead of guesswork —
 * server-component errors are redacted to a digest in production, client-side
 * ones show the real message here.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [markers, setMarkers] = useState('')

  useEffect(() => {
    // Surface it in the browser console too (visible in DevTools).
    console.error('dashboard error boundary:', error)
    setMarkers(domMarkers())
    // React-caught errors never reach window.onerror, so the boundary itself
    // ships the forensics (message+stack+DOM mutation log) to debug_events.
    try {
      fetch('/api/debug-log', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: window.location.href,
          ua: navigator.userAgent,
          message: `[dashboard boundary] ${error.message}\n${error.stack ?? ''}`,
          mut: (window as unknown as { __mut?: string[] }).__mut ?? [],
        }),
      }).catch(() => {})
    } catch {
      /* reporting must never throw */
    }
    // DOM-mutation crashes (extension/translator rewrote React's nodes) are
    // transient: self-heal with ONE automatic reload per episode.
    // (Safari phrases these as NotFoundError: "The object can not be found".)
    if (/removeChild|insertBefore|appendChild|not a child|can ?not be found|NotFoundError|parallelRoutes/i.test(error.message || '')) {
      try {
        if (!sessionStorage.getItem('__domfix')) {
          sessionStorage.setItem('__domfix', '1')
          window.location.reload()
          return
        }
        sessionStorage.removeItem('__domfix')
      } catch {
        /* sessionStorage unavailable — just show the screen */
      }
    }
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-3xl">Щось пішло не так</h1>
      <p className="max-w-md leading-relaxed text-muted">
        Сторінка не завантажилась. Спробуйте ще раз — якщо помилка повторюється, оновіть
        сторінку (Cmd/Ctrl + Shift + R).
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
        >
          Спробувати ще раз
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border border-line px-6 py-2 text-sm uppercase tracking-widest text-muted transition-colors hover:border-fg hover:text-fg"
        >
          Оновити сторінку
        </button>
      </div>
      <p className="mt-2 max-w-md break-words text-xs text-muted/70">
        {error.message}
        {error.digest ? ` · ${error.digest}` : ''}
        {markers ? ` · виявлено: ${markers}` : ''}
      </p>
    </main>
  )
}

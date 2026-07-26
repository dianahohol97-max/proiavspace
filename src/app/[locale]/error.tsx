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
 * Locale-level error boundary: catches errors thrown by segment layouts below
 * (e.g. the dashboard layout), which a deeper error.tsx cannot catch. Shows a
 * recoverable screen with the underlying message/digest for diagnosis.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [markers, setMarkers] = useState('')

  useEffect(() => {
    console.error('locale error boundary:', error)
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
          message: `[locale boundary] ${error.message}\n${error.stack ?? ''}`,
          mut: (window as unknown as { __mut?: string[] }).__mut ?? [],
        }),
      }).catch(() => {})
    } catch {
      /* reporting must never throw */
    }
    // DOM-mutation crashes (extension/translator rewrote React's nodes) are
    // transient: a fresh full load renders fine. Self-heal with ONE automatic
    // reload per episode; if it crashes again, show this screen and stop.
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
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '0 24px',
        textAlign: 'center',
        fontFamily: '-apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 30, margin: 0 }}>
        Щось пішло не так
      </h1>
      <p style={{ maxWidth: 440, lineHeight: 1.6, color: '#777', margin: 0 }}>
        Сторінка не завантажилась. Спробуйте ще раз або оновіть сторінку.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            border: '1px solid #111',
            background: 'transparent',
            padding: '10px 22px',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: 'pointer',
          }}
        >
          Спробувати ще раз
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: '1px solid #ccc',
            background: 'transparent',
            padding: '10px 22px',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#777',
            cursor: 'pointer',
          }}
        >
          Оновити сторінку
        </button>
      </div>
      <p style={{ maxWidth: 480, fontSize: 11, color: '#999', wordBreak: 'break-word' }}>
        {error.message}
        {error.digest ? ` · ${error.digest}` : ''}
        {markers ? ` · виявлено: ${markers}` : ''}
      </p>
    </main>
  )
}

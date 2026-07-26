'use client'

import { useEffect } from 'react'

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
  useEffect(() => {
    // Surface it in the browser console too (visible in DevTools).
    console.error('dashboard error boundary:', error)
    // DOM-mutation crashes (extension/translator rewrote React's nodes) are
    // transient: self-heal with ONE automatic reload per episode.
    if (/removeChild|insertBefore|appendChild|not a child/i.test(error.message || '')) {
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
      </p>
    </main>
  )
}

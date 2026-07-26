'use client'

import { useEffect } from 'react'

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
  useEffect(() => {
    console.error('locale error boundary:', error)
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
      </p>
    </main>
  )
}

'use client'

/**
 * Root error boundary: the last net, catching errors thrown in the locale
 * layout itself (below the root layout). Must render its own <html>/<body>.
 * Shows the message/digest so a root-level failure is diagnosable from a
 * screenshot instead of Next's opaque "Application error" text.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: '0 24px',
          textAlign: 'center',
          background: '#f4f3ef',
          color: '#111',
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
      </body>
    </html>
  )
}

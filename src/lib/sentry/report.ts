/**
 * Sends an error caught by a React error boundary to Sentry. Boundaries swallow
 * errors before window.onerror sees them, so they report explicitly.
 * Without NEXT_PUBLIC_SENTRY_DSN the branch is dead code and the SDK is not
 * even loaded.
 */
export function reportBoundaryError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  import('@sentry/nextjs')
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {})
}

/**
 * Server-side counterpart for errors a route handles itself (and therefore
 * never reach onRequestError) — e.g. a cron that keeps going after one item
 * fails. Await it (or the returned promise) before the handler returns, so
 * the event is flushed before the serverless function freezes. No-op without
 * a DSN.
 */
export async function reportServerError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, context ? { extra: context } : undefined)
    await Sentry.flush(2000)
  } catch {
    // Reporting must never break the caller.
  }
}

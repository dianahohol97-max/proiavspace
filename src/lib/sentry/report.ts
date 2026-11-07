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

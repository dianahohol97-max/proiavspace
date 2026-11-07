import { sentryEnabled } from './options'

/**
 * Reports a handled server-side error (one we deliberately swallow so the
 * user flow keeps working, e.g. Google Calendar being down during a booking).
 * Without a DSN it only writes a warning to the function log.
 */
export function reportServerError(error: unknown, context: Record<string, string> = {}): void {
  const message = error instanceof Error ? error.message : String(error)
  if (!sentryEnabled) {
    console.warn(`[handled] ${context.area ?? 'server'}: ${message}`)
    return
  }
  import('@sentry/nextjs')
    .then((Sentry) => Sentry.captureException(error, { tags: context }))
    .catch(() => {})
}

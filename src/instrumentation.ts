import { sentryEnabled } from '@/lib/sentry/options'

/**
 * Next.js instrumentation hook (server + edge). Loads Sentry only when
 * NEXT_PUBLIC_SENTRY_DSN is set; without it nothing is imported or started.
 */
export async function register() {
  if (!sentryEnabled) return
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

/** Errors from server components, route handlers and middleware. */
export async function onRequestError(...args: unknown[]) {
  if (!sentryEnabled) return
  const Sentry = await import('@sentry/nextjs')
  return (Sentry.captureRequestError as (...a: unknown[]) => void)(...args)
}

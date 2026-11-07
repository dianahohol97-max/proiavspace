import * as Sentry from '@sentry/nextjs'
import { sentryEnabled, sharedSentryOptions } from '@/lib/sentry/options'

// Browser. @sentry/nextjs injects this file into the client bundle (next.config.js
// wraps the config with withSentryConfig only when NEXT_PUBLIC_SENTRY_DSN is set).
if (sentryEnabled) {
  Sentry.init({
    ...sharedSentryOptions,
    // Browser extensions and translators rewrite the DOM and throw noise we cannot fix.
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

import * as Sentry from '@sentry/nextjs'
import { sharedSentryOptions } from '@/lib/sentry/options'

// Node.js runtime (route handlers, server components). Loaded from instrumentation.ts only when a DSN is set.
Sentry.init({ ...sharedSentryOptions })

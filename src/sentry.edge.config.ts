import * as Sentry from '@sentry/nextjs'
import { sharedSentryOptions } from '@/lib/sentry/options'

// Edge runtime (middleware). Loaded from instrumentation.ts only when a DSN is set.
Sentry.init({ ...sharedSentryOptions })

/**
 * Shared Sentry options for the browser, Node and edge runtimes.
 *
 * Off unless NEXT_PUBLIC_SENTRY_DSN is set: locally, in tests and in CI there
 * is no DSN, so `sentryEnabled` is false and Sentry.init is never called.
 *
 * Privacy: sendDefaultPii is off and every event/breadcrumb goes through
 * `scrubEvent` — emails, phone numbers, cookies, auth headers and secret URL
 * parameters (token, password, presigned-URL signatures…) are cut out before
 * anything leaves the process.
 */

/** Minimal event shape we touch — keeps this file free of a Sentry import (unit-testable in plain Node). */
export interface ScrubbableEvent {
  user?: unknown
  request?: {
    url?: string
    query_string?: unknown
    cookies?: unknown
    headers?: Record<string, string>
    data?: unknown
    env?: unknown
  }
  exception?: { values?: Array<{ type?: string; value?: string }> }
  message?: string
  logentry?: { message?: string; formatted?: string }
  extra?: Record<string, unknown>
}

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || ''
export const sentryEnabled = SENTRY_DSN.length > 0

const FILTERED = '[Filtered]'

/** Object keys whose values are never sent, wherever they appear. */
const SECRET_KEY =
  /^(cookie|cookies|set-cookie|authorization|proxy-authorization|x-forwarded-for|x-real-ip|cf-connecting-ip|password|passwd|pass|pwd|secret|token|access_token|refresh_token|id_token|api_?key|apikey|email|e-mail|phone|tel|telephone|ip_address)$/i

/** URL query parameters whose values are cut out. */
const SECRET_PARAM =
  /^(token|access_token|refresh_token|id_token|token_hash|password|pass|pwd|secret|code|key|api_?key|apikey|auth|signature|sig|email|phone|tel|ct|x-amz-[a-z-]+)$/i

/** Keys holding SDK-generated identifiers that must stay intact. */
const KEEP_KEY = /^(event_id|trace_id|span_id|parent_span_id|timestamp|start_timestamp|release|dist|environment|sdk|debug_meta|type|level|platform)$/

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// 10–14 digits with optional separators, optionally starting with "+"; not
// glued to letters, dots, slashes, colons or dashes (UUIDs, versions, paths).
const PHONE = /(?<![\w.:/#-])\+?\d(?:[\s().-]?\d){9,13}(?![\w])/g
// key=value inside any string (URLs, query strings, messages).
const URL_PARAM = /([?&#;]|^)([^=&#?\s]+)=([^&#\s]*)/g

function scrubParams(text: string): string {
  return text.replace(URL_PARAM, (whole, sep: string, key: string) => {
    let name = key
    try {
      name = decodeURIComponent(key)
    } catch {
      /* keep raw */
    }
    return SECRET_PARAM.test(name) ? `${sep}${key}=${FILTERED}` : whole
  })
}

export function scrubString(text: string): string {
  let out = text
  if (out.includes('=')) {
    // Only the part after "?" / "#" of a URL is a query; a bare "a=b&c=d" is too.
    out = out.replace(/[?#][^\s"'<>]*/g, (q) => scrubParams(q))
    if (/^[^\s/]*=/.test(out)) out = scrubParams(out)
  }
  return out.replace(EMAIL, '[email]').replace(PHONE, '[phone]')
}

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value)
  if (value === null || typeof value !== 'object' || depth > 12) return value
  if (seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubValue(value[i], depth + 1, seen)
    return value
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (KEEP_KEY.test(key)) continue
    if (SECRET_KEY.test(key)) {
      record[key] = FILTERED
      continue
    }
    record[key] = scrubValue(record[key], depth + 1, seen)
  }
  return value
}

const EXPECTED_ERRORS = [/refresh_token_not_found/i, /refresh token not found/i]

/** True for errors we expect and never want reported (stale Supabase refresh token in middleware). */
export function isExpectedError(event: ScrubbableEvent): boolean {
  const texts: string[] = []
  for (const ex of event.exception?.values ?? []) texts.push(`${ex.type ?? ''} ${ex.value ?? ''}`)
  if (event.message) texts.push(event.message)
  if (event.logentry?.message) texts.push(event.logentry.message)
  if (event.logentry?.formatted) texts.push(event.logentry.formatted)
  const extra = event.extra
  if (extra && typeof extra.code === 'string') texts.push(extra.code)
  return texts.some((t) => EXPECTED_ERRORS.some((re) => re.test(t)))
}

/** Removes personal data in place and returns the event (or null to drop it). */
export function scrubEvent<E extends object>(input: E): E | null {
  const event = input as ScrubbableEvent
  if (isExpectedError(event)) return null
  delete event.user
  if (event.request) {
    delete event.request.cookies
    delete event.request.env
    delete event.request.data
    if (typeof event.request.query_string !== 'undefined') event.request.query_string = FILTERED
    if (event.request.url) event.request.url = event.request.url.replace(/[?#].*$/, '')
  }
  scrubValue(event, 0, new WeakSet())
  return input
}

/** Breadcrumbs carry URLs (navigation, fetch) and console text — scrub them too. */
export function scrubBreadcrumb<B extends object>(crumb: B): B | null {
  scrubValue(crumb, 0, new WeakSet())
  return crumb
}

/** Options shared by Sentry.init in every runtime. */
export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  enabled: sentryEnabled,
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  // Errors only: no performance tracing, no session replay (cost + privacy).
  tracesSampleRate: 0,
  ignoreErrors: EXPECTED_ERRORS,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
}

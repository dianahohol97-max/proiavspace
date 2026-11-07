/**
 * proiav media CDN — a Cloudflare Worker in front of the PRIVATE Backblaze B2
 * bucket. Serves only gallery/portfolio variants (…/v/<uuid>-preview|thumb|poster|mobile.jpg,
 * and the WebP phone tile …/v/<uuid>-mobile.webp)
 * and caches them at Cloudflare's edge. Originals (…/o/…) and every other key
 * answer 404: they stay behind short-lived presigned URLs issued by the app.
 *
 * The bucket stays private. The Worker signs each origin request itself with
 * S3 SigV4 using a READ-ONLY B2 key scoped to this one bucket.
 *
 * Caching on *.workers.dev: the Cache API (caches.default) is a no-op there,
 * so the edge cache is the subrequest cache — fetch(..., { cf: { cacheEverything } }),
 * keyed by the origin URL. A presigned URL changes with every signing time,
 * which would make every request a miss, so the signature is pinned to a
 * 6-day window: the origin URL (and thus the cache key) stays the same for
 * six days, and is still valid ≥ 1 day after its window ends (SigV4 allows 7).
 * On a custom domain caches.default also works and is used first.
 *
 * Keys are immutable (fresh UUID per upload), so browsers may cache forever.
 *
 * Env (wrangler.toml [vars] + secrets):
 *   B2_BUCKET, B2_REGION              — vars, e.g. "proiav-media", "us-east-005"
 *   B2_KEY_ID, B2_APPLICATION_KEY     — secrets, read-only key for this bucket
 *   EDGE_CACHE_SECONDS (optional)     — edge TTL, default 7 days
 */

export interface Env {
  B2_BUCKET: string
  B2_REGION: string
  B2_KEY_ID: string
  B2_APPLICATION_KEY: string
  /** Optional, e.g. "https://s3.us-east-005.backblazeb2.com"; default is built from B2_REGION. */
  S3_ENDPOINT?: string
  EDGE_CACHE_SECONDS?: string
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Only variants: u/<user>/g/<gallery>/v/<uuid>-<variant>.jpg or u/<user>/portfolio/v/<uuid>-<variant>.jpg,
 * plus the phone grid tile <uuid>-mobile.webp (JPEG where the browser couldn't encode WebP).
 */
const VARIANT_KEY =
  /^u\/[A-Za-z0-9-]{1,64}\/(?:g\/[A-Za-z0-9-]{1,64}\/|portfolio\/)v\/[A-Za-z0-9-]{1,64}-(?:(?:preview|thumb|poster|mobile)\.jpg|mobile\.webp)$/

const BROWSER_CACHE = 'public, max-age=31536000, immutable'
// 7 days, not longer: previews are unsigned through the CDN, so after a gallery
// is deleted or its password changes they must drop out of the edge cache soon.
const DEFAULT_EDGE_SECONDS = 7 * 24 * 60 * 60
const SIGN_WINDOW_SECONDS = 6 * 24 * 60 * 60
const SIGN_EXPIRES_SECONDS = 7 * 24 * 60 * 60 // SigV4 maximum

export function isServableKey(key: string): boolean {
  return VARIANT_KEY.test(key) && !key.includes('/o/') && !key.includes('..')
}

// ---------------------------------------------------------------- SigV4 ----

const encoder = new TextEncoder()

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

async function hmac(key: BufferSource, text: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(text))
}

/** RFC 3986 encoding as S3 expects ('/' kept in paths). */
export function s3Encode(text: string, keepSlash = false): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(keepSlash ? /%2F/g : /$^/, '/')
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export interface PresignInput {
  /** e.g. https://s3.us-east-005.backblazeb2.com */
  endpoint: string
  /** Already-decoded object path after the host, e.g. "/bucket/u/…/v/x.jpg". */
  path: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  signingDate: Date
  expiresSeconds: number
  /** Extra signed query parameters (tests compare against the AWS SDK, which adds a few). */
  extraQuery?: [string, string][]
}

/** Query-string SigV4 presigned GET (UNSIGNED-PAYLOAD), same as the AWS SDK's getSignedUrl. */
export async function presignGet(input: PresignInput): Promise<string> {
  const host = new URL(input.endpoint).host
  const stamp = amzDate(input.signingDate)
  const day = stamp.slice(0, 8)
  const scope = `${day}/${input.region}/s3/aws4_request`
  const canonicalPath = s3Encode(input.path, true)
  const params: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${input.accessKeyId}/${scope}`],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', String(input.expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
    ...(input.extraQuery ?? []),
  ]
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const query = params.map(([k, v]) => `${s3Encode(k)}=${s3Encode(v)}`).join('&')
  const canonicalRequest = ['GET', canonicalPath, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, await sha256Hex(canonicalRequest)].join('\n')
  let key: ArrayBuffer = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`) as BufferSource, day)
  key = await hmac(key, input.region)
  key = await hmac(key, 's3')
  key = await hmac(key, 'aws4_request')
  const signature = hex(await hmac(key, stringToSign))
  return `${input.endpoint.replace(/\/+$/, '')}${canonicalPath}?${query}&X-Amz-Signature=${signature}`
}

/** Start of the current signing window — the same for every request in it. */
export function signingWindowStart(now: number): Date {
  const windowMs = SIGN_WINDOW_SECONDS * 1000
  return new Date(Math.floor(now / windowMs) * windowMs)
}

// --------------------------------------------------------------- handler ----

function plain(status: number, cacheControl: string): Response {
  return new Response(status === 404 ? 'Not found' : 'Error', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cacheControl },
  })
}

function decodeKey(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname.replace(/^\/+/, ''))
  } catch {
    return null
  }
}

export async function handle(request: Request, env: Env, ctx: Ctx, now = Date.now()): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  const url = new URL(request.url)
  const key = decodeKey(url.pathname)
  // Originals, logos, social videos, anything that is not a variant: 404.
  if (!key || !isServableKey(key)) return plain(404, 'public, max-age=3600')

  // Query strings are ignored: ?x=random must not bypass the cache.
  const cacheKey = new Request(`${url.origin}/${s3Encode(key, true)}`, { method: 'GET' })
  const edge = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
  let response = edge ? await edge.match(cacheKey) : undefined

  if (!response) {
    const endpoint = env.S3_ENDPOINT || `https://s3.${env.B2_REGION}.backblazeb2.com`
    const origin = await presignGet({
      endpoint,
      path: `/${env.B2_BUCKET}/${key}`,
      region: env.B2_REGION,
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
      signingDate: signingWindowStart(now),
      expiresSeconds: SIGN_EXPIRES_SECONDS,
    })
    const edgeSeconds = Number(env.EDGE_CACHE_SECONDS) || DEFAULT_EDGE_SECONDS
    let upstream: Response
    try {
      upstream = await fetch(origin, {
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': edgeSeconds, '404': 60, '400-403': 0, '500-599': 0 } },
      } as RequestInit)
    } catch {
      return plain(502, 'no-store')
    }
    // B2 answers 404 for a missing key and 403 if a deleted file's key is probed — both are "not here".
    if (upstream.status === 404 || upstream.status === 403) return plain(404, 'public, max-age=60')
    if (!upstream.ok || !upstream.body) return plain(502, 'no-store')

    const headers = new Headers()
    for (const name of ['Content-Type', 'Content-Length', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('Cache-Control', BROWSER_CACHE)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    // Whether the subrequest came from Cloudflare's cache (HIT) or from B2 (MISS).
    headers.set('X-Origin-Cache', upstream.headers.get('CF-Cache-Status') ?? 'NONE')
    response = new Response(upstream.body, { status: 200, headers })
    if (edge) ctx.waitUntil(edge.put(cacheKey, response.clone()))
  }

  const etag = response.headers.get('ETag')
  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': BROWSER_CACHE } })
  }
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers: response.headers })
  return response
}

export default {
  fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    return handle(request, env, ctx)
  },
}

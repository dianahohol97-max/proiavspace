/**
 * Network plumbing for uploads: one shared limit on concurrent transfers, a
 * PUT that notices a silent stall, and a retry policy that waits out an
 * outage instead of failing the file. Browser-only at runtime (XHR), but no
 * React and no module-level DOM access, so tests can drive the pure parts.
 */

/**
 * Concurrent storage requests across ALL files of the page (originals, parts,
 * renditions). 6 = Chrome's per-host HTTP/1.1 connection limit: more would
 * only queue inside the browser (where a queued XHR's stall timer would tick
 * without any chance to send), fewer leaves the link idle while one request
 * waits for its response. Measured in docs/UPLOAD_PERF.md.
 */
export const TRANSFER_CONCURRENCY = 6

/** No upload progress for this long → the connection is dead, retry. */
export const STALL_MS = 20_000
/** Body sent, no response for this long → retry (B2 normally answers in < 1 s). */
export const RESPONSE_TIMEOUT_MS = 60_000
/** Network errors are retried until nothing has worked for this long. */
export const NETWORK_GIVE_UP_MS = 15 * 60_000
/** 5xx / 429 / 408 answers are retried this many times. */
export const HTTP_RETRIES = 5

/** Higher runs first; equal priority is FIFO (so files finish in order). */
export const PRIORITY_RENDITION = 2
export const PRIORITY_ORIGINAL = 1

/** Small priority semaphore. */
export class RequestPool {
  private active = 0
  private seq = 0
  private readonly queue: { priority: number; seq: number; start: () => void }[] = []

  constructor(private readonly limit: number) {}

  get running(): number {
    return this.active
  }

  async run<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((start) => {
        this.queue.push({ priority, seq: this.seq++, start })
        this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq)
      })
    } else {
      this.active++
    }
    try {
      return await task()
    } finally {
      const next = this.queue.shift()
      if (next) next.start()
      else this.active--
    }
  }
}

export const transferPool = new RequestPool(TRANSFER_CONCURRENCY)

/** The storage (or our API) answered with a non-2xx status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/** No answer at all: offline, connection reset, stalled, timed out. */
export class NetworkError extends Error {}

export interface PutResult {
  /** null when the response carries no readable ETag (bucket CORS, see docs/MANUAL_TASKS.md). */
  etag: string | null
}

/**
 * PUT a blob with progress. Rejects with NetworkError when the connection
 * goes silent (no progress for STALL_MS, or no response RESPONSE_TIMEOUT_MS
 * after the body was sent) — a dropped Wi-Fi otherwise leaves an XHR hanging
 * for minutes.
 */
export function putBlob(
  url: string,
  body: Blob,
  options: { contentType?: string; onProgress?: (loadedBytes: number) => void } = {}
): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let timer: ReturnType<typeof setTimeout> | null = null
    let settled = false
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (settled) return
        settled = true
        xhr.abort()
        reject(new NetworkError('upload stalled'))
      }, ms)
    }
    const finish = () => {
      settled = true
      if (timer) clearTimeout(timer)
    }
    xhr.open('PUT', url)
    if (options.contentType) xhr.setRequestHeader('Content-Type', options.contentType)
    xhr.upload.onprogress = (event) => {
      arm(STALL_MS)
      if (event.lengthComputable) options.onProgress?.(event.loaded)
    }
    xhr.upload.onload = () => arm(RESPONSE_TIMEOUT_MS)
    xhr.onload = () => {
      if (settled) return
      finish()
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(body.size)
        const etag = xhr.getResponseHeader('ETag')
        resolve({ etag: etag ? etag.replaceAll('"', '') : null })
      } else {
        reject(new HttpError(xhr.status, `PUT ${xhr.status}`))
      }
    }
    xhr.onerror = () => {
      if (settled) return
      finish()
      reject(new NetworkError('upload network error'))
    }
    xhr.onabort = () => {
      if (settled) return
      finish()
      reject(new NetworkError('upload aborted'))
    }
    arm(STALL_MS)
    xhr.send(body)
  })
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

/** Backoff for the n-th retry (0-based): 1, 2, 4, 8, then 15 s, ±20 % jitter. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000)
  return Math.round(base * (0.8 + 0.4 * random()))
}

/**
 * Sleep `ms`, or less: wakes as soon as the browser reports it is back
 * online; while it reports offline, waits for that instead of polling.
 */
export function waitForNetwork(ms: number): Promise<void> {
  if (typeof window === 'undefined') return new Promise((resolve) => setTimeout(resolve, ms))
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('online', done)
      resolve()
    }
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    // Offline: the 'online' event is the signal, the timer only a safety net.
    const timer = setTimeout(done, offline ? Math.max(ms, 30_000) : ms)
    window.addEventListener('online', done)
  })
}

export interface RetryHooks {
  /** A presigned URL expired/was refused (401/403): get a fresh one, once. */
  onAuthRefused?: () => Promise<void>
  /** Called before each wait, e.g. to show «waiting for network». */
  onRetry?: (error: unknown, attempt: number) => void
  /** Called on the first success after a failure. */
  onRecovered?: () => void
  /** How to wait between attempts (tests); default waitForNetwork. */
  wait?: (ms: number) => Promise<void>
}

/**
 * Run `attempt` until it succeeds:
 *   - network errors: retried with backoff while anything has worked within
 *     NETWORK_GIVE_UP_MS (a 30 s outage is just a pause);
 *   - 5xx/429/408: up to HTTP_RETRIES times;
 *   - 401/403: `onAuthRefused` once (fresh URL), then fatal;
 *   - anything else: thrown straight away.
 */
export async function withRetries<T>(
  attempt: () => Promise<T>,
  hooks: RetryHooks = {},
  now: () => number = Date.now
): Promise<T> {
  let httpFailures = 0
  let refreshed = false
  let failures = 0
  const since = now()
  for (;;) {
    try {
      const result = await attempt()
      if (failures > 0) hooks.onRecovered?.()
      return result
    } catch (error) {
      if (error instanceof HttpError) {
        if ((error.status === 401 || error.status === 403) && hooks.onAuthRefused && !refreshed) {
          refreshed = true
          await hooks.onAuthRefused()
          continue
        }
        if (!isRetryableStatus(error.status) || httpFailures >= HTTP_RETRIES) throw error
        httpFailures++
      } else if (error instanceof NetworkError) {
        if (now() - since > NETWORK_GIVE_UP_MS) throw error
      } else {
        throw error
      }
      hooks.onRetry?.(error, failures)
      await (hooks.wait ?? waitForNetwork)(backoffMs(Math.min(failures, 6)))
      failures++
    }
  }
}

/**
 * fetch() → NetworkError on a failed connection, so API calls (presign,
 * complete…) ride the same retry policy as storage PUTs.
 */
export async function fetchOrNetworkError(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new NetworkError(`fetch ${input}: ${String(cause)}`)
  }
}

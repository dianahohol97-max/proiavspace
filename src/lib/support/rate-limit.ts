import { createHash } from 'node:crypto'

/**
 * A sliding one-hour window per key, in this server instance's memory. On
 * serverless every warm instance has its own copy, so the route also counts
 * saved requests in support_requests (migration 0069) and refuses when either
 * says «too many». Without the table this is the only guard — still enough to
 * stop one script from hammering one instance.
 */
export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(private readonly windowMs = 60 * 60 * 1000) {}

  /** How many hits the key has in the current window. */
  count(key: string, now = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length) this.hits.set(key, recent)
    else this.hits.delete(key)
    return recent.length
  }

  hit(key: string, now = Date.now()): void {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    recent.push(now)
    this.hits.set(key, recent)
    // Keep the map from growing without bound under a flood of new IPs.
    if (this.hits.size > 5000) {
      for (const k of this.hits.keys()) {
        if (this.count(k, now) === 0) this.hits.delete(k)
      }
    }
  }

  reset(): void {
    this.hits.clear()
  }
}

/** One limiter per instance, shared by the submit and the upload route. */
export const supportLimiter = new MemoryRateLimiter()

/** We never store the IP itself — only a hash, enough to count per hour. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`proiav-support:${ip}`).digest('hex').slice(0, 32)
}

/** The client IP as Vercel passes it (first hop of x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

'use client'

/**
 * Uploads from a phone: when the app is switched away (or the screen locks)
 * the OS suspends the page and in-flight requests die with a network error.
 * The uploader then waits here until the app is visible AND online again and
 * repeats the file (the server answers 409 for a file that did land, which
 * the uploader counts as done). See components/Uploader.
 */
export function isForeground(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine !== false)
}

/**
 * Was the upload cut off (app in the background, network gone, a dropped
 * request, a 5xx) — worth repeating — rather than refused by the server
 * (quota, plan, bad file), which repeating would not fix?
 */
export function isInterruption(error: unknown): boolean {
  if (!isForeground()) return true
  if (error instanceof TypeError) return true // fetch() network failure
  const message = error instanceof Error ? error.message : String(error)
  return /network|status 0\b|\b5\d\d\b|abort|timeout|Load failed/i.test(message)
}

/** Resolves once the page is visible and online (immediately if it already is). */
export function waitForForeground(): Promise<void> {
  if (isForeground()) return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (!isForeground()) return
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      window.removeEventListener('focus', check)
      resolve()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
  })
}

type WakeLockSentinelLike = { release(): Promise<void> }

/**
 * Keeps the phone screen on while uploads run (Screen Wake Lock), so it does
 * not lock and suspend the page. Re-acquired after the app comes back.
 * Returns a release function; a no-op where the API is missing.
 */
export function holdScreenAwake(): () => void {
  const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock
  if (!wakeLock) return () => {}
  let sentinel: WakeLockSentinelLike | null = null
  let active = true
  const acquire = () => {
    if (!active || document.visibilityState !== 'visible') return
    wakeLock
      .request('screen')
      .then((lock) => {
        if (active) sentinel = lock
        else void lock.release().catch(() => {})
      })
      .catch(() => {})
  }
  acquire()
  document.addEventListener('visibilitychange', acquire)
  return () => {
    active = false
    document.removeEventListener('visibilitychange', acquire)
    void sentinel?.release().catch(() => {})
    sentinel = null
  }
}

'use client'

/** Browser side of the photographer's notifications (see lib/push/send.ts). */

export const APP_SW_URL = '/dashboard-sw.js'

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function appRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return (
      (await navigator.serviceWorker.getRegistration('/')) ??
      (await navigator.serviceWorker.register(APP_SW_URL, { scope: '/' }))
    )
  } catch {
    return null
  }
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const registration = await appRegistration()
  return (await registration?.pushManager.getSubscription().catch(() => null)) ?? null
}

export type SubscribeOutcome = 'ok' | 'denied' | 'unsupported' | 'not_configured' | 'migration' | 'error'

/** Asks for permission (must run from a tap), subscribes, saves on the server. */
export async function subscribeToPush(publicKey: string, locale: string): Promise<SubscribeOutcome> {
  if (!pushSupported()) return 'unsupported'
  if (!publicKey) return 'not_configured'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const registration = await appRegistration()
  if (!registration) return 'unsupported'
  await navigator.serviceWorker.ready
  let subscription: PushSubscription
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }))
  } catch {
    return 'error'
  }
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON(), locale }),
  }).catch(() => null)
  if (!response) return 'error'
  if (response.ok) return 'ok'
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (body?.error === 'migration_required') return 'migration'
  if (body?.error === 'not_configured') return 'not_configured'
  return 'error'
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null)
  await subscription.unsubscribe().catch(() => false)
}

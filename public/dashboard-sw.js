/* Service worker of the photographer's phone app (dashboard PWA).
 *
 * Registered by components/app/AppShell from dashboard pages only. Scope is
 * the whole origin (the app starts at /dashboard, the dashboard lives under
 * /<locale>/dashboard), but it deliberately touches almost nothing:
 *
 *   - /api/*, uploads (PUT/POST to storage), any non-GET and cross-origin
 *     request: never intercepted — they go to the network exactly as before;
 *   - public pages, galleries, Next assets: not intercepted either;
 *   - dashboard page navigations: network first; offline → /app/offline.html
 *     (a self-contained page: «немає інтернету» + the offline portfolio);
 *   - /__portfolio/*: the offline portfolio photos, from Cache Storage only.
 *
 * Plus Web Push: show the notification, open the dashboard on tap.
 */
const SHELL_CACHE = 'proiav-app-shell-v1'
const PORTFOLIO_CACHE = 'proiav-portfolio-v1'
const OFFLINE_URL = '/app/offline.html'
const SHELL_FILES = [OFFLINE_URL, '/app/icon-192.png', '/app/badge-96.png']
const DASHBOARD_PATH = /^\/(?:(?:uk|en|pl|de|es|fr|it|ro|pt)\/)?dashboard(?:\/|$)/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Old shell versions go; the portfolio is the photographer's data and stays.
            .filter((key) => key.startsWith('proiav-app-shell-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

async function offlineResponse() {
  const cached = await caches.match(OFFLINE_URL, { ignoreSearch: true })
  return (
    cached ||
    new Response('<!doctype html><meta charset="utf-8"><title>проЯв</title><p>Немає інтернету / No connection</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return

  if (url.pathname.startsWith('/__portfolio/')) {
    event.respondWith(
      caches
        .open(PORTFOLIO_CACHE)
        .then((cache) => cache.match(url.pathname))
        .then((hit) => hit || new Response('', { status: 404 }))
    )
    return
  }

  if (url.pathname === OFFLINE_URL) {
    event.respondWith(
      fetch(request).catch(() => offlineResponse())
    )
    return
  }

  if (request.mode === 'navigate' && DASHBOARD_PATH.test(url.pathname)) {
    event.respondWith(fetch(request).catch(() => offlineResponse()))
  }
})

/* ---------------- Web Push ---------------- */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'проЯв'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/app/icon-192.png',
      badge: '/app/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => DASHBOARD_PATH.test(new URL(client.url).pathname))
      if (open && 'navigate' in open) {
        return open.navigate(target.href).then((client) => (client || open).focus())
      }
      return self.clients.openWindow(target.href)
    })
  )
})

// The push service rotated the subscription: save the new one (cookies go
// along, so the server knows whose it is). Best effort.
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription && event.oldSubscription.options
  if (!options || !options.applicationServerKey) return
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
      .then((subscription) =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
          const match = windows.map((client) => /^\/([a-z]{2})\//.exec(new URL(client.url).pathname)).find(Boolean)
          return fetch('/api/push/subscribe', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON(), locale: match ? match[1] : 'uk' }),
          })
        })
      )
      .catch(() => {})
  )
})

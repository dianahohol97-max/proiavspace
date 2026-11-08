import type { Metadata } from 'next'

/**
 * Web app manifest of the photographer's dashboard (the phone app «проЯв»).
 * Separate from the marketing site's /manifest.webmanifest: this one starts
 * in the dashboard (/dashboard → the middleware picks the language) and is
 * linked only from dashboard pages. Served by app/dashboard.webmanifest.
 */
export const APP_MANIFEST_PATH = '/dashboard.webmanifest'
export const APP_THEME_COLOR = '#f4f4f1'

export function dashboardManifest(
  locale: string,
  t: { manifestDescription: string; quickNewGallery: string; quickOffline: string }
) {
  return {
    id: '/dashboard',
    name: 'проЯв',
    short_name: 'проЯв',
    description: t.manifestDescription,
    lang: locale,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: APP_THEME_COLOR,
    theme_color: APP_THEME_COLOR,
    categories: ['photo', 'productivity', 'business'],
    icons: [
      { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/app/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: t.quickNewGallery,
        url: '/dashboard/galleries/new',
        icons: [{ src: '/app/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: t.quickOffline,
        url: '/dashboard/offline',
        icons: [{ src: '/app/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}

/** <head> of every dashboard page: the app manifest, iPhone home-screen icon/title. */
export function appMetadata(locale: string): Metadata {
  return {
    manifest: `${APP_MANIFEST_PATH}?lang=${locale}`,
    appleWebApp: { capable: true, title: 'проЯв', statusBarStyle: 'default' },
    icons: { icon: '/icon.svg', apple: '/app/apple-touch-icon.png' },
  }
}

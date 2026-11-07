'use client'

import { useEffect } from 'react'
import '@/lib/app/install'
import { APP_SW_URL } from '@/lib/push/client'

const OFFLINE_REFRESH_KEY = 'proiav-offline-page-at'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Mounted on every dashboard page (layout): registers the phone app's service
 * worker (public/dashboard-sw.js), remembers the dashboard language for the
 * app's start page (/dashboard → middleware), and once a day refreshes the
 * cached offline screen so a new deploy's version reaches phones.
 * Renders nothing; every step is optional and fails silently.
 */
export function AppShell({ locale }: { locale: string }) {
  useEffect(() => {
    document.cookie = `dash_locale=${locale}; path=/; max-age=31536000; samesite=lax`
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register(APP_SW_URL, { scope: '/' }).catch(() => {})
    try {
      const last = Number(localStorage.getItem(OFFLINE_REFRESH_KEY) ?? 0)
      if (Date.now() - last > DAY_MS && 'caches' in window) {
        void caches
          .open('proiav-app-shell-v1')
          .then((cache) => cache.add(new Request('/app/offline.html', { cache: 'reload' })))
          .then(() => localStorage.setItem(OFFLINE_REFRESH_KEY, String(Date.now())))
          .catch(() => {})
      }
    } catch {
      // localStorage blocked (private mode): skip the refresh.
    }
  }, [locale])
  return null
}

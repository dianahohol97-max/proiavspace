'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  currentPushSubscription,
  isIos,
  isStandalone,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push/client'
import { DEFAULT_PUSH_PREFERENCES, PUSH_KINDS, type PushKind, type PushPreferences } from '@/lib/push/kinds'
import type { Dictionary } from '@/lib/i18n'

type Support = 'checking' | 'ok' | 'unsupported' | 'ios-browser'

/**
 * Settings → «Сповіщення на телефон»: turn push on for THIS device, choose
 * each type separately (push_preferences), send a test. Without browser
 * permission / support nothing breaks — the block just says why.
 */
export function NotificationSettings({
  t,
  locale,
  publicKey,
  showBooking = true,
}: {
  t: Dictionary['app']
  locale: string
  /** VAPID public key; empty until the keys are set on the server. */
  publicKey: string
  /** «Нове бронювання» switch — off while booking is shelved (src/lib/features/sites.ts). */
  showBooking?: boolean
}) {
  const [support, setSupport] = useState<Support>('checking')
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'n/a'>('n/a')
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES)
  const [migration, setMigration] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  useEffect(() => {
    if (!pushSupported()) {
      setSupport(isIos() && !isStandalone() ? 'ios-browser' : 'unsupported')
      return
    }
    setSupport('ok')
    setPermission(Notification.permission)
    void currentPushSubscription().then((subscription) => setSubscribed(Boolean(subscription)))
  }, [])

  useEffect(() => {
    void fetch('/api/push/preferences')
      .then(async (response) => {
        if (response.status === 503) {
          setMigration(true)
          return
        }
        if (!response.ok) return
        const body = (await response.json()) as { preferences?: PushPreferences }
        if (body.preferences) setPrefs(body.preferences)
      })
      .catch(() => {})
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    const outcome = await subscribeToPush(publicKey, locale)
    setBusy(false)
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
    if (outcome === 'ok') {
      setSubscribed(true)
      return
    }
    const text = {
      denied: t.notifyDenied,
      unsupported: t.notifyUnsupported,
      not_configured: t.notifyNotConfigured,
      migration: t.notifyMigration,
      error: t.notifyError,
    }[outcome]
    setMessage({ tone: 'warn', text })
  }, [locale, publicKey, t])

  const disable = useCallback(async () => {
    setBusy(true)
    await unsubscribeFromPush()
    setBusy(false)
    setSubscribed(false)
  }, [])

  const toggle = useCallback(
    async (kind: PushKind, value: boolean) => {
      const previous = prefs
      setPrefs({ ...prefs, [kind]: value })
      setMessage(null)
      const response = await fetch('/api/push/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [kind]: value }),
      }).catch(() => null)
      if (response?.ok) {
        const body = (await response.json()) as { preferences: PushPreferences }
        setPrefs(body.preferences)
        setMessage({ tone: 'ok', text: t.notifySaved })
        return
      }
      setPrefs(previous)
      if (response?.status === 503) setMigration(true)
      setMessage({ tone: 'warn', text: response?.status === 503 ? t.notifyMigration : t.notifyError })
    },
    [prefs, t]
  )

  const test = useCallback(async () => {
    setBusy(true)
    const response = await fetch('/api/push/test', { method: 'POST' }).catch(() => null)
    setBusy(false)
    setMessage(response?.ok ? { tone: 'ok', text: t.notifyTestSent } : { tone: 'warn', text: t.notifyError })
  }, [t])

  const labels: Record<PushKind, string> = {
    client_picks: t.notifyTypeClientPicks,
    first_view: t.notifyTypeFirstView,
    booking: t.notifyTypeBooking,
    storage_low: t.notifyTypeStorageLow,
    gallery_expiring: t.notifyTypeGalleryExpiring,
  }

  const notConfigured = !publicKey
  return (
    <section className="rounded-3xl border border-line bg-white p-5" data-testid="notify-settings">
      <h2 className="text-lg font-extrabold">{t.notifyTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t.notifyLede}</p>

      {support === 'ios-browser' && (
        <p className="mt-4 rounded-2xl bg-bg p-4 text-sm leading-relaxed" data-testid="notify-ios">
          {t.notifyUnsupported}
        </p>
      )}
      {support === 'unsupported' && (
        <p className="mt-4 rounded-2xl bg-bg p-4 text-sm leading-relaxed">{t.notifyUnsupported}</p>
      )}
      {notConfigured && support === 'ok' && (
        <p className="mt-4 rounded-2xl bg-bg p-4 text-sm leading-relaxed">{t.notifyNotConfigured}</p>
      )}
      {migration && <p className="mt-4 rounded-2xl bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-900">{t.notifyMigration}</p>}

      {support === 'ok' && !notConfigured && (
        <div className="mt-4 flex flex-col gap-2">
          {subscribed ? (
            <>
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-700" data-testid="notify-on">
                <span aria-hidden="true">●</span> {t.notifyEnabled}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={test}
                  disabled={busy}
                  className="min-h-12 rounded-full border border-line px-5 text-sm font-bold disabled:opacity-50"
                  data-testid="notify-test"
                >
                  {t.notifyTest}
                </button>
                <button
                  type="button"
                  onClick={disable}
                  disabled={busy}
                  className="min-h-12 rounded-full px-5 text-sm font-bold text-muted underline disabled:opacity-50"
                >
                  {t.notifyDisable}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={enable}
              disabled={busy || permission === 'denied'}
              className="min-h-[52px] rounded-full bg-accent px-6 text-base font-bold text-white disabled:opacity-50"
              data-testid="notify-enable"
            >
              {t.notifyEnable}
            </button>
          )}
          {permission === 'denied' && !subscribed && (
            <p className="text-sm leading-relaxed text-muted">{t.notifyDenied}</p>
          )}
        </div>
      )}

      <fieldset className="mt-5" disabled={migration}>
        <legend className="text-[11px] font-extrabold uppercase tracking-widest text-muted">{t.notifyTypesTitle}</legend>
        <div className="mt-2 divide-y divide-line">
          {PUSH_KINDS.filter((kind) => showBooking || kind !== 'booking').map((kind) => (
            <label key={kind} className="flex min-h-[56px] cursor-pointer items-center gap-3 py-2">
              <span className="flex-1 text-[15px] leading-snug">{labels[kind]}</span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[kind]}
                onChange={(event) => void toggle(kind, event.target.checked)}
                className="peer sr-only"
                data-testid={`notify-pref-${kind}`}
              />
              <span
                aria-hidden="true"
                className="relative h-7 w-12 flex-none rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${message.tone === 'ok' ? 'text-emerald-700' : 'text-amber-800'}`}
          data-testid="notify-message"
        >
          {message.text}
        </p>
      )}
    </section>
  )
}

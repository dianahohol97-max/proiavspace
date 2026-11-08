'use client'

import { useEffect, useState } from 'react'
import { onInstallPrompt, promptInstall } from '@/lib/app/install'
import { isIos, isStandalone } from '@/lib/push/client'
import type { Dictionary } from '@/lib/i18n'

const DISMISS_KEY = 'proiav-install-hidden'

/**
 * «Встановити на телефон». Chrome/Android: the browser's own install dialog.
 * iPhone (Safari has no such dialog): the three steps via «Поділитися».
 * Elsewhere: where to find «Install app» in the browser menu. Hidden inside
 * the installed app. `dismissible`: the home-screen card can be hidden.
 */
export function InstallAppCard({ t, dismissible = false }: { t: Dictionary['app']; dismissible?: boolean }) {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios' | 'other' | 'installed'>('hidden')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isStandalone()) return setMode('hidden')
    try {
      if (dismissible && localStorage.getItem(DISMISS_KEY) === '1') return setMode('hidden')
    } catch {
      // ignore
    }
    if (isIos()) {
      setMode('ios')
      return
    }
    setMode('other')
    return onInstallPrompt((event) => setMode((prev) => (event ? 'prompt' : prev === 'prompt' ? 'other' : prev)))
  }, [dismissible])

  if (mode === 'hidden') return null

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm" data-testid="install-card">
      <div className="flex items-start gap-3">
        <img src="/app/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 flex-none rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold leading-tight">{t.installTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {mode === 'installed' ? t.installed : t.installLede}
          </p>
        </div>
        {dismissible && (
          <button
            type="button"
            className="-mr-2 -mt-2 min-h-11 min-w-11 rounded-full text-sm font-bold text-muted"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, '1')
              } catch {
                // ignore
              }
              setMode('hidden')
            }}
            aria-label={t.installDismiss}
          >
            ✕
          </button>
        )}
      </div>
      {mode !== 'installed' && (
        <button
          type="button"
          data-testid="install-button"
          className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-white"
          onClick={async () => {
            if (mode === 'prompt') {
              if (await promptInstall()) setMode('installed')
              return
            }
            setOpen((value) => !value)
          }}
          aria-expanded={mode === 'prompt' ? undefined : open}
        >
          {t.installButton}
        </button>
      )}
      {open && mode === 'ios' && (
        <div className="mt-4 rounded-2xl bg-bg p-4" data-testid="install-ios">
          <p className="text-sm font-extrabold">{t.installIosTitle}</p>
          <ol className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
            {[t.installIosStep1, t.installIosStep2, t.installIosStep3].map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t.installIosNote}</p>
        </div>
      )}
      {open && mode === 'other' && (
        <p className="mt-4 rounded-2xl bg-bg p-4 text-sm leading-relaxed" data-testid="install-other">
          {t.installOtherHint}
        </p>
      )}
    </section>
  )
}

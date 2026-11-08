'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { SUPPORT_MAILTO, SupportForm, type SupportAccount } from './SupportForm'

/** Fired by every «Допомога» button; the one panel in the dashboard layout listens. */
export const SUPPORT_OPEN_EVENT = 'proiav:support-open'

export function openSupport() {
  window.dispatchEvent(new Event(SUPPORT_OPEN_EVENT))
}

/** «? Допомога» — in the sidebar, and in the mobile menu. */
export function SupportButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      data-testid="support-open"
      onClick={openSupport}
      className={
        className ??
        'flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-bold text-muted transition-colors hover:bg-bg hover:text-fg'
      }
    >
      <span
        aria-hidden
        className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-current text-[11px] font-extrabold leading-none"
      >
        ?
      </span>
      {label}
    </button>
  )
}

/**
 * The dashboard's support drawer: a panel on the right (full screen on a
 * phone) with the support form. Mounted once in the dashboard layout, so the
 * mobile menu can close itself without unmounting a half-written message.
 */
export function SupportPanel({ locale, t, account }: { locale: string; t: Dictionary['support']; account: SupportAccount }) {
  const [open, setOpen] = useState(false)
  // Remount the form on each opening after a successful send, not on every close.
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <button
        type="button"
        aria-label={t.close}
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/30"
      />
      <div
        data-testid="support-panel"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 id="support-title" className="text-xl font-extrabold text-fg">
            {t.panelTitle}
          </h2>
          <button
            type="button"
            aria-label={t.close}
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-line text-fg"
          >
            ✕
          </button>
        </div>
        <p className="mb-2 text-sm leading-6 text-muted">{t.panelLead}</p>
        <a href={`mailto:${SUPPORT_MAILTO}`} data-testid="support-mailto" className="mb-5 self-start text-sm font-bold text-accent underline">
          {t.mailLink}
        </a>
        <SupportForm
          key={formKey}
          locale={locale}
          t={t}
          account={account}
          onClose={() => {
            setOpen(false)
            setFormKey((k) => k + 1)
          }}
        />
      </div>
    </div>
  )
}

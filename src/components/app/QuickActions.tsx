'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { timeAgo, type AppEvent } from '@/lib/app/events'
import { formatSlotShort } from '@/lib/app/format'
import type { Dictionary } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n/format'

/**
 * Phone home screen of the dashboard: big one-thumb buttons at the bottom of
 * reach («Нова галерея», «Поділитися останньою», «Портфоліо офлайн») and
 * the latest client events. Desktop keeps the usual header buttons.
 */
export function QuickActions({
  t,
  locale,
  lastPublished,
  events,
}: {
  t: Dictionary['app']
  locale: string
  lastPublished: { title: string; url: string } | null
  events: AppEvent[]
}) {
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  async function share() {
    if (!lastPublished) return
    const data = { title: lastPublished.title, url: lastPublished.url }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data)
        return
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(lastPublished.url)
      setToast(t.quickShareCopied)
    } catch {
      window.prompt(t.quickShareLast, lastPublished.url)
    }
  }

  const big =
    'flex min-h-[64px] w-full items-center justify-center gap-2 rounded-3xl px-5 text-[17px] font-extrabold no-underline transition-transform active:scale-[.98]'

  return (
    <section className="flex flex-col gap-4" data-testid="quick-actions">
      <div className="grid grid-cols-1 gap-3">
        <Link href={`/${locale}/dashboard/galleries/new`} className={`${big} bg-accent text-white`} data-testid="quick-new">
          <span aria-hidden="true" className="text-2xl leading-none">+</span> {t.quickNewGallery}
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={share}
            disabled={!lastPublished}
            className={`${big} flex-col gap-0.5 bg-white text-fg shadow-sm disabled:opacity-50`}
            data-testid="quick-share"
          >
            <span>{t.quickShareLast}</span>
            <span className="max-w-full truncate text-xs font-semibold text-muted">
              {lastPublished ? lastPublished.title : t.quickShareNone}
            </span>
          </button>
          <Link href={`/${locale}/dashboard/offline`} className={`${big} bg-white text-fg shadow-sm`} data-testid="quick-offline">
            {t.quickOffline}
          </Link>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm" data-testid="client-events">
        <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted">{t.eventsTitle}</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{t.eventsEmpty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {events.map((event, index) => {
              const text =
                event.kind === 'booking'
                  ? formatMessage(
                      t.eventBooking,
                      { name: event.clientName ?? '', date: formatSlotShort(event.startsAt ?? '') },
                      locale
                    )
                  : formatMessage(
                      event.kind === 'retouch' ? t.eventRetouch : t.eventFavorite,
                      { gallery: event.galleryTitle ?? '', n: event.count ?? 0 },
                      locale
                    )
              const href =
                event.kind === 'booking'
                  ? `/${locale}/dashboard/booking`
                  : `/${locale}/dashboard/galleries/${event.galleryId}`
              return (
                <li key={index}>
                  <Link href={href} className="flex min-h-[56px] items-center gap-3 py-2 text-fg no-underline" data-testid="client-event">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 flex-none rounded-full ${
                        event.kind === 'booking' ? 'bg-emerald-500' : event.kind === 'retouch' ? 'bg-amber-500' : 'bg-accent'
                      }`}
                    />
                    <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{text}</span>
                    <span className="flex-none text-xs font-semibold text-muted">{now ? timeAgo(event.at, now, t, locale) : ''}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 rounded-2xl bg-fg px-5 py-4 text-center text-sm font-bold text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </section>
  )
}

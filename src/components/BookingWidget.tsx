'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatSlot } from '@/lib/booking/types'
import { slotEndTime } from '@/lib/booking/slotTemplate'
import type { Locale } from '@/lib/i18n/config'

export interface PublicSlot {
  id: string
  starts_at: string
  duration_minutes: number
  price_uah: number
}

interface Methods {
  mono: boolean
  wfp: boolean
  manualLink: string | null
  cardDetails: string | null
}

interface Labels {
  noSlots: string
  minutes: string
  free: string
  nameLabel: string
  phoneLabel: string
  emailLabel: string
  bookButton: string
  booking: string
  slotTaken: string
  /** 409 slot_unavailable: the photographer's Google Calendar got busy. */
  slotUnavailable?: string
  bookedTitle: string
  bookedText: string
  payMono: string
  payWfp: string
  payManual: string
  payCard: string
  payRedirect: string
  payError: string
}

/**
 * Client flow: pick a free slot → required contacts (name/phone/email) →
 * POST /api/booking/book (race-safe; 409 = the slot was just taken) →
 * payment step showing ONLY the methods the photographer enabled.
 * There is deliberately no "I paid" button — payment is confirmed by the
 * bank webhook or by the photographer, never by the client's word.
 */
export function BookingWidget({
  handle,
  locale,
  slots,
  methods,
  labels,
}: {
  handle: string
  locale: Locale
  slots: PublicSlot[]
  methods: Methods
  labels: Labels
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<PublicSlot | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<
    'idle' | 'booking' | 'booked' | 'taken' | 'unavailable' | 'paying' | 'payError'
  >('idle')
  const [bookingToken, setBookingToken] = useState<string | null>(null)

  const inputClass = 'border border-line bg-transparent px-4 py-3 outline-none focus:border-fg'

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setState('booking')
    const response = await fetch('/api/booking/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: selected.id, name, phone, email }),
    })
    if (response.status === 409) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      setState(payload?.error === 'slot_unavailable' ? 'unavailable' : 'taken')
      setSelected(null)
      router.refresh()
      return
    }
    if (!response.ok) {
      setState('idle')
      return
    }
    const data = (await response.json()) as { bookingToken: string }
    setBookingToken(data.bookingToken)
    setState('booked')
  }

  async function pay(method: 'mono' | 'wfp') {
    if (!selected || !bookingToken) return
    setState('paying')
    try {
      const response = await fetch('/api/booking/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selected.id, bookingToken, method, locale }),
      })
      if (!response.ok) throw new Error(`pay ${response.status}`)
      const { url } = (await response.json()) as { url: string }
      window.location.href = url
    } catch {
      setState('payError')
    }
  }

  /* ---------- step 3: booked → payment options ---------- */
  if ((state === 'booked' || state === 'paying' || state === 'payError') && selected) {
    const paid = Number(selected.price_uah) > 0
    return (
      <div className="border border-line p-8 text-center">
        <h2 className="font-display text-2xl">{labels.bookedTitle}</h2>
        <p className="mt-2 font-display text-lg">
          {formatSlot(selected.starts_at)}–{slotEndTime(selected.starts_at, selected.duration_minutes)}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          {labels.bookedText}
        </p>

        {paid && (
          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
            {methods.mono && (
              <button
                type="button"
                disabled={state === 'paying'}
                onClick={() => void pay('mono')}
                className="border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-60"
              >
                {state === 'paying' ? labels.payRedirect : labels.payMono}
              </button>
            )}
            {methods.wfp && (
              <button
                type="button"
                disabled={state === 'paying'}
                onClick={() => void pay('wfp')}
                className="border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-60"
              >
                {state === 'paying' ? labels.payRedirect : labels.payWfp}
              </button>
            )}
            {methods.manualLink && (
              <a
                href={methods.manualLink}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line px-6 py-3 text-sm uppercase tracking-widest text-muted transition-colors hover:border-fg hover:text-fg"
              >
                {labels.payManual}
              </a>
            )}
            {methods.cardDetails && (
              <div className="border border-line p-4 text-left">
                <p className="text-xs uppercase tracking-widest text-muted">{labels.payCard}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{methods.cardDetails}</p>
              </div>
            )}
            {state === 'payError' && <p className="text-sm text-accent">{labels.payError}</p>}
          </div>
        )}
      </div>
    )
  }

  /* ---------- step 1-2: slots + contacts ---------- */
  return (
    <div>
      {(state === 'taken' || state === 'unavailable') && (
        <p role="alert" className="mb-6 border border-accent px-4 py-3 text-sm text-accent">
          {state === 'unavailable' ? labels.slotUnavailable ?? labels.slotTaken : labels.slotTaken}
        </p>
      )}

      {slots.length === 0 ? (
        <p className="text-center leading-relaxed text-muted">{labels.noSlots}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => setSelected(slot)}
              aria-pressed={selected?.id === slot.id}
              className={`border px-4 py-3 text-left transition-colors ${
                selected?.id === slot.id ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'
              }`}
            >
              <span className="block font-display text-lg">
                {formatSlot(slot.starts_at)}–{slotEndTime(slot.starts_at, slot.duration_minutes)}
              </span>
              <span className={`text-xs ${selected?.id === slot.id ? '' : 'text-muted'}`}>
                {slot.duration_minutes} {labels.minutes} ·{' '}
                {Number(slot.price_uah) > 0 ? `${Number(slot.price_uah)} грн` : labels.free}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <form onSubmit={book} className="mt-10 flex flex-col gap-4">
          <label className="text-sm text-muted" htmlFor="bk-name">{labels.nameLabel}</label>
          <input id="bk-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <label className="text-sm text-muted" htmlFor="bk-phone">{labels.phoneLabel}</label>
          <input id="bk-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          <label className="text-sm text-muted" htmlFor="bk-email">{labels.emailLabel}</label>
          <input id="bk-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <button
            type="submit"
            disabled={state === 'booking'}
            className="mt-2 border border-fg px-8 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-60"
          >
            {state === 'booking' ? labels.booking : labels.bookButton}
          </button>
        </form>
      )}
    </div>
  )
}

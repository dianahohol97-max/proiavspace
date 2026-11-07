'use client'

import { useEffect, useRef, useState } from 'react'
import type { GalleryDeliveryStatus } from '@/lib/types'

export interface DeliveryControlLabels {
  title: string
  hint: string
  none: string
  shot: string
  editing: string
  ready: string
  etaLabel: string
  etaHint: string
  etaClear: string
  saving: string
  saved: string
  error: string
}

type Save = (status: string | null, eta: string | null) => Promise<{ ok: boolean }>

/**
 * «Статус для клієнта» in the gallery dashboard: four big segments and an
 * optional date. Every change is saved at once (no submit button); the line
 * under the control says «Зберігаємо… / Збережено / Не вдалося зберегти».
 * Thumb-sized targets: 2×2 on a phone, one row from 640 px.
 */
export function DeliveryStatusControl({
  initialStatus,
  initialEta,
  save,
  labels,
}: {
  initialStatus: GalleryDeliveryStatus | null
  initialEta: string | null
  save: Save
  labels: DeliveryControlLabels
}) {
  const [status, setStatus] = useState<GalleryDeliveryStatus | null>(initialStatus)
  const [eta, setEta] = useState<string>(initialEta ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Only the latest save may report back (a slow earlier one must not
  // overwrite «Збережено» of a later one).
  const seq = useRef(0)
  const etaTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (etaTimer.current) window.clearTimeout(etaTimer.current)
  }, [])

  async function persist(nextStatus: GalleryDeliveryStatus | null, nextEta: string) {
    const id = ++seq.current
    setState('saving')
    let ok = false
    try {
      ok = (await save(nextStatus, nextEta || null)).ok
    } catch {
      ok = false
    }
    if (id === seq.current) setState(ok ? 'saved' : 'error')
  }

  function pickStatus(next: GalleryDeliveryStatus | null) {
    if (next === status && state !== 'error') return
    setStatus(next)
    void persist(next, eta)
  }

  function changeEta(next: string) {
    setEta(next)
    // A save still in flight must not report «Збережено» for this new date.
    seq.current++
    setState('saving')
    // Date wheels (iOS) fire on every turn: save once the value settles.
    if (etaTimer.current) window.clearTimeout(etaTimer.current)
    etaTimer.current = window.setTimeout(() => void persist(status, next), 500)
  }

  const options: { value: GalleryDeliveryStatus | null; label: string }[] = [
    { value: null, label: labels.none },
    { value: 'shot', label: labels.shot },
    { value: 'editing', label: labels.editing },
    { value: 'ready', label: labels.ready },
  ]
  const showEta = status === 'shot' || status === 'editing'

  return (
    <section className="mt-12" data-testid="delivery-control">
      <h2 className="font-display text-2xl">{labels.title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{labels.hint}</p>
      <div
        role="radiogroup"
        aria-label={labels.title}
        className="mt-5 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {options.map((option) => {
          const on = option.value === status
          return (
            <button
              key={option.value ?? 'none'}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pickStatus(option.value)}
              className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-fg'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {showEta && (
        <div className="mt-5 flex max-w-md flex-col gap-1">
          <label className="text-sm text-muted" htmlFor="g-delivery-eta">
            {labels.etaLabel}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="g-delivery-eta"
              type="date"
              value={eta}
              onChange={(event) => changeEta(event.target.value)}
              className="min-h-[48px] flex-1 rounded-xl border border-line bg-transparent px-3 py-2 text-base outline-none focus:border-fg"
            />
            {eta && (
              <button
                type="button"
                onClick={() => {
                  if (etaTimer.current) window.clearTimeout(etaTimer.current)
                  setEta('')
                  void persist(status, '')
                }}
                className="min-h-[48px] rounded-xl border border-line px-3 text-sm text-muted hover:border-fg hover:text-fg"
              >
                {labels.etaClear}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">{labels.etaHint}</p>
        </div>
      )}

      <p
        className={`mt-3 min-h-[1.25rem] text-sm ${state === 'error' ? 'text-accent' : 'text-muted'}`}
        role="status"
        aria-live="polite"
      >
        {state === 'saving' ? labels.saving : state === 'saved' ? labels.saved : state === 'error' ? labels.error : ''}
      </p>
    </section>
  )
}

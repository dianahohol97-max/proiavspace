'use client'

import { useState } from 'react'
import type { BillingPeriod } from '@/lib/plans'
import type { Locale } from '@/lib/i18n/config'
import type { PlanCard } from './billing-cards'

export type { PlanCard } from './billing-cards'

interface Labels {
  periodMonth: string
  periodYear: string
  upgrade: string
  currentBadge: string
  perMonth: string
  perYear: string
  freePrice: string
  notConfigured: string
  checkoutError: string
}

/** Shared plan grid for both products with a month/year toggle. */
export function BillingPlans({
  cards,
  locale,
  labels,
  columns = 3,
}: {
  cards: PlanCard[]
  locale: Locale
  labels: Labels
  columns?: number
}) {
  const [period, setPeriod] = useState<BillingPeriod>('month')
  const [notice, setNotice] = useState<string | null>(null)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const busy = busyPlan !== null

  async function upgrade(planId: string) {
    setBusyPlan(planId)
    setNotice(null)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, period, locale }),
      })
      if (response.status === 503) {
        setNotice(labels.notConfigured)
        return
      }
      if (!response.ok) {
        // A real failure (bad request, provider outage, DB error) — don't
        // mislead the user into thinking billing simply isn't set up.
        setNotice(labels.checkoutError)
        return
      }
      const form = (await response.json()) as { url: string; fields: Record<string, string> }

      // No fields (monobank) → the checkout page is opened by plain redirect;
      // otherwise (LiqPay) auto-submit a hidden POST form.
      if (Object.keys(form.fields).length === 0) {
        window.location.assign(form.url)
        return
      }

      const element = document.createElement('form')
      element.method = 'POST'
      element.action = form.url
      for (const [name, value] of Object.entries(form.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        element.appendChild(input)
      }
      document.body.appendChild(element)
      element.submit()
    } catch {
      // Network/JS failure before we got a response.
      setNotice(labels.checkoutError)
    } finally {
      setBusyPlan(null)
    }
  }

  return (
    <div>
      <div className="inline-flex rounded border border-line text-sm">
        {(['month', 'year'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              period === value ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
            }`}
          >
            {value === 'month' ? labels.periodMonth : labels.periodYear}
          </button>
        ))}
      </div>

      <div
        className="mt-8 grid gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, maxWidth: columns * 340 }}
      >
        {cards.map((card) => {
          const price = period === 'month' ? card.priceMonth : card.priceYear
          return (
            <div
              key={card.id}
              className={`flex flex-col rounded border p-6 ${
                card.highlight ? 'border-fg' : 'border-line'
              }`}
            >
              <h3 className="font-brand text-xl">{card.name}</h3>
              {card.storageLine && <p className="mt-1 text-sm text-muted">{card.storageLine}</p>}
              <p
                className={`mt-5 break-words font-brand ${card.isFree ? 'text-xl' : 'text-3xl'}`}
              >
                {card.isFree ? labels.freePrice : `${price} ₴`}
                {!card.isFree && (
                  <span className="font-body text-xs text-muted">
                    {' '}
                    {period === 'month' ? labels.perMonth : labels.perYear}
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs text-muted">{card.note}</p>
              {card.features.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  {card.features.map((feature) => (
                    <li key={feature}>
                      <span className="text-accent">→</span> {feature}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-6">
                {card.isCurrent ? (
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    {labels.currentBadge}
                  </span>
                ) : card.isFree ? null : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void upgrade(card.id)}
                    className="rounded-full border border-fg px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg disabled:opacity-60"
                  >
                    {busyPlan === card.id ? '…' : labels.upgrade}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {notice && (
        <p className="mt-6 rounded border border-line bg-line/30 px-4 py-3 text-sm">{notice}</p>
      )}
    </div>
  )
}

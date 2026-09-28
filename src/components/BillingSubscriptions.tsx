'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/i18n/config'

export interface SubscriptionView {
  product: 'gallery' | 'site'
  planName: string
  period: string
  nextChargeAt: string
  status: 'active' | 'canceled' | 'past_due'
}

interface Labels {
  title: string
  productGallery: string
  productSite: string
  nextCharge: string
  activeUntil: string
  statusPastDue: string
  cancel: string
  canceled: string
  confirm: string
}

/**
 * Auto-renewal panel on the billing page: one line per product with the next
 * charge date and a cancel button. Cancel keeps the paid period running and
 * only stops future charges, which is what the label promises.
 */
export function BillingSubscriptions({
  subscriptions,
  locale,
  labels,
}: {
  subscriptions: SubscriptionView[]
  locale: Locale
  labels: Labels
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [canceledNow, setCanceledNow] = useState<string[]>([])

  if (subscriptions.length === 0) return null

  async function cancel(product: 'gallery' | 'site') {
    if (!window.confirm(labels.confirm)) return
    setBusy(product)
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      })
      if (response.ok) setCanceledNow((prev) => [...prev, product])
    } finally {
      setBusy(null)
    }
  }

  return (
    <section id="autopay" className="mt-14">
      <h2 className="mb-6 font-brand text-xl">{labels.title}</h2>
      <ul className="divide-y divide-line border border-line">
        {subscriptions.map((sub) => {
          const isCanceled = sub.status === 'canceled' || canceledNow.includes(sub.product)
          const date = new Date(sub.nextChargeAt).toLocaleDateString(
            locale === 'uk' ? 'uk-UA' : 'en-GB'
          )
          return (
            <li
              key={sub.product}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm"
            >
              <span>
                {sub.product === 'gallery' ? labels.productGallery : labels.productSite}
                {' · '}
                {sub.planName}
              </span>
              <span className="text-muted">
                {sub.status === 'past_due'
                  ? labels.statusPastDue
                  : isCanceled
                    ? `${labels.activeUntil} ${date}`
                    : `${labels.nextCharge} ${date}`}
              </span>
              {isCanceled ? (
                <span className="text-muted">{labels.canceled}</span>
              ) : sub.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy === sub.product}
                  onClick={() => void cancel(sub.product)}
                  className="border border-line px-4 py-2 text-xs uppercase tracking-widest transition-colors hover:border-fg disabled:opacity-50"
                >
                  {labels.cancel}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

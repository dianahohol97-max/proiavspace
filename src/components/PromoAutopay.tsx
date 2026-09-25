'use client'

import { useState } from 'react'
import { openCheckout } from '@/lib/billing/open-checkout'

/**
 * «Підключити автоплатіж» for the import promo month: pays the first Базовий
 * month now; the paid period starts when the free month ends.
 */
export function PromoAutopay({
  locale,
  labels,
}: {
  locale: string
  labels: { button: string; notConfigured: string; checkoutError: string }
}) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setNotice(null)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'basic', period: 'month', locale, promo: 'import_autopay' }),
      })
      if (response.status === 503) {
        setNotice(labels.notConfigured)
        return
      }
      if (!response.ok) {
        setNotice(labels.checkoutError)
        return
      }
      openCheckout((await response.json()) as { url: string; fields: Record<string, string> })
    } catch {
      setNotice(labels.checkoutError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void connect()}
        className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {labels.button}
      </button>
      {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { BillingOverview as Overview, PaymentMethod } from '@/lib/billing/cabinet'
import type { Locale } from '@/lib/i18n/config'

export interface BillingOverviewLabels {
  title: string
  plan: string
  used: string
  validUntil: string
  freeLifetime: string
  autopayTitle: string
  autopayOn: string
  autopayOff: string
  autopayPastDue: string
  autopayWallet: string
  cancel: string
  cancelConfirm: string
  cancelError: string
  enable: string
  payByCard: string
  changePlan: string
  partnerUntil: string
  historyTitle: string
  historyEmpty: string
  historyDate: string
  historyAmount: string
  historyPlan: string
  historyMethod: string
  methodCard: string
  methodAutocharge: string
  refunded: string
  periodMonth: string
  periodYear: string
}

function formatBytes(bytes: number, lang: string): string {
  const num = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 })
  const gb = bytes / 1024 ** 3
  if (gb >= 1024) return `${num(gb / 1024)} ТБ`
  if (gb >= 1) return `${num(gb)} ГБ`
  return `${Math.max(Math.round(bytes / 1024 ** 2), 0)} МБ`
}

/**
 * «Тариф і оплата» — always shown at the top of /dashboard/billing (anchor
 * #autopay, which the renewal letters link to): plan and volume, until when,
 * the auto-renewal state with its action, partner badge, the last payments.
 */
export function BillingOverview({
  overview,
  planNames,
  locale,
  labels,
}: {
  overview: Overview
  planNames: Record<string, string>
  locale: Locale
  labels: BillingOverviewLabels
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const lang = locale === 'uk' ? 'uk-UA' : 'en-GB'
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang, { timeZone: 'Europe/Kyiv' })
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
  const planName = (id: string) => planNames[id] ?? id
  const a = overview.autopay

  async function cancel() {
    if (!window.confirm(labels.cancelConfirm)) return
    setBusy(true)
    setError(false)
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'gallery' }),
      })
      if (!response.ok) setError(true)
      else router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const method = (m: PaymentMethod) =>
    m.kind === 'google'
      ? 'Google Pay'
      : m.kind === 'apple'
        ? 'Apple Pay'
        : m.kind === 'autocharge'
          ? labels.methodAutocharge
          : m.kind === 'card'
            ? m.last4
              ? `${labels.methodCard} •••• ${m.last4}`
              : labels.methodCard
            : m.name

  const button =
    'inline-block rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest no-underline transition-colors disabled:opacity-50'

  return (
    <section id="autopay" data-testid="billing-overview" className="mt-8 scroll-mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-brand text-xl">{labels.title}</h2>
          <p className="mt-3 text-lg font-bold">
            {labels.plan}: «{planName(overview.planId)}» · {formatBytes(overview.storageLimitBytes, lang)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {fill(labels.used, {
              used: formatBytes(overview.storageUsedBytes, lang),
              limit: formatBytes(overview.storageLimitBytes, lang),
            })}
          </p>
          <p className="mt-1 text-sm">
            {overview.isFree
              ? labels.freeLifetime
              : overview.validUntil
                ? fill(labels.validUntil, { date: date(overview.validUntil) })
                : null}
          </p>
          {overview.partnerUntil && (
            <p className="mt-2 inline-block rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-white">
              {fill(labels.partnerUntil, { date: date(overview.partnerUntil) })}
            </p>
          )}
        </div>
        <a href="#plans" className={`${button} border border-fg text-fg hover:bg-fg hover:text-bg`}>
          {labels.changePlan}
        </a>
      </div>

      <div className="mt-6 border-t border-line pt-5" data-autopay-state={a.kind}>
        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">{labels.autopayTitle}</p>
        {a.kind === 'on' ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className="text-sm">
              {fill(labels.autopayOn, { date: date(a.nextChargeAt), amount: String(a.amountUah) })}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
              className={`${button} border border-line text-fg hover:border-fg`}
            >
              {labels.cancel}
            </button>
          </div>
        ) : a.kind === 'wallet' ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className="text-sm">{fill(labels.autopayWallet, { wallet: a.wallet })}</p>
            <a href="#plans" className={`${button} bg-accent text-white hover:bg-accent-deep`}>
              {labels.payByCard}
            </a>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className="text-sm">{a.pastDue ? labels.autopayPastDue : labels.autopayOff}</p>
            <a href="#plans" className={`${button} bg-accent text-white hover:bg-accent-deep`}>
              {labels.enable}
            </a>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{labels.cancelError}</p>}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">{labels.historyTitle}</p>
        {overview.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{labels.historyEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-muted">
                  <th className="py-2 pr-4 font-semibold">{labels.historyDate}</th>
                  <th className="py-2 pr-4 font-semibold">{labels.historyAmount}</th>
                  <th className="py-2 pr-4 font-semibold">{labels.historyPlan}</th>
                  <th className="py-2 font-semibold">{labels.historyMethod}</th>
                </tr>
              </thead>
              <tbody>
                {overview.history.map((p, i) => (
                  <tr key={`${p.date}-${i}`} className="border-t border-line">
                    <td className="py-2 pr-4">{date(p.date)}</td>
                    <td className="py-2 pr-4">
                      {p.amountUah.toLocaleString(lang)} ₴{p.refunded ? ` · ${labels.refunded}` : ''}
                    </td>
                    <td className="py-2 pr-4">
                      «{planName(p.plan)}», {p.period === 'year' ? labels.periodYear : labels.periodMonth}
                    </td>
                    <td className="py-2">{method(p.method)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

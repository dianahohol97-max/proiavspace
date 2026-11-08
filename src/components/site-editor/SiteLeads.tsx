'use client'

import { intlLocale } from '@/lib/i18n/format'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSiteLead } from '@/lib/actions/site'
import type { Locale } from '@/lib/i18n/config'

export interface LeadRow {
  id: string
  name: string
  contact: string
  message: string
  created_at: string
}

/**
 * Inbox for the site lead form: newest first, delete when handled.
 * Rendered under the editor so the photographer sees requests where they
 * manage the site that produced them.
 */
export function SiteLeads({
  locale,
  leads,
  labels,
}: {
  locale: Locale
  leads: LeadRow[]
  labels: { title: string; empty: string; delete: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <section className="mt-14">
      <h2 className="mb-4 font-brand text-xl">
        {labels.title}
        {leads.length > 0 && <span className="ml-2 text-sm text-muted">({leads.length})</span>}
      </h2>
      {leads.length === 0 ? (
        <p className="text-sm text-muted">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {leads.map((lead) => (
            <li key={lead.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {lead.name}
                  <span className="ml-3 font-normal text-muted">{lead.contact}</span>
                </p>
                {lead.message && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{lead.message}</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {new Date(lead.created_at).toLocaleString(intlLocale(locale))}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteSiteLead(locale, lead.id)
                    router.refresh()
                  })
                }
                className="border border-line px-3 py-1.5 text-xs uppercase tracking-widest transition-colors hover:border-fg disabled:opacity-50"
              >
                {labels.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

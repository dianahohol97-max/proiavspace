'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generateArticleNow } from '@/lib/actions/blog'
import type { Locale } from '@/lib/i18n/config'
import type { GenerateResult } from '@/lib/blog/generate'

/**
 * One-click generation from the dashboard — writes the next queued topic into a
 * draft without leaving the admin. Shows a live spinner and the outcome inline.
 */
export function GenerateButton({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<GenerateResult | null>(null)

  function run() {
    setResult(null)
    startTransition(async () => {
      const res = await generateArticleNow(locale)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-fg px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Пишемо статтю…' : 'Згенерувати статтю'}
        </button>
      </div>
      {result && (
        <p
          className={`text-sm ${result.ok ? 'text-emerald-700' : 'text-accent'}`}
          role="status"
          aria-live="polite"
        >
          {result.message}
        </p>
      )}
      {pending && (
        <p className="text-xs text-muted">
          Це займає 10–30 секунд — модель пише й перевіряє статтю.
        </p>
      )}
    </div>
  )
}

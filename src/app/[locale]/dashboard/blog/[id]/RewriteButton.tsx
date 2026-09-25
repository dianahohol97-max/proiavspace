'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { rewriteArticleNow } from '@/lib/actions/blog'
import type { Locale } from '@/lib/i18n/config'
import type { GenerateResult } from '@/lib/blog/generator'

/**
 * "Update existing article": rewrites it by the current generator rules into a
 * separate revision. The live article stays as is until the revision is applied.
 */
export function RewriteButton({ locale, id, defaultQuery }: { locale: Locale; id: string; defaultQuery: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(defaultQuery)
  const [result, setResult] = useState<GenerateResult | null>(null)

  function run() {
    setResult(null)
    startTransition(async () => {
      const res = await rewriteArticleNow(locale, id, query.trim() || undefined)
      setResult(res)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs text-muted" htmlFor="rewrite-query">
        Цільовий пошуковий запит
      </label>
      <input
        id="rewrite-query"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
      />
      <div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-fg px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Переписуємо…' : 'Переписати за новими правилами'}
        </button>
      </div>
      {result && (
        <p className={`text-sm ${result.ok ? 'text-emerald-700' : 'text-accent'}`} role="status" aria-live="polite">
          {result.message}
        </p>
      )}
      {pending && (
        <p className="text-xs text-muted">1–3 хвилини: пошук фактів, текст, перевірка джерел.</p>
      )}
    </div>
  )
}

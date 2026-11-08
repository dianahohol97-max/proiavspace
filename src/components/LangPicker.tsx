'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { locales, localeLabels, localeNames, type Locale } from '@/lib/i18n/config'

/**
 * Language switcher as a compact dropdown: the trigger shows the current
 * language, the menu lists the rest. Keeps the current path and swaps the
 * leading /{locale} segment, so a visitor stays on the same page in their
 * language. Uses a native <details> so it works without extra JS state.
 */
export function LangPicker({
  current,
  full = false,
  label = 'Language',
  up = false,
}: {
  current: Locale
  /** Endonyms («Polski», «Deutsch») instead of codes — the dashboard. */
  full?: boolean
  /** Accessible name of the trigger, in the page language. */
  label?: string
  /** Open the menu upwards (pickers at the bottom of a sidebar). */
  up?: boolean
}) {
  const names = full ? localeNames : localeLabels
  const pathname = usePathname()
  const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'

  return (
    <details className="group relative inline-block text-sm [&_summary::-webkit-details-marker]:hidden">
      <summary
        aria-label={label}
        className="flex cursor-pointer select-none list-none items-center gap-1.5"
        style={{ color: 'inherit' }}
      >
        {names[current]}
        <svg
          width="10"
          height="7"
          viewBox="0 0 10 6"
          aria-hidden
          className="transition-transform group-open:rotate-180"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </summary>
      <div className={`absolute z-50 flex ${up ? 'bottom-full left-0 mb-2' : 'right-0 mt-2'} min-w-[8rem] flex-col overflow-hidden rounded-xl border border-line bg-white py-1 text-fg shadow-[0_12px_32px_rgba(0,0,0,0.12)]`}>
        {locales.map((l) => (
          <Link
            key={l}
            href={`/${l}${rest}`}
            hrefLang={l}
            aria-current={l === current ? 'true' : undefined}
            className="px-4 py-2 no-underline transition-colors hover:bg-[#0d0c0a0a]"
            style={{ fontWeight: l === current ? 700 : 500, color: l === current ? '#2f55ff' : undefined }}
          >
            {names[l]}
          </Link>
        ))}
      </div>
    </details>
  )
}

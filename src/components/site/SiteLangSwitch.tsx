import type { LangSwitch } from './SiteRenderer'

/**
 * Language switcher for photographer SITES, as a compact dropdown instead of a
 * row of every locale. Server-rendered (native <details>, no client JS) and
 * theme-aware — the menu borrows the theme's CSS vars so it fits day/night and
 * every theme. Text colour is inherited from the surrounding nav.
 */
export function SiteLangSwitch({ langSwitch }: { langSwitch: LangSwitch }) {
  const current = langSwitch.options.find((o) => o.current) ?? langSwitch.options[0]
  if (!current) return null
  return (
    <details className="group relative inline-block [&_summary::-webkit-details-marker]:hidden">
      <summary
        aria-label="Language"
        className="flex cursor-pointer list-none items-center gap-1"
        style={{ color: 'inherit' }}
      >
        {current.label}
        <span aria-hidden className="inline-block transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div
        className="absolute right-0 z-50 mt-2 flex min-w-[6rem] flex-col rounded-lg p-1"
        style={{
          background: 'var(--site-bg)',
          color: 'var(--site-fg)',
          border: '1px solid var(--site-line)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
        }}
      >
        {langSwitch.options.map((o) => (
          <a
            key={o.locale}
            href={o.href}
            hrefLang={o.locale}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              padding: '6px 12px',
              opacity: o.current ? 1 : 0.65,
              fontWeight: o.current ? 700 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </a>
        ))}
      </div>
    </details>
  )
}

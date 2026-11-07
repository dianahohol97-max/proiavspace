import localFont from 'next/font/local'

/**
 * «Тиша» type pair. Display: Cormorant Garamond (variable 300–700, Latin +
 * Cyrillic, self-hosted — no build-time network). Body: Manrope, already
 * self-hosted app-wide in globals.css, so it costs nothing extra here.
 *
 * preload: false — SiteRenderer bundles every theme, and preloading would make
 * sites on other themes download this face too. Browsers fetch a @font-face
 * only when text actually uses it, and next/font's size-adjusted fallback
 * keeps the swap free of layout shift.
 */
export const tyshaSerif = localFont({
  src: [
    { path: './fonts/cormorant-garamond.woff2', weight: '300 700', style: 'normal' },
    { path: './fonts/cormorant-garamond-italic.woff2', weight: '300 700', style: 'italic' },
  ],
  variable: '--tysha-serif',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
})

/**
 * Site-token overrides for «Тиша» (light only): the shared blocks rendered
 * around the theme — booking section, legal footer — pick up the same type.
 * Set on the wrapper together with `tyshaSerif.variable`; galleries and
 * «Опівніч» keep the tokens from lib/site/themes.ts untouched.
 */
export const TYSHA_FONT_VARS = {
  '--site-font-display': 'var(--tysha-serif), Georgia, "Times New Roman", serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

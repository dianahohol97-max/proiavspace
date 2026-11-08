/**
 * «Розворот» type: Playfair Display Regular (OFL) — an editorial, high-
 * contrast serif with real Cyrillic — for the name and headings (25 KB); the
 * handwritten quote borrows «Лист»'s Marck Script. Self-hosted, declared in
 * Spread.module.css with metric-matched fallbacks; preloaded by ThemeRozvorot
 * only. Text: Manrope.
 */
export const SPREAD_FONT_URL = '/fonts/rozvorot/playfair-400.woff2'

export const SPREAD_FONT_VARS = {
  '--site-font-display': '"Spread Serif", "Spread Serif Fallback", Georgia, serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

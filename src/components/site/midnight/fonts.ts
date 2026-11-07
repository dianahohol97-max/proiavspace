/**
 * «Опівніч» type: Prata (OFL) — a high-contrast didone with real Cyrillic,
 * lining figures and one 24 KB file (Latin + Cyrillic subset), self-hosted in
 * /public/fonts/opivnich. Declared in Midnight.module.css with a metric-matched
 * Times New Roman fallback; preloaded by ThemeOpivnich only. Text: Manrope
 * (already self-hosted app-wide).
 */
export const MIDNIGHT_FONT_URL = '/fonts/opivnich/prata-400.woff2'

/** Token overrides for the blocks rendered around the theme (booking, legal footer). */
export const MIDNIGHT_FONT_VARS = {
  '--site-font-display': '"Midnight Serif", "Midnight Serif Fallback", Georgia, serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

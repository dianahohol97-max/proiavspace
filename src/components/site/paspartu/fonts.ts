/**
 * «Паспарту» type: Cormorant SC Medium (OFL) — museum-label small caps with
 * real Cyrillic — for the name, series titles and headings; one 22 KB file
 * self-hosted in /public/fonts/paspartu, declared in Mat.module.css with a
 * metric-matched fallback; preloaded by ThemePaspartu only. Text: Manrope.
 */
export const MAT_FONT_URL = '/fonts/paspartu/cormorant-sc-500.woff2'

export const MAT_FONT_VARS = {
  '--site-font-display': '"Mat Caps", "Mat Caps Fallback", Georgia, serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

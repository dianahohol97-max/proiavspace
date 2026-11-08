/**
 * «Ніжність» type: Nunito ExtraBold (OFL) — soft, rounded, with plain
 * Cyrillic forms — for the name and headings, one 17 KB file self-hosted in /public/fonts/nizhnist,
 * declared in Tender.module.css with a metric-matched fallback; preloaded by
 * ThemeNizhnist only. Text: Manrope.
 */
export const TENDER_FONT_URL = '/fonts/nizhnist/nunito-800.woff2'

export const TENDER_FONT_VARS = {
  '--site-font-display': '"Tender Round", "Tender Round Fallback", Arial, sans-serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

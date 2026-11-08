/**
 * «Темна кімната» type: Old Standard TT (OFL) — a 19th-century book face with
 * real Cyrillic, like a lab manual — for the name and headings; one 27 KB
 * file self-hosted in /public/fonts/temna, declared in Lab.module.css with a
 * metric-matched fallback; preloaded by ThemeTemna only. Text: Manrope.
 */
export const LAB_FONT_URL = '/fonts/temna/old-standard-400.woff2'

export const LAB_FONT_VARS = {
  '--site-font-display': '"Lab Serif", "Lab Serif Fallback", Georgia, serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

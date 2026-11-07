/**
 * «Журнал» type: Oranienbaum (OFL) — a condensed high-contrast didone with
 * real Cyrillic: the masthead fits one line, like a magazine cover. One 25 KB
 * file, self-hosted in /public/fonts/zhurnal, declared in Journal.module.css
 * with a metric-matched fallback; preloaded by ThemeZhurnal only. Text: Manrope.
 */
export const JOURNAL_FONT_URL = '/fonts/zhurnal/oranienbaum-400.woff2'

export const JOURNAL_FONT_VARS = {
  '--site-font-display': '"Journal Serif", "Journal Serif Fallback", Georgia, serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

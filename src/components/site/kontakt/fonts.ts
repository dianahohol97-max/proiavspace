/**
 * «Контакт» type: IBM Plex Mono Medium (OFL) — the type of film edges and lab
 * sleeves, with real Cyrillic — for the name, frame codes and headings; one
 * 16 KB file self-hosted in /public/fonts/kontakt, declared in
 * Sheet.module.css with a metric-matched fallback; preloaded by ThemeKontakt
 * only. Text: Manrope.
 */
export const SHEET_FONT_URL = '/fonts/kontakt/plex-mono-500.woff2'

export const SHEET_FONT_VARS = {
  '--site-font-display': '"Sheet Mono", "Sheet Mono Fallback", ui-monospace, monospace',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': '"Sheet Mono", "Sheet Mono Fallback", ui-monospace, monospace',
} as const

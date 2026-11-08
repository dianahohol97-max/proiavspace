/**
 * «Маршрут» type: Montserrat Alternates Bold (OFL) — a geometric travel-poster
 * sans with real Cyrillic — for the name, stops and headings; one 26 KB file
 * self-hosted in /public/fonts/marshrut, declared in Route.module.css with a
 * metric-matched fallback; preloaded by ThemeMarshrut only. Text: Manrope.
 */
export const ROUTE_FONT_URL = '/fonts/marshrut/montserrat-alt-700.woff2'

export const ROUTE_FONT_VARS = {
  '--site-font-display': '"Route Sans", "Route Sans Fallback", Arial, sans-serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

/**
 * «Тиша» type pair. Display: Cormorant Garamond Light — ONE static 27 KB
 * file (Latin + Cyrillic), self-hosted in /public/fonts/tysha and declared in
 * Tysha.module.css with a size-adjusted Times New Roman fallback, so the
 * swap does not shift layout. Body: Manrope, already self-hosted app-wide.
 *
 * Why not next/font: SiteRenderer bundles every theme, so a next/font preload
 * would make sites on all other themes download this face too. Here the
 * preload <link> is rendered by ThemeTysha itself — only «Тиша» pages get it.
 */
export const TYSHA_FONT_URL = '/fonts/tysha/cormorant-garamond-300.woff2'

/**
 * Site-token overrides for «Тиша» (light only): the shared blocks rendered
 * around the theme — booking section, legal footer — pick up the same type.
 * Galleries and «Опівніч» keep the tokens from lib/site/themes.ts untouched.
 */
export const TYSHA_FONT_VARS = {
  '--tysha-serif': '"Tysha Serif", "Tysha Serif Fallback"',
  '--site-font-display': '"Tysha Serif", "Tysha Serif Fallback", Georgia, "Times New Roman", serif',
  '--site-font-body': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  '--site-font-label': 'Manrope, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const

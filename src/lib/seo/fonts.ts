import { preload } from 'react-dom'

/**
 * Preload the brand faces on MARKETING pages (not client galleries, which use
 * the photographer's theme fonts). The headline face is the LCP text there;
 * fetching it with the HTML instead of after CSS parse avoids a late swap.
 * Cyrillic subset for Ukrainian pages, Latin for the rest.
 */
export function preloadBrandFonts(locale: string) {
  const subset = locale === 'uk' ? 'cyrillic' : 'latin'
  preload(`/fonts/unbounded-${subset}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  preload(`/fonts/manrope-${subset}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
}

import { preload } from 'react-dom'

/**
 * Preload the MAIN brand face on marketing pages (not client galleries, which
 * use the photographer's theme fonts): Manrope, the body face. On a phone the
 * LCP element is the hero lede, set in Manrope — fetching it with the HTML
 * means the lede paints once, in its final face. Unbounded (headings) is left
 * to normal discovery from the CSS: preloading it too only made the two
 * compete for the first bytes, and its metric-matched fallback ('Unbounded
 * Fallback' in globals.css) keeps the swap from shifting anything.
 *
 * Ukrainian pages need BOTH subsets: the letters come from the cyrillic file,
 * but spaces, digits, punctuation and the odd Latin word («Google Drive»)
 * from the latin one — with only cyrillic preloaded, the latin file was
 * discovered late, queued behind the photos, and the hero text finished
 * painting seconds later.
 */
export function preloadBrandFonts(locale: string) {
  const subsets = locale === 'uk' ? ['cyrillic', 'latin'] : ['latin']
  for (const subset of subsets) {
    preload(`/fonts/manrope-${subset}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  }
}

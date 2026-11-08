import type { Dictionary } from '@/lib/i18n'
import type { ShowcaseLabels } from '@/components/landing/GalleryShowcase'

/** Builds the showcase labels from the dictionary (server side). */
export function showcaseLabels(
  pages: Dictionary['pages'],
  gallery: Dictionary['publicGallery'],
  designer: Dictionary['designer']
): ShowcaseLabels {
  return {
    couple: pages.demoCouple,
    picked: pages.demoPicked,
    slideshow: gallery.slideshow,
    downloadAll: gallery.downloadAll,
    brandLine: pages.demoBrandLine,
    openDemo: pages.showcaseOpenDemo,
    create: pages.showcaseCreate,
    photoAlt: {
      1: pages.photoAlt1,
      2: pages.photoAlt2,
      3: pages.photoAlt3,
      4: pages.photoAlt4,
      5: pages.photoAlt5,
      6: pages.photoAlt6,
    },
    themeLight: designer.themeLight,
    themeDark: designer.themeDark,
    themeCream: designer.themeCream,
    layoutMasonry: designer.layoutMasonry,
    layoutSquare: designer.layoutSquare,
    layoutPortrait: designer.layoutPortrait,
    layoutCollage: designer.layoutCollage,
    layoutEditorial: designer.layoutEditorial,
  }
}

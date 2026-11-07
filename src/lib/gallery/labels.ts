import type { Dictionary } from '@/lib/i18n'
import type { GalleryLabels } from '@/components/gallery/GalleryExperience'

/** The client gallery's UI strings in the visitor's language (9 languages). */
export function galleryLabels(dict: Dictionary): GalleryLabels {
  const t = dict.publicGallery
  return {
    scrollHint: t.scrollHint,
    selected: t.selected,
    downloadAll: t.downloadAll,
    downloadHint: t.downloadHint,
    preparingArchive: t.preparingArchive,
    archiveError: t.archiveError,
    savePart: t.savePart,
    downloadOriginal: t.downloadOriginal,
    favoriteToggle: t.favoriteToggle,
    madeOn: t.madeOn,
    tip: t.tip,
    slideshow: t.slideshow,
    viewer: {
      lightbox: t.viewer,
      close: t.viewerClose,
      prev: t.viewerPrev,
      next: t.viewerNext,
      play: t.viewerPlay,
      pause: t.viewerPause,
      fullscreen: t.viewerFullscreen,
      exitFullscreen: t.viewerExitFullscreen,
      zoomIn: t.viewerZoomIn,
      zoomOut: t.viewerZoomOut,
      slideOf: t.viewerSlideOf,
    },
  }
}

import type { Dictionary } from '@/lib/i18n'
import type { GalleryLabels } from '@/components/gallery/GalleryExperience'
import type { DeliveryLabels } from '@/components/gallery/DeliveryStatusScreen'

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

/** «Статус зйомки» screen and banner strings (uk/en; other languages fall back to en). */
export function deliveryLabels(dict: Dictionary): DeliveryLabels {
  const t = dict.publicGallery
  return {
    title: t.deliveryTitle,
    note: t.deliveryNote,
    eta: t.deliveryEta,
    steps: t.deliverySteps,
    stepShot: t.deliveryStepShot,
    stepEditing: t.deliveryStepEditing,
    stepReady: t.deliveryStepReady,
    stepDone: t.deliveryStepDone,
    stepCurrent: t.deliveryStepCurrent,
    banner: t.deliveryBanner,
    bannerEta: t.deliveryBannerEta,
    contact: t.contactPhotographer,
    madeOn: t.madeOn,
  }
}

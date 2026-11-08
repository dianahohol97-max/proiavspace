'use client'

import { useEffect, useMemo, useRef } from 'react'
import Lightbox, { useLightboxState, type Slide, type SlideshowRef } from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import type { GalleryItem, GalleryLabels, ViewerLabels } from './GalleryExperience'
import s from './GalleryExperience.module.css'

/**
 * Full-screen viewer on yet-another-react-lightbox (MIT): pinch / wheel /
 * double-tap zoom, swipes, a thumbnail strip, real full screen and videos in
 * the same carousel. On top of the library: the favourites heart, «download
 * the original», the slideshow (4.5 s per photo; a video plays out first) and
 * the gallery's labels in the visitor's language.
 *
 * Loaded on demand (next/dynamic) — the grid never waits for it.
 */
export interface GalleryLightboxProps {
  items: GalleryItem[]
  open: boolean
  index: number
  /** Opened by «Слайд-шоу»: start playing and go full screen. */
  slideshow: boolean
  favorites: ReadonlySet<string>
  labels: GalleryLabels & { viewer: ViewerLabels }
  /** Rendered inside the gallery root so the theme variables (--g-*) apply. */
  portalRoot: HTMLElement | null
  onClose: () => void
  onView: (index: number) => void
  onToggleFavorite: (assetId: string) => void
  /** false — no «download original» button in the toolbar (0068). */
  downloadsEnabled?: boolean
}

const SLIDE_DELAY_MS = 4500

function toSlide(item: GalleryItem): Slide {
  // The thumbnail strip uses the grid's light rendition (already cached from
  // the grid); the slide itself is the full 2048 px preview.
  const thumbnail = item.kind === 'photo' ? item.gridUrl || item.previewUrl : item.posterUrl || undefined
  if (item.kind === 'video') {
    return {
      type: 'video',
      sources: [{ src: item.previewUrl, type: item.contentType || 'video/mp4' }],
      poster: item.posterUrl ?? undefined,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      thumbnail,
    }
  }
  // No width/height on purpose: they are the original's pixels, the preview is
  // smaller, and Zoom would let the visitor zoom past the real resolution.
  return { type: 'image', src: item.previewUrl, alt: '', thumbnail }
}

function FavoriteButton({
  items,
  favorites,
  label,
  onToggle,
}: {
  items: GalleryItem[]
  favorites: ReadonlySet<string>
  label: string
  onToggle: (assetId: string) => void
}) {
  const { currentIndex } = useLightboxState()
  const item = items[currentIndex]
  if (!item) return null
  const on = favorites.has(item.id)
  return (
    <button
      type="button"
      className={`yarl__button ${s.lbHeart} ${on ? s.lbHeartOn : ''}`}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => onToggle(item.id)}
    >
      ♥
    </button>
  )
}

function DownloadButton({ items, label }: { items: GalleryItem[]; label: string }) {
  const { currentIndex } = useLightboxState()
  const item = items[currentIndex]
  if (!item) return null
  return (
    <a href={item.downloadHref} className={`yarl__button ${s.lbDownload}`} title={label} aria-label={label}>
      <span aria-hidden>↓</span>
      <span className={s.lbDownloadText}>{label}</span>
    </a>
  )
}

export default function GalleryLightbox({
  items,
  open,
  index,
  slideshow,
  favorites,
  labels,
  portalRoot,
  onClose,
  onView,
  onToggleFavorite,
  downloadsEnabled = true,
}: GalleryLightboxProps) {
  const slides = useMemo(() => items.map(toSlide), [items])
  const slideshowRef = useRef<SlideshowRef | null>(null)
  const t = labels.viewer

  // Space toggles the slideshow, as in the old viewer.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ') return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a, video, input, textarea')) return
      const ref = slideshowRef.current
      if (!ref || ref.disabled) return
      event.preventDefault()
      if (ref.playing) ref.pause()
      else ref.play()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      className={s.lightbox}
      portal={{ root: portalRoot }}
      plugins={[Counter, Fullscreen, Slideshow, Thumbnails, Video, Zoom]}
      carousel={{ preload: 2, finite: items.length < 2 }}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      animation={{ swipe: 280 }}
      slideshow={{ ref: slideshowRef, autoplay: slideshow, delay: SLIDE_DELAY_MS }}
      fullscreen={{ auto: slideshow }}
      zoom={{ maxZoomPixelRatio: 1.5, scrollToZoom: true, doubleTapDelay: 300 }}
      thumbnails={{ width: 72, height: 54, border: 0, borderRadius: 6, padding: 0, gap: 8, vignette: false }}
      counter={{ container: { className: s.lbCounter } }}
      video={{ controls: true, playsInline: true, autoPlay: true, preload: 'metadata' }}
      on={{ view: ({ index: current }) => onView(current) }}
      toolbar={{
        buttons: [
          <FavoriteButton
            key="favorite"
            items={items}
            favorites={favorites}
            label={labels.favoriteToggle}
            onToggle={onToggleFavorite}
          />,
          ...(downloadsEnabled
            ? [<DownloadButton key="download" items={items} label={labels.downloadOriginal} />]
            : []),
          'zoom',
          'slideshow',
          'fullscreen',
          'close',
        ],
      }}
      labels={{
        Lightbox: t.lightbox,
        Close: t.close,
        Previous: t.prev,
        Next: t.next,
        Play: t.play,
        Pause: t.pause,
        'Enter Fullscreen': t.fullscreen,
        'Exit Fullscreen': t.exitFullscreen,
        'Zoom in': t.zoomIn,
        'Zoom out': t.zoomOut,
        '{index} of {total}': t.slideOf,
      }}
    />
  )
}

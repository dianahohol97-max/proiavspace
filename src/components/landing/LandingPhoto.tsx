/**
 * Responsive landing photo: AVIF with a WebP fallback, several widths, and
 * `sizes` from the slot it fills, so a phone downloads a ~10–50 KB frame
 * instead of the 2000px original. Files are pre-generated into
 * public/landing/img/<name>-<width>.{avif,webp} (next.config keeps image
 * optimization off, so there is no on-the-fly resizing to lean on).
 *
 * Works in server and client components alike (no hooks).
 */

/** Widths generated for each source, smallest first. */
export const LANDING_PHOTO_WIDTHS = {
  showcase: [240, 480, 720],
  themes: [360, 720, 1080],
  cover: [720, 1080, 1600],
} as const

type Kind = keyof typeof LANDING_PHOTO_WIDTHS

function srcSet(name: string, widths: readonly number[], ext: 'avif' | 'webp') {
  return widths.map((w) => `/landing/img/${name}-${w}.${ext} ${w}w`).join(', ')
}

export function landingPhotoSrc(name: string, width: number) {
  return `/landing/img/${name}-${width}.webp`
}

export function LandingPhoto({
  name,
  kind,
  sizes,
  alt = '',
  width,
  height,
  priority = false,
  eager = false,
  className,
  style,
  dataState,
}: {
  /** File stem, e.g. `showcase-01` or `themes-15`. */
  name: string
  kind: Kind
  /** The slot's rendered width, as an <img sizes> value. */
  sizes: string
  alt?: string
  /** Intrinsic proportions (any unit) — reserves the box before the bytes arrive. */
  width: number
  height: number
  /** First frame on screen: fetched eagerly at high priority. One per page. */
  priority?: boolean
  /** On the first screen but not the lead frame: eager, but low priority so
   *  it doesn't take bandwidth from the lead frame and the LCP text's font. */
  eager?: boolean
  className?: string
  style?: React.CSSProperties
  /** Rendered as data-state on the <img> (crossfade layers in the hero). */
  dataState?: string
}) {
  const widths = LANDING_PHOTO_WIDTHS[kind]
  return (
    // display: contents — the <img> stays the layout box (grid item, absolute
    // fill), exactly as a bare <img> would be. <source> is not display:none in
    // the UA sheet, so without the explicit none it would become an empty
    // grid cell once <picture> stops boxing it.
    <picture style={{ display: 'contents' }}>
      <source type="image/avif" srcSet={srcSet(name, widths, 'avif')} sizes={sizes} style={{ display: 'none' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={landingPhotoSrc(name, widths[1])}
        srcSet={srcSet(name, widths, 'webp')}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority || eager ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : eager ? 'low' : 'auto'}
        className={className}
        style={style}
        data-state={dataState}
      />
    </picture>
  )
}

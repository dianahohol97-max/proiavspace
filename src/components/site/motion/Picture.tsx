import k from './motion.module.css'

/**
 * A plain, server-rendered <picture>/<img> that fills its (sized) parent.
 * Used instead of next/image because image optimisation is off app-wide
 * (images.unoptimized) — next/image would emit only the 2048px original.
 * Here responsive sources pass straight through: AVIF first, then WebP/JPEG,
 * so a phone takes the ~828px copy. No JS is needed for the image to show.
 */
export function Picture({
  src,
  srcSet,
  avifSrcSet,
  sizes,
  alt,
  priority = false,
  low = false,
  className,
  objectPosition,
}: {
  src: string
  srcSet?: string
  avifSrcSet?: string
  sizes: string
  alt: string
  /** LCP image: eager + fetchpriority=high; everything else lazy + async. */
  priority?: boolean
  /** In view but not needed yet (e.g. later frames of a reel): fetchpriority=low. */
  low?: boolean
  className?: string
  objectPosition?: string
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : low ? 'low' : undefined}
      className={`${k.fillImg} ${className ?? ''}`}
      style={objectPosition ? { objectPosition } : undefined}
    />
  )
  if (!avifSrcSet) return img
  return (
    <picture>
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      {img}
    </picture>
  )
}

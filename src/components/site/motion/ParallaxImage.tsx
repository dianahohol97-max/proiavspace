import { Picture } from './Picture'
import k from './motion.module.css'

/**
 * Light parallax (≈8% travel) with CSS scroll-driven animations — no JS,
 * no scroll listeners. Browsers without `animation-timeline: view()` and
 * visitors with reduced motion simply get a still image (see motion.module.css).
 * The parent (or `className`) sizes the frame.
 */
export function ParallaxImage({
  src,
  srcSet,
  alt,
  sizes,
  className,
  objectPosition,
}: {
  src: string
  srcSet?: string
  alt: string
  sizes: string
  className?: string
  objectPosition?: string
}) {
  return (
    <div className={`${k.frame} ${className ?? ''}`}>
      <div className={k.parallax}>
        <Picture src={src} srcSet={srcSet} alt={alt} sizes={sizes} objectPosition={objectPosition} />
      </div>
    </div>
  )
}

import Image from 'next/image'
import k from './motion.module.css'

/**
 * Light parallax (≈8% travel) with CSS scroll-driven animations — no JS,
 * no scroll listeners. Browsers without `animation-timeline: view()` and
 * visitors with reduced motion simply get a still image (see motion.module.css).
 * The parent (or `className`) sizes the frame.
 */
export function ParallaxImage({
  src,
  alt,
  sizes,
  className,
  objectPosition,
}: {
  src: string
  alt: string
  sizes: string
  className?: string
  objectPosition?: string
}) {
  return (
    <div className={`${k.frame} ${className ?? ''}`}>
      <div className={k.parallax}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={k.fillImg}
          style={objectPosition ? { objectPosition } : undefined}
        />
      </div>
    </div>
  )
}

'use client'

import { m } from 'motion/react'
import { EASE_OUT, useStill } from './useStill'
import { Picture } from './Picture'
import k from './motion.module.css'

/**
 * The proЯв signature: a photo that «develops» like a print in the tray —
 * it enters warm, washed-out and over-exposed, then settles into its real
 * colour and contrast. Only `filter` and `opacity` animate (no layout), and
 * it plays once when the frame enters the viewport.
 *
 * `from="dark"` («Опівніч»): the frame rises out of black instead — exposure
 * from nothing, a brief warm candle-glow overshoot, then the true picture.
 *
 * The parent sizes the frame (aspect-ratio / height); the image fills it.
 */
const FROM = {
  develop: {
    initial: { opacity: 0.35, filter: 'sepia(0.55) saturate(0.35) brightness(1.45) contrast(0.78)' },
    shown: { opacity: 1, filter: 'sepia(0) saturate(1) brightness(1) contrast(1)' },
    times: undefined as number[] | undefined,
    duration: 2.2,
  },
  dark: {
    initial: { opacity: 1, filter: 'brightness(0.04) sepia(0.4) saturate(0.6) contrast(1.1)' },
    shown: {
      opacity: 1,
      filter: [
        'brightness(0.04) sepia(0.4) saturate(0.6) contrast(1.1)',
        'brightness(1.12) sepia(0.22) saturate(1.08) contrast(1.02)',
        'brightness(1) sepia(0) saturate(1) contrast(1)',
      ],
    },
    times: [0, 0.62, 1],
    duration: 2.6,
  },
}

export function DevelopImage({
  src,
  srcSet,
  avifSrcSet,
  alt,
  sizes,
  delay = 0,
  className,
  imgClassName,
  priority = false,
  objectPosition,
  from = 'develop',
}: {
  src: string
  srcSet?: string
  avifSrcSet?: string
  alt: string
  sizes: string
  delay?: number
  className?: string
  imgClassName?: string
  priority?: boolean
  objectPosition?: string
  /** 'develop' (default, «Тиша»): warm over-exposure → normal; 'dark': out of black. */
  from?: 'develop' | 'dark'
}) {
  const fx = FROM[from]
  const still = useStill()
  const img = (
    <Picture
      src={src}
      srcSet={srcSet}
      avifSrcSet={avifSrcSet}
      alt={alt}
      sizes={sizes}
      priority={priority}
      className={imgClassName}
      objectPosition={objectPosition}
    />
  )
  if (still) return <div className={`${k.frame} ${className ?? ''}`}>{img}</div>
  return (
    <m.div
      className={`${k.frame} ${k.guard} ${className ?? ''}`}
      data-motion=""
      initial={fx.initial}
      whileInView={fx.shown}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: fx.duration, ease: EASE_OUT, delay, ...(fx.times ? { times: fx.times } : {}) }}
    >
      {img}
    </m.div>
  )
}

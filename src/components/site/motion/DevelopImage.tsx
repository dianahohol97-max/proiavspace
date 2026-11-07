'use client'

import Image from 'next/image'
import { m } from 'motion/react'
import { EASE_OUT, useStill } from './useStill'
import k from './motion.module.css'

/**
 * The proЯв signature: a photo that «develops» like a print in the tray —
 * it enters warm, washed-out and over-exposed, then settles into its real
 * colour and contrast. Only `filter` and `opacity` animate (no layout), and
 * it plays once when the frame enters the viewport.
 *
 * The parent sizes the frame (aspect-ratio / height); the image fills it.
 */
export function DevelopImage({
  src,
  alt,
  sizes,
  delay = 0,
  className,
  imgClassName,
  priority = false,
  objectPosition,
}: {
  src: string
  alt: string
  sizes: string
  delay?: number
  className?: string
  imgClassName?: string
  priority?: boolean
  objectPosition?: string
}) {
  const still = useStill()
  const img = (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`${k.fillImg} ${imgClassName ?? ''}`}
      style={objectPosition ? { objectPosition } : undefined}
    />
  )
  if (still) return <div className={`${k.frame} ${className ?? ''}`}>{img}</div>
  return (
    <m.div
      className={`${k.frame} ${k.guard} ${className ?? ''}`}
      data-motion=""
      initial={{
        opacity: 0.35,
        filter: 'sepia(0.55) saturate(0.35) brightness(1.45) contrast(0.78)',
      }}
      whileInView={{
        opacity: 1,
        filter: 'sepia(0) saturate(1) brightness(1) contrast(1)',
      }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 2.2, ease: EASE_OUT, delay }}
    >
      {img}
    </m.div>
  )
}

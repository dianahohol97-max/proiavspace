'use client'

import { m } from 'motion/react'
import { EASE_OUT, useStill } from './useStill'
import k from './motion.module.css'

/**
 * Fade + gentle rise when the block first enters the viewport (once).
 * Pass `delay` for a stagger across siblings. Static under reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  style,
  as = 'div',
  cat,
  pack,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
  style?: React.CSSProperties
  as?: 'div' | 'li' | 'figure' | 'article' | 'section'
  /** Portfolio direction, for the one-page filter (data-cat). */
  cat?: string
  /** Package name, for the shared checks (data-pack). */
  pack?: string
}) {
  const still = useStill()
  if (still) {
    const Tag = as
    return (
      <Tag className={className} style={style} data-cat={cat} data-pack={pack}>
        {children}
      </Tag>
    )
  }
  const MTag = m[as]
  return (
    <MTag
      className={`${k.guard} ${className ?? ''}`}
      style={style}
      data-cat={cat}
      data-pack={pack}
      data-motion=""
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 1.1, ease: EASE_OUT, delay }}
    >
      {children}
    </MTag>
  )
}

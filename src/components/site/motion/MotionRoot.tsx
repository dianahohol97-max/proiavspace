'use client'

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'

/**
 * Wrap a theme once: loads only the DOM-animation feature set (no layout /
 * drag code) for every `m.*` element below, and lets motion honour the
 * visitor's prefers-reduced-motion. Kit components additionally render
 * fully static when reduced motion is on (see useStill).
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}

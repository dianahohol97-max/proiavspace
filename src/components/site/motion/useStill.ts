'use client'

import { useEffect, useState } from 'react'

/**
 * True when the visitor asked for reduced motion → kit components render
 * static, with no shifts. Starts false on the first (hydrating) render so the
 * client markup matches the server's; until the effect runs, the CSS guard in
 * motion.module.css already holds everything at rest.
 */
export function useStill(): boolean {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setStill(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return still
}

/** Calm, editorial easing used across the kit (fast out, long settle). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

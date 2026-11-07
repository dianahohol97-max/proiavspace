'use client'

import { useEffect, useRef, useState } from 'react'
import { m, useMotionValue, useSpring } from 'motion/react'
import { useStill } from './useStill'

/**
 * A link that leans a few pixels toward the cursor — desktop only (fine
 * pointer + hover). On touch screens and with reduced motion it is a plain
 * link with no listeners.
 */
export function MagneticButton({
  href,
  children,
  className,
  strength = 0.25,
}: {
  href: string
  children: React.ReactNode
  className?: string
  strength?: number
}) {
  const still = useStill()
  const [fine, setFine] = useState(false)
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFine(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (still || !fine) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }

  return (
    <m.a
      ref={ref}
      href={href}
      className={className}
      style={{ x, y }}
      onPointerMove={(event) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        x.set((event.clientX - (box.left + box.width / 2)) * strength)
        y.set((event.clientY - (box.top + box.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </m.a>
  )
}

'use client'

import { useEffect } from 'react'
import { useStill } from '../motion/useStill'

/**
 * Desktop only (fine pointer, no reduced motion): the hero's floating prints
 * drift a little against the cursor, each by its own depth (data-depth) —
 * the airy parallax. transform only, eased with rAF; phones keep the slow CSS
 * drift, no JS needed.
 */
export function AirFloat({ heroId }: { heroId: string }) {
  const still = useStill()
  useEffect(() => {
    if (still || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const hero = document.getElementById(heroId)
    if (!hero) return
    const prints = Array.from(hero.querySelectorAll<HTMLElement>('[data-depth]'))
    prints.forEach((el) => (el.dataset.follow = 'true'))
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let frame = 0
    const tick = () => {
      x += (tx - x) * 0.07
      y += (ty - y) * 0.07
      for (const el of prints) {
        const d = Number(el.dataset.depth) || 1
        el.style.transform = `translate3d(${(x * d).toFixed(1)}px, ${(y * d).toFixed(1)}px, 0)`
      }
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      const box = hero.getBoundingClientRect()
      tx = -((e.clientX - box.left) / box.width - 0.5) * 28
      ty = -((e.clientY - box.top) / box.height - 0.5) * 20
      if (!frame) frame = requestAnimationFrame(tick)
    }
    hero.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      hero.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
      prints.forEach((el) => {
        delete el.dataset.follow
        el.style.transform = ''
      })
    }
  }, [heroId, still])
  return null
}

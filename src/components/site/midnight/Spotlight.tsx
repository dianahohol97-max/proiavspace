'use client'

import { useEffect } from 'react'
import { useStill } from '../motion/useStill'

/**
 * Desktop only (fine pointer + hover, no reduced motion): the hero's patch of
 * light follows the cursor with a soft inertia. The light is a large radial
 * «hole» in a dark veil (rendered on the server); here we only move it with
 * transform — compositor-only, no layout or paint per frame. On phones the
 * veil drifts by itself (CSS keyframes); without JS it simply stays centred.
 */
export function SpotlightFollow({ heroId, spotId }: { heroId: string; spotId: string }) {
  const still = useStill()
  useEffect(() => {
    if (still) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!fine.matches) return
    const hero = document.getElementById(heroId)
    const spot = document.getElementById(spotId)
    if (!hero || !spot) return

    spot.dataset.follow = 'true'
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let frame = 0
    const tick = () => {
      x += (tx - x) * 0.08
      y += (ty - y) * 0.08
      spot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (event: PointerEvent) => {
      const box = hero.getBoundingClientRect()
      tx = event.clientX - (box.left + box.width / 2)
      ty = event.clientY - (box.top + box.height / 2)
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      if (!frame) frame = requestAnimationFrame(tick)
    }
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
      delete spot.dataset.follow
      spot.style.transform = ''
    }
  }, [heroId, spotId, still])
  return null
}

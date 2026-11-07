'use client'

import { useEffect, useRef } from 'react'
import { useStill } from '../motion/useStill'

/**
 * The film strip is a native horizontal scroller with scroll-snap: swipe and
 * trackpads work without JS, and the page's vertical scroll is never captured
 * (a plain vertical wheel keeps scrolling the page). This island adds what a
 * mouse lacks: drag-to-scroll and ‹ › buttons (one frame per step).
 */
export function StripControls({
  scrollerId,
  prevLabel,
  nextLabel,
  className,
  buttonClassName,
}: {
  scrollerId: string
  prevLabel: string
  nextLabel: string
  className?: string
  buttonClassName?: string
}) {
  const still = useStill()
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = document.getElementById(scrollerId)
    if (!el) return
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      drag.current = { x: e.clientX, left: el.scrollLeft, moved: false }
      el.dataset.dragging = 'true'
    }
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      if (Math.abs(dx) > 4) d.moved = true
      el.scrollLeft = d.left - dx
    }
    const up = () => {
      if (!drag.current) return
      const moved = drag.current.moved
      drag.current = null
      delete el.dataset.dragging
      // Let snap settle on the nearest frame after a drag.
      if (moved) el.scrollBy({ left: 1, behavior: 'auto' })
    }
    // Images are natively draggable — that would steal the gesture.
    const noNativeDrag = (e: DragEvent) => e.preventDefault()
    el.addEventListener('dragstart', noNativeDrag)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('dragstart', noNativeDrag)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [scrollerId])

  const step = (dir: 1 | -1) => {
    const el = document.getElementById(scrollerId)
    if (!el) return
    const frame = el.querySelector<HTMLElement>('[data-frame]')
    const width = frame ? frame.getBoundingClientRect().width + 16 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * width, behavior: still ? 'auto' : 'smooth' })
  }

  return (
    <div className={className}>
      <button type="button" className={buttonClassName} onClick={() => step(-1)} aria-label={prevLabel} aria-controls={scrollerId}>
        ‹
      </button>
      <button type="button" className={buttonClassName} onClick={() => step(1)} aria-label={nextLabel} aria-controls={scrollerId}>
        ›
      </button>
    </div>
  )
}

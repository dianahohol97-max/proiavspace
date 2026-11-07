'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Picture } from '../motion/Picture'
import { EASE_OUT, useStill } from '../motion/useStill'
import t from './Tysha.module.css'

export interface HeroSlide {
  id: string
  src: string
  srcSet?: string
  avifSrcSet?: string
  alt: string
}

const FRAME_MS = 6500
const FRAME_EVENT = 'tysha:frame'
/** Ken Burns drifts toward a different corner on every frame. */
const ORIGINS = ['50% 40%', '30% 60%', '70% 35%', '45% 70%']

/**
 * The hero slideshow layer. The FIRST frame is not here: ThemeTysha renders it
 * on the server (the LCP image, fetchpriority=high) and it stays underneath.
 * This island waits for the page `load` and an idle moment, only then mounts
 * the other frames (plus a copy of the first, to loop back to) and starts the
 * cross-fade — so nothing competes with the first paint. Reduced motion:
 * never starts; the server frame is all there is.
 */
export function HeroSlides({ slides }: { slides: HeroSlide[] }) {
  const still = useStill()
  const [ready, setReady] = useState(false)
  const [{ index, prev }, setFrame] = useState<{ index: number; prev: number | null }>({
    index: 0,
    prev: null,
  })
  const n = slides.length
  const playing = n > 1 && !still

  useEffect(() => {
    if (!playing) return
    let idle = 0
    let timer = 0
    const start = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback
      if (ric) idle = ric(() => setReady(true), { timeout: 2500 })
      else timer = window.setTimeout(() => setReady(true), 1200)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
      if (idle && cic) cic(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [playing])

  useEffect(() => {
    if (!ready || !playing) return
    const timer = window.setInterval(() => {
      setFrame((f) => ({ index: (f.index + 1) % n, prev: f.index }))
    }, FRAME_MS)
    return () => window.clearInterval(timer)
  }, [ready, playing, n])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(FRAME_EVENT, { detail: index }))
  }, [index])

  if (!ready || !playing) return null
  return (
    <>
      {slides.map((slide, i) => {
        // Frame 0 is the server image underneath; its copy here only takes
        // part once the loop comes back round.
        const state = i === index && !(i === 0 && prev === null) ? 'active' : i === prev ? 'leaving' : 'idle'
        return (
          <div key={slide.id} className={t.slide} data-state={state} aria-hidden="true">
            <div className={t.kb} style={{ '--kb-origin': ORIGINS[i % ORIGINS.length] } as React.CSSProperties}>
              <Picture src={slide.src} srcSet={slide.srcSet} avifSrcSet={slide.avifSrcSet} sizes="(max-width: 760px) 360px, 100vw" alt="" />
            </div>
          </div>
        )
      })}
    </>
  )
}

/** «01 / 04» in the hero bar; follows HeroSlides through a window event. */
export function HeroCounter({ total }: { total: number }) {
  const still = useStill()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const on = (e: Event) => setIndex(Number((e as CustomEvent<number>).detail) || 0)
    window.addEventListener(FRAME_EVENT, on)
    return () => window.removeEventListener(FRAME_EVENT, on)
  }, [])
  const pad = (v: number) => String(v).padStart(2, '0')
  if (still) return null
  return (
    <span className={`${t.label} ${t.heroLabel} ${t.counter}`} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={index}
          className={t.counterNow}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          {pad(index + 1)}
        </m.span>
      </AnimatePresence>
      <span>/</span>
      <span>{pad(total)}</span>
    </span>
  )
}

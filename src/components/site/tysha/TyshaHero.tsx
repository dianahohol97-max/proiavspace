'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'motion/react'
import { MagneticButton } from '../motion/MagneticButton'
import { RevealText } from '../motion/RevealText'
import { EASE_OUT, useStill } from '../motion/useStill'
import k from '../motion/motion.module.css'
import t from './Tysha.module.css'

export interface HeroSlide {
  id: string
  src: string
  alt: string
}

const FRAME_MS = 6500
/** Ken Burns drifts toward a different corner on every frame. */
const ORIGINS = ['50% 40%', '30% 60%', '70% 35%', '45% 70%']

/**
 * Full-screen hero: up to four portfolio frames cross-fading with a slow Ken
 * Burns drift. The first frame is the LCP image (priority, rendered on the
 * server); the rest mount only after it has loaded so they never compete with
 * it. The name rises letter by letter once the first frame is in; subtitle
 * and the booking CTA follow. Reduced motion: one still frame, static text.
 */
export function TyshaHero({
  slides,
  title,
  subtitle,
  cta,
  scrollHint,
  scrollTarget,
}: {
  slides: HeroSlide[]
  title: string
  subtitle: string
  cta: { href: string; label: string } | null
  scrollHint: string
  scrollTarget: string
}) {
  const still = useStill()
  const [loaded, setLoaded] = useState(false)
  const [restMounted, setRestMounted] = useState(false)
  const [{ index, prev }, setFrame] = useState<{ index: number; prev: number | null }>({
    index: 0,
    prev: null,
  })
  const n = slides.length
  const hasPhoto = n > 0
  const playing = hasPhoto && n > 1 && !still

  // Safety net: never hold the title back for a slow or broken image.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), hasPhoto ? 1600 : 0)
    return () => window.clearTimeout(timer)
  }, [hasPhoto])

  useEffect(() => {
    if (!loaded || !playing) return
    const timer = window.setTimeout(() => setRestMounted(true), 400)
    return () => window.clearTimeout(timer)
  }, [loaded, playing])

  useEffect(() => {
    if (!restMounted || !playing) return
    const timer = window.setInterval(() => {
      setFrame((f) => ({ index: (f.index + 1) % n, prev: f.index }))
    }, FRAME_MS)
    return () => window.clearInterval(timer)
  }, [restMounted, playing, n])

  const pad = (v: number) => String(v).padStart(2, '0')
  const appear = (delay: number) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: loaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
          transition: { duration: 1.1, ease: EASE_OUT, delay },
        }
  const letters = Array.from(title).length
  const afterTitle = Math.min(0.5 + letters * 0.035, 1.3)

  return (
    <header id="top" className={`${t.hero} ${hasPhoto ? '' : t.heroPlain}`}>
      {hasPhoto && (
        <div className={t.slides}>
          {slides.map((slide, i) => {
            if (i > 0 && !restMounted) return null
            const state = i === index ? 'active' : i === prev ? 'leaving' : 'idle'
            return (
              <div
                key={slide.id}
                className={t.slide}
                data-state={state}
                aria-hidden={i === 0 ? undefined : true}
              >
                <div
                  className={t.kb}
                  style={{ '--kb-origin': ORIGINS[i % ORIGINS.length] } as React.CSSProperties}
                >
                  <Image
                    src={slide.src}
                    alt={i === 0 ? slide.alt : ''}
                    fill
                    sizes="100vw"
                    priority={i === 0}
                    onLoad={i === 0 ? () => setLoaded(true) : undefined}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {hasPhoto && <div className={t.heroShade} aria-hidden="true" />}

      <div className={`${t.wrap} ${t.heroInner}`}>
        <div className={t.heroCopy}>
          <RevealText as="h1" by="letters" text={title} play={loaded} className={t.heroTitle} />
          <div className={t.heroRow}>
            {subtitle && (
              <m.p className={`${t.heroSub} ${k.guard}`} data-motion="" {...appear(afterTitle)}>
                {subtitle}
              </m.p>
            )}
            {cta && (
              <m.div className={k.guard} data-motion="" {...appear(afterTitle + 0.15)}>
                <MagneticButton href={cta.href} className={t.ctaLight}>
                  {cta.label} <span className={t.arrow}>→</span>
                </MagneticButton>
              </m.div>
            )}
          </div>
        </div>

        <div className={t.heroBar}>
          <a href={scrollTarget} className={`${t.label} ${t.heroLabel} ${t.scrollHint}`}>
            <span className={t.scrollLine} aria-hidden="true" />
            {scrollHint}
          </a>
          {playing && (
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
              <span>{pad(n)}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

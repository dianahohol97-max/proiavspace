'use client'

import { m, type Variants } from 'motion/react'
import { EASE_OUT, useStill } from './useStill'
import k from './motion.module.css'

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'

/**
 * Text that rises out of a mask, word by word or letter by letter, going from
 * a soft blur to sharp. The full string stays in the DOM (aria-label on the
 * element + real text in the spans), so SEO and screen readers get the text;
 * only transform / opacity / filter animate.
 *
 * `play` undefined → plays when scrolled into view (once); a boolean lets
 * the caller start it (e.g. hero: after the first frame has loaded).
 */
export function RevealText({
  text,
  as = 'span',
  by = 'words',
  play,
  delay = 0,
  stagger,
  className,
  id,
}: {
  text: string
  as?: Tag
  by?: 'words' | 'letters'
  play?: boolean
  delay?: number
  stagger?: number
  className?: string
  id?: string
}) {
  const still = useStill()
  const Tag = as
  if (still || !text) {
    return (
      <Tag className={className} id={id}>
        {text}
      </Tag>
    )
  }

  const step = stagger ?? (by === 'letters' ? 0.035 : 0.07)
  const container: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: step, delayChildren: delay } },
  }
  const piece: Variants = {
    hidden: { y: '105%', opacity: 0, filter: 'blur(8px)' },
    shown: {
      y: '0%',
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: by === 'letters' ? 1.1 : 1.0, ease: EASE_OUT },
    },
  }
  const MTag = m[Tag]
  const words = text.split(/(\s+)/)
  const trigger =
    play === undefined
      ? { whileInView: 'shown', viewport: { once: true, amount: 0.4 } }
      : { animate: play ? 'shown' : 'hidden' }

  return (
    <MTag
      className={`${k.guard} ${className ?? ''}`}
      id={id}
      aria-label={text}
      initial="hidden"
      variants={container}
      data-motion=""
      {...trigger}
    >
      {words.map((word, wi) =>
        /^\s+$/.test(word) ? (
          ' '
        ) : (
          <span key={wi} className={k.mask} aria-hidden="true">
            {by === 'letters' ? (
              Array.from(word).map((ch, ci) => (
                <m.span key={ci} className={k.piece} variants={piece}>
                  {ch}
                </m.span>
              ))
            ) : (
              <m.span className={k.piece} variants={piece}>
                {word}
              </m.span>
            )}
          </span>
        )
      )}
    </MTag>
  )
}

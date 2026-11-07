import k from './motion.module.css'

/**
 * Large text whose words «light up» (opacity 0.2 → 1) as the block scrolls
 * through the viewport — CSS scroll-driven animation on a named view
 * timeline, zero JS. Unsupported browsers and reduced motion: fully lit.
 * `tone="warm"` («Опівніч»): each word catches a candle — a soft amber glow
 * (filter: drop-shadow) that flares as it lights and then settles.
 */
export function ScrollLitText({
  text,
  className,
  as = 'p',
  tone = 'plain',
}: {
  text: string
  className?: string
  as?: 'p' | 'blockquote' | 'div'
  tone?: 'plain' | 'warm'
}) {
  const Tag = as
  const words = text.split(/\s+/).filter(Boolean)
  const n = Math.max(words.length, 1)
  return (
    <Tag className={`${k.lit} ${className ?? ''}`}>
      {words.map((word, i) => {
        // Each word lights over a short window; windows march through the
        // first ~60% of the block's travel so the last word is lit while
        // the text is still comfortably on screen.
        const start = 8 + (i / n) * 42
        return (
          <span
            key={i}
            className={tone === 'warm' ? `${k.litWord} ${k.litWarm}` : k.litWord}
            style={{ '--lit-a': `${start.toFixed(1)}%`, '--lit-b': `${(start + 10).toFixed(1)}%` } as React.CSSProperties}
          >
            {word}{' '}
          </span>
        )
      })}
    </Tag>
  )
}

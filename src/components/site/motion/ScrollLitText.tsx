import k from './motion.module.css'

/**
 * Large text whose words «light up» (opacity 0.2 → 1) as the block scrolls
 * through the viewport — CSS scroll-driven animation on a named view
 * timeline, zero JS. Unsupported browsers and reduced motion: fully lit.
 */
export function ScrollLitText({
  text,
  className,
  as = 'p',
}: {
  text: string
  className?: string
  as?: 'p' | 'blockquote' | 'div'
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
            className={k.litWord}
            style={{ '--lit-a': `${start.toFixed(1)}%`, '--lit-b': `${(start + 10).toFixed(1)}%` } as React.CSSProperties}
          >
            {word}{' '}
          </span>
        )
      })}
    </Tag>
  )
}

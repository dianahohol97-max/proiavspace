'use client'

import { useId, useState } from 'react'

/**
 * «До / після ретуші»: the «після» frame with the «до» frame clipped over it;
 * a native range input drives the split, so dragging, tapping and the arrow
 * keys all work and screen readers announce the position. Server-rendered
 * at 50% — without JS the visitor still sees both halves.
 */
export function BeforeAfter({
  before,
  after,
  ratio,
  labels,
  className,
  skin,
}: {
  before: { src: string; srcSet?: string }
  after: { src: string; srcSet?: string; avifSrcSet?: string }
  ratio: string
  labels: { before: string; after: string; compare: string }
  className?: string
  skin: Record<string, string>
}) {
  const [pos, setPos] = useState(50)
  const id = useId()
  return (
    <div className={`${skin.ba} ${className ?? ''}`} style={{ '--pos': `${pos}%`, '--r': ratio } as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={skin.baImg} src={after.src} srcSet={after.srcSet} sizes="(max-width: 760px) 92vw, 46vw" alt={labels.after} loading="lazy" decoding="async" />
      <div className={skin.baBefore}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={skin.baImg} src={before.src} srcSet={before.srcSet} sizes="(max-width: 760px) 92vw, 46vw" alt={labels.before} loading="lazy" decoding="async" />
      </div>
      <span className={skin.baTagBefore} aria-hidden="true">
        {labels.before}
      </span>
      <span className={skin.baTagAfter} aria-hidden="true">
        {labels.after}
      </span>
      <span className={skin.baHandle} aria-hidden="true" />
      <label htmlFor={id} className={skin.baSr}>
        {labels.compare}
      </label>
      <input
        id={id}
        className={skin.baRange}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        suppressHydrationWarning
      />
    </div>
  )
}

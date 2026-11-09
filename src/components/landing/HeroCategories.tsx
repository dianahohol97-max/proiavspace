'use client'

import { createContext, useCallback, useContext, useId, useRef, useState } from 'react'
import { LandingPhoto } from '@/components/landing/LandingPhoto'
import type { HeroCategory, HeroFrame } from '@/lib/landing/hero-categories'
import s from '@/app/[locale]/landing.module.css'

/**
 * The hero's category chips (Весілля / Портрети …) as real tabs: picking one
 * crossfades the frames of the gallery mock and the gallery card, and swaps
 * the card's title. Without JS the first category is what the server renders
 * — the same first screen as before.
 *
 * Frames of a category are only mounted once it is hovered, focused or
 * picked, so the first load fetches exactly the frames it shows.
 */

interface State {
  active: number
  /** The category being faded out (stays opaque under the new one). */
  prev: number | null
  /** Categories whose frames are mounted. */
  seen: number[]
  select: (index: number) => void
  warm: (index: number) => void
  tabId: (index: number) => string
  panelId: string
}

const Ctx = createContext<State | null>(null)
const useHero = () => {
  const value = useContext(Ctx)
  if (!value) throw new Error('HeroCategories: missing provider')
  return value
}

export function HeroCategoryProvider({ className, children }: { className?: string; children: React.ReactNode }) {
  const [active, setActive] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [seen, setSeen] = useState<number[]>([0])
  const base = useId()

  const warm = useCallback((index: number) => {
    setSeen((list) => (list.includes(index) ? list : [...list, index]))
  }, [])
  const select = useCallback(
    (index: number) => {
      warm(index)
      setActive((current) => {
        if (current !== index) setPrev(current)
        return index
      })
    },
    [warm]
  )

  return (
    <Ctx.Provider
      value={{ active, prev, seen, select, warm, tabId: (i) => `${base}-tab-${i}`, panelId: `${base}-panel` }}
    >
      <header className={className}>{children}</header>
    </Ctx.Provider>
  )
}

/** The chips: role=tablist, ←/→ (and Home/End) move between them. */
export function HeroTabs({ labels }: { labels: string[] }) {
  const { active, select, warm, tabId, panelId } = useHero()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = labels.length - 1
    const next =
      event.key === 'ArrowRight' ? (active === last ? 0 : active + 1)
      : event.key === 'ArrowLeft' ? (active === 0 ? last : active - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    select(next)
    refs.current[next]?.focus()
  }

  return (
    <div className={s.chips} role="tablist" onKeyDown={onKeyDown}>
      {labels.map((label, index) => {
        const on = index === active
        return (
          <button
            key={label}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            id={tabId(index)}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            className={on ? s.chipOn : s.chip}
            onClick={() => select(index)}
            onPointerEnter={() => warm(index)}
            onFocus={() => warm(index)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** The decorative stage, as the tab panel of the chips. */
export function HeroStage({ className, children }: { className?: string; children: React.ReactNode }) {
  const { active, tabId, panelId } = useHero()
  return (
    <div className={className} id={panelId} role="tabpanel" aria-labelledby={tabId(active)}>
      <div className={s.stageInner} aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

function layerState(index: number, active: number, prev: number | null) {
  return index === active ? 'on' : index === prev ? 'prev' : 'off'
}

/**
 * One photo slot (`.ph` frame) holding a layer per mounted category; the
 * active layer fades in on top of the previous one.
 */
export function HeroSlot({
  categories,
  slot,
  sizes,
  part,
  priority,
}: {
  categories: HeroCategory[]
  slot: number
  sizes: string
  part: 'grid' | 'row'
  priority?: boolean
}) {
  const { active, prev, seen } = useHero()
  return (
    <div className={s.ph}>
      {categories.map((category, index) => {
        if (!seen.includes(index)) return null
        const frame: HeroFrame = category[part][slot]
        return (
          <LandingPhoto
            key={category.key}
            name={frame.name}
            kind={frame.kind}
            sizes={sizes}
            width={frame.wide ? 3 : 2}
            height={frame.wide ? 2 : 3}
            priority={priority && index === 0}
            // The card's strip sits below the fold on phones: lazy there.
            eager={index === 0 && part === 'grid'}
            className={s.layer}
            dataState={layerState(index, active, prev)}
          />
        )
      })}
    </div>
  )
}

/** The gallery card's title, stacked per category so the card never changes height. */
export function HeroGalleryTitle({ titles, className }: { titles: string[]; className?: string }) {
  const { active, prev } = useHero()
  return (
    <div className={className}>
      {titles.map((title, index) => (
        <span key={title} className={s.layerText} data-state={layerState(index, active, prev)}>
          {title}
        </span>
      ))}
    </div>
  )
}

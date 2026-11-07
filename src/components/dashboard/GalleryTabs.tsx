'use client'

import { useEffect, useRef, useState } from 'react'
import { GALLERY_TABS, parseGalleryTab, type GalleryTab } from '@/lib/dashboard/tabs'

/** Switch tabs from anywhere on the page (hints: «Оформити» → design). */
export const TAB_EVENT = 'proiav:gallery-tab'

/**
 * «Фото · Дизайн · Доступ · Клієнт». Every panel stays mounted (hidden, not
 * removed), so an upload keeps running while the photographer styles the
 * gallery. The tab lives in ?tab= so a reload or a shared link reopens it.
 */
export function GalleryTabs({
  initialTab,
  labels,
  ariaLabel,
  badges,
  header,
  panels,
}: {
  initialTab: GalleryTab
  labels: Record<GalleryTab, string>
  ariaLabel: string
  /** Small counters next to a tab name (photos count, favorites). */
  badges?: Partial<Record<GalleryTab, number>>
  /** Title, status and «Поділитися» — sticky together with the tab bar. */
  header: React.ReactNode
  panels: Record<GalleryTab, React.ReactNode>
}) {
  const [tab, setTab] = useState<GalleryTab>(initialTab)
  const listRef = useRef<HTMLDivElement>(null)

  function select(next: GalleryTab, focus = false) {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    url.searchParams.delete('created')
    url.searchParams.delete('share')
    window.history.replaceState(window.history.state, '', url)
    if (focus) listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus()
  }

  useEffect(() => {
    const onTab = (event: Event) => {
      select(parseGalleryTab((event as CustomEvent<string>).detail))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener(TAB_EVENT, onTab)
    return () => window.removeEventListener(TAB_EVENT, onTab)
  }, [])

  function onKeyDown(event: React.KeyboardEvent) {
    const index = GALLERY_TABS.indexOf(tab)
    if (event.key === 'ArrowRight') select(GALLERY_TABS[(index + 1) % GALLERY_TABS.length], true)
    else if (event.key === 'ArrowLeft') select(GALLERY_TABS[(index + GALLERY_TABS.length - 1) % GALLERY_TABS.length], true)
  }

  return (
    <>
      <div
        data-testid="gallery-header"
        className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg px-4 pt-3 sm:-mx-6 sm:px-6 sm:pt-5"
      >
        {header}
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:mt-3 sm:px-0"
        >
          {GALLERY_TABS.map((key) => {
            const active = key === tab
            const badge = badges?.[key]
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                data-tab={key}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(key)}
                className={`flex min-h-[44px] flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-bold transition-colors sm:px-4 ${
                  active ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {labels[key]}
                {badge !== undefined && badge > 0 && (
                  <span className="rounded-full bg-bg px-1.5 text-[11px] font-extrabold text-muted">{badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {GALLERY_TABS.map((key) => (
        <section
          key={key}
          role="tabpanel"
          id={`panel-${key}`}
          aria-labelledby={`tab-${key}`}
          hidden={key !== tab}
          data-panel={key}
          className="pt-6 sm:pt-8"
        >
          {panels[key]}
        </section>
      ))}
    </>
  )
}

/** A button that switches the page's tabs (used inside hints). */
export function GoToTabButton({ tab, label, className }: { tab: GalleryTab; label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: tab }))} className={className}>
      {label}
    </button>
  )
}

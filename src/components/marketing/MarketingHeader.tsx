'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Logo } from '@/components/Logo'
import { LangList, LangPicker } from '@/components/LangPicker'
import { AuthNav, useAuthed, type AuthNavLabels } from '@/components/landing/AuthNav'
import type { Locale } from '@/lib/i18n/config'
import type { NavLink } from '@/lib/seo/nav'
import h from './MarketingHeader.module.css'

export interface MarketingHeaderLabels extends AuthNavLabels {
  homeAria: string
  mainNavAria: string
  menuOpen: string
  menuClose: string
  language: string
}

/** Below this width the links fold into the burger panel (matches the CSS). */
const MOBILE_QUERY = '(max-width: 900px)'
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The one header of every marketing page — the landing and the inner pages
 * (pricing, blog, help, product pages): sticky, page-coloured, with a soft
 * blur and a hairline once the page is scrolled. On phones the links fold
 * into a full-width panel behind a burger button.
 */
export function MarketingHeader({
  locale,
  links,
  labels,
  current,
  onLanding = false,
  maxWidth = 1180,
}: {
  locale: Locale
  links: NavLink[]
  labels: MarketingHeaderLabels
  /** href of the current page's nav item, marked with aria-current. */
  current?: string
  /** On the landing itself, `/{locale}#pricing` links become plain `#pricing`. */
  onLanding?: boolean
  /** Content width of the page under the header, so the logo lines up. */
  maxWidth?: number
}) {
  const authed = useAuthed()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Hairline + blur only once the page has moved.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = useCallback((restoreFocus = true) => {
    // Unlock right away (not in an effect): a hash link clicked in the panel
    // must scroll the page in this same click.
    document.documentElement.style.overflow = ''
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      // Keep Tab inside the panel while it is open.
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    // Rotating a tablet to landscape: the panel has no place there.
    const mq = window.matchMedia(MOBILE_QUERY)
    const onMq = () => {
      if (!mq.matches) close(false)
    }
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      root.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [open, close])

  const navItem = (link: NavLink, className?: string, onClick?: () => void) => {
    const isCurrent = current === link.href
    const common = {
      className,
      onClick,
      'aria-current': isCurrent ? ('page' as const) : undefined,
    }
    if (onLanding && link.href.includes('#')) {
      return (
        <a key={link.href} href={link.href.slice(link.href.indexOf('#'))} {...common}>
          {link.label}
        </a>
      )
    }
    return (
      <Link key={link.href} href={link.href} {...common}>
        {link.label}
      </Link>
    )
  }

  const onItem = () => close(false)
  const authHref = authed ? `/${locale}/dashboard` : `/${locale}/login`

  return (
    <>
      <header className={h.header} data-scrolled={scrolled ? '' : undefined} data-menu-open={open ? '' : undefined}>
        <div className={h.inner} style={{ maxWidth }}>
          <Link href={`/${locale}`} className={h.logo} aria-label={labels.homeAria}>
            <Logo />
          </Link>
          <nav aria-label={labels.mainNavAria} className={h.links}>
            {links.map((link) => navItem(link, h.link))}
          </nav>
          <div className={h.actions}>
            <AuthNav locale={locale} labels={labels} authed={authed} linkClassName={h.signIn} ctaClassName={h.cta} />
            <span className={h.lang}>
              <LangPicker current={locale} label={labels.language} />
            </span>
            <button
              ref={buttonRef}
              type="button"
              className={h.burger}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={labels.menuOpen}
              onClick={() => (open ? close() : setOpen(true))}
            >
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* A sibling of <header>, not a child: the header's backdrop-filter
          would make it the containing block of this fixed overlay. */}
      <div className={h.overlay} hidden={!open} onClick={() => close()} data-testid="menu-overlay">
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label={labels.menuOpen}
          className={h.panel}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={h.panelTop} style={{ maxWidth }}>
            <Link href={`/${locale}`} className={h.logo} aria-label={labels.homeAria} onClick={onItem}>
              <Logo />
            </Link>
            <button type="button" className={h.burger} aria-label={labels.menuClose} onClick={() => close()}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            </button>
          </div>
          <nav aria-label={labels.mainNavAria} className={h.panelNav} style={{ maxWidth }}>
            {links.map((link) => navItem(link, h.panelLink, onItem))}
            <Link href={authHref} className={h.panelLink} onClick={onItem}>
              {authed ? labels.dashboard : labels.signIn}
            </Link>
          </nav>
          <div className={h.panelLang} style={{ maxWidth }}>
            <span className={h.panelLangLabel}>{labels.language}</span>
            <LangList current={locale} label={labels.language} className={h.langList} onNavigate={onItem} />
          </div>
        </div>
      </div>
    </>
  )
}

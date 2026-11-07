'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { SiteLangSwitch } from '../SiteLangSwitch'
import type { LangSwitch } from '../SiteRenderer'
import { EASE_OUT, useStill } from '../motion/useStill'
import t from './Tysha.module.css'

export interface NavLink {
  href: string
  label: string
}

/**
 * Transparent over the hero; once the page scrolls it becomes a thin
 * blurred bar, slides away while scrolling down and returns on the way up.
 * Below 960px the links fold into a full-screen menu whose items rise in
 * one after another.
 */
export function TyshaNav({
  brand,
  logoUrl,
  links,
  cta,
  langSwitch,
  overHero,
  menuLabel,
  closeLabel,
  footLinks,
}: {
  brand: string
  logoUrl: string | null
  links: NavLink[]
  cta: NavLink | null
  langSwitch?: LangSwitch
  /** True when a photo hero sits under the nav → light text at the top. */
  overHero: boolean
  menuLabel: string
  closeLabel: string
  /** Contacts shown at the bottom of the mobile menu. */
  footLinks: NavLink[]
}) {
  const still = useStill()
  const [solid, setSolid] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const lastY = useRef(0)
  const menuBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        setSolid(y > 24)
        const delta = y - lastY.current
        if (Math.abs(delta) > 6) {
          setHidden(delta > 0 && y > 240)
          lastY.current = y
        }
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // Menu open: lock the page, close on Escape, return focus to the button.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const button = menuBtn.current
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      button?.focus()
    }
  }, [open])

  const wordmark = (
    <a href="#top" className={t.wordmark} aria-label={brand}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand} />
      ) : (
        brand
      )}
    </a>
  )

  const menuItems = [...links, ...(cta ? [cta] : [])]
  const itemMotion = still
    ? {}
    : {
        initial: { y: '110%', opacity: 0 },
        animate: { y: '0%', opacity: 1 },
        exit: { y: '-40%', opacity: 0, transition: { duration: 0.25 } },
      }

  return (
    <>
      <nav
        className={t.nav}
        data-solid={solid || !overHero ? 'true' : 'false'}
        data-over={overHero ? 'true' : 'false'}
        data-hidden={hidden && !open ? 'true' : 'false'}
        aria-label={menuLabel}
      >
        <div className={`${t.wrap} ${t.navInner}`}>
          {wordmark}
          <div className={t.navLinks}>
            {links.map((link) => (
              <a key={link.href} href={link.href} className={t.navLink}>
                {link.label}
              </a>
            ))}
            {langSwitch && (
              <span className={t.lang}>
                <SiteLangSwitch langSwitch={langSwitch} />
              </span>
            )}
            {cta && (
              <a href={cta.href} className={t.navCta}>
                {cta.label}
              </a>
            )}
          </div>
          <button
            ref={menuBtn}
            type="button"
            className={t.menuBtn}
            aria-expanded={open}
            aria-controls="tysha-menu"
            onClick={() => setOpen(true)}
          >
            {menuLabel}
            <span className={t.menuBtnLines} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <m.div
            id="tysha-menu"
            className={t.menu}
            role="dialog"
            aria-modal="true"
            aria-label={menuLabel}
            initial={still ? false : { clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={still ? undefined : { clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: still ? 0 : 0.7, ease: EASE_OUT }}
          >
            <div className={t.menuTop}>
              {wordmark}
              <button
                type="button"
                className={t.menuBtn}
                style={{ display: 'inline-flex' }}
                onClick={() => setOpen(false)}
                autoFocus
              >
                {closeLabel} ✕
              </button>
            </div>
            <ul className={t.menuList}>
              {menuItems.map((link, i) => (
                <li key={`${link.href}-${i}`} className={t.menuItem}>
                  <m.a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    {...itemMotion}
                    transition={{ duration: 0.8, ease: EASE_OUT, delay: still ? 0 : 0.18 + i * 0.07 }}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {link.label}
                  </m.a>
                </li>
              ))}
            </ul>
            <div className={t.menuFoot}>
              {footLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
              {langSwitch && (
                <span className={t.lang}>
                  <SiteLangSwitch langSwitch={langSwitch} />
                </span>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}

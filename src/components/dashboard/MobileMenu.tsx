'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Mobile dashboard menu: a ☰ button that opens a dropdown holding the full
 * navigation, storage meter and sign-out. Closes on navigation (pathname
 * change) and on Escape, so a phone user can always reach every tab — and
 * actually log out, which the cramped scrolling top bar never exposed.
 */
export function MobileMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-lg text-fg"
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <>
          {/* tap-outside backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-3 shadow-xl">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

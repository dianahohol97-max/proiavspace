'use client'

import { PACK_EVENT, PACK_PENDING } from './packEvent'

/** «Обрати» under a pricing card: jumps to the form with this package chosen. */
export function PackCta({
  pack,
  href,
  className,
  children,
}: {
  pack: string
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        // The form is a lazy island: if it has not mounted yet, it picks the
        // topic up from here when it does.
        ;(window as unknown as Record<string, unknown>)[PACK_PENDING] = pack
        window.dispatchEvent(new CustomEvent(PACK_EVENT, { detail: pack }))
      }}
    >
      {children}
    </a>
  )
}

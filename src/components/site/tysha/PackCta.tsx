'use client'

import { PACK_EVENT } from './TyshaLeadForm'

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
      onClick={() => window.dispatchEvent(new CustomEvent(PACK_EVENT, { detail: pack }))}
    >
      {children}
    </a>
  )
}

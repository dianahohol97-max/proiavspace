'use client'

import { DATE_EVENT, DATE_PENDING } from '../tysha/packEvent'

/** A free date on the calendar: jumps to the form (or booking) with the date filled in. */
export function DateCta({
  date,
  href,
  className,
  label,
  children,
}: {
  date: string
  href: string
  className?: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      onClick={() => {
        ;(window as unknown as Record<string, unknown>)[DATE_PENDING] = date
        window.dispatchEvent(new CustomEvent(DATE_EVENT, { detail: date }))
      }}
    >
      {children}
    </a>
  )
}

import type { SiteContent } from '@/lib/site/content'
import type { LeadFormLabels } from './LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from './SiteRenderer'
import { ThemeOpivnich } from './midnight/ThemeOpivnich'
import { ThemeTysha } from './tysha/ThemeTysha'

/**
 * Catalog theme `tysha` (value kept for existing sites): light mode is
 * «Тиша» (./tysha), night mode — catalog value 'opivnich' — is «Опівніч»
 * (./midnight), a theme of its own built on the same kit.
 */
export function ThemeSilence({
  night = false,
  ...props
}: {
  content: SiteContent
  displayName: string | null
  logoUrl: string | null
  portfolio: PortfolioItem[]
  labels: SiteLabels
  langSwitch?: LangSwitch
  leadForm?: { handle: string | null; labels: LeadFormLabels }
  bookingNav?: BookingNav
  /** «Опівніч» (mode 'night'). */
  night?: boolean
  /** Free-plan «Сайт на проЯв» credit in the footer. */
  platformCredit?: boolean
}) {
  return night ? <ThemeOpivnich {...props} /> : <ThemeTysha {...props} />
}

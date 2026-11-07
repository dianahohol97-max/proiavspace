import type { SiteContent } from '@/lib/site/content'
import type { LeadFormLabels } from './LeadForm'
import type { BookingNav, LangSwitch, PortfolioItem, SiteLabels } from './SiteRenderer'
import { ThemeMidnight } from './ThemeMidnight'
import { ThemeTysha } from './tysha/ThemeTysha'

/**
 * Catalog theme `tysha`: light mode is «Тиша» (the premium rebuild in
 * ./tysha), night mode is «Опівніч», which keeps its own original layout.
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
  /** «Опівніч»: night hero — the giant name over drifting photos. */
  night?: boolean
  /** «Тиша» only: free-plan «Сайт на проЯв» credit in the footer. */
  platformCredit?: boolean
}) {
  const { platformCredit, ...shared } = props
  return night ? (
    <ThemeMidnight {...shared} night />
  ) : (
    <ThemeTysha {...shared} platformCredit={platformCredit} />
  )
}

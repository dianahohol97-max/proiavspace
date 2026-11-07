/**
 * Where a site's «Забронювати дату» button leads. Every theme renders the
 * button from content.contact.bookingUrl, so resolving it once on the server
 * covers SiteRenderer and all themes without touching theme files.
 *
 *  1. Booking is on and there are open (Google-free) dates → '#booking', the
 *     inline booking section.
 *  2. Otherwise a link the photographer typed themselves (e.g. their own
 *     scheduler) is kept — except our own booking links, which would only
 *     show "no free dates".
 *  3. Otherwise, with the inquiry form on → '#contact', the section that
 *     holds the form in every theme.
 *  4. Nothing to lead to → '' (themes hide the button, as before).
 */
export function resolveBookHref(input: {
  bookingActive: boolean
  customUrl: string | null | undefined
  leadForm: boolean
}): string {
  if (input.bookingActive) return '#booking'
  const custom = (input.customUrl ?? '').trim()
  const ownBookingLink = custom === '#booking' || /\/b\/[a-z0-9-]+\/?$/i.test(custom)
  if (custom && !ownBookingLink) return custom
  return input.leadForm ? '#contact' : ''
}

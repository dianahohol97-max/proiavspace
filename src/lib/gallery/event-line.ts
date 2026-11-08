import { intlLocale } from '@/lib/i18n/format'

/**
 * The line under the title on the client cover: «14 вересня 2026 · опис».
 * One helper for the client gallery and the designer's preview, so both say
 * exactly the same thing.
 */
export function galleryEventLine(
  eventDate: string | null | undefined,
  description: string | null | undefined,
  locale: string
): string | null {
  const line = [
    eventDate
      ? new Date(eventDate).toLocaleDateString(intlLocale(locale), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null,
    description,
  ]
    .filter(Boolean)
    .join(' · ')
  return line || null
}

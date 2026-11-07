import { DateCta } from './DateCta'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Two months of the calendar with the photographer's free dates marked; a
 * free date leads to the form (or the booking section) with that date filled
 * in. Server-rendered; only the links are a client component.
 */
export function FreeCalendar({
  dates,
  href,
  locale = 'uk',
  title,
  freeWord,
  s,
}: {
  dates: string[]
  href: string
  locale?: string
  title: string
  freeWord: string
  s: Record<string, string>
}) {
  const free = new Set(dates)
  const first = new Date(`${dates[0]}T12:00:00`)
  const months = [0, 1].map((k) => new Date(first.getFullYear(), first.getMonth() + k, 1, 12))
  const today = new Date().toISOString().slice(0, 10)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale === 'en' ? 'en-GB' : 'uk-UA', { weekday: 'short' })
  )
  return (
    <div className={s.calendar}>
      <p className={s.calTitle}>{title}</p>
      <div className={s.calMonths}>
        {months.map((m) => {
          const y = m.getFullYear()
          const mo = m.getMonth()
          const days = new Date(y, mo + 1, 0).getDate()
          const lead = (new Date(y, mo, 1).getDay() + 6) % 7
          const name = m.toLocaleDateString(locale === 'en' ? 'en-GB' : 'uk-UA', { month: 'long' })
          return (
            <div key={`${y}-${mo}`} className={s.calMonth}>
              <p className={s.calName}>{name}</p>
              <div className={s.calGrid}>
                {weekdays.map((w) => (
                  <span key={w} className={s.calWd} aria-hidden="true">
                    {w}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`e${i}`} />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const iso = `${y}-${pad(mo + 1)}-${pad(i + 1)}`
                  if (free.has(iso) && iso >= today) {
                    const label = `${new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'long' })} — ${freeWord}`
                    return (
                      <DateCta key={iso} date={iso} href={href} className={s.calFree} label={label}>
                        {i + 1}
                      </DateCta>
                    )
                  }
                  return (
                    <span key={iso} className={iso < today ? s.calPast : s.calDay}>
                      {i + 1}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

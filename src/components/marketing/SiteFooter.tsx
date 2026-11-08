import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { FOOTER_UK } from '@/lib/seo/nav'
import { getLandingCopy } from '@/lib/landing/copy'
import { isLocale } from '@/lib/i18n/config'

/** Footer for inner marketing pages: the internal-link hub to every product page. */
export function SiteFooter({ locale }: { locale: string }) {
  const uk = locale === 'uk'
  const t = getLandingCopy(isLocale(locale) ? locale : 'uk').footer
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 sm:grid-cols-4">
        <div>
          <Logo size={19} textSize={14} />
          <p className="mt-4 text-sm leading-6 text-muted">
            {t.tagline}
          </p>
        </div>
        {uk ? (
          FOOTER_UK.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3 text-sm">
              <p className="font-semibold text-fg">{col.title}</p>
              {col.links.map((link) => (
                <Link key={link.href} href={link.href} className="text-muted no-underline hover:text-fg">
                  {link.label}
                </Link>
              ))}
            </nav>
          ))
        ) : (
          <nav className="flex flex-col gap-3 text-sm sm:col-span-3">
            <Link href="/uk/blog" className="text-muted no-underline hover:text-fg">{t.blog}</Link>
            <Link href={`/${locale}/oferta`} className="text-muted no-underline hover:text-fg">{t.terms}</Link>
            <Link href={`/${locale}/privacy`} className="text-muted no-underline hover:text-fg">{t.privacy}</Link>
          </nav>
        )}
      </div>
      <p className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted">© {year} проЯв</p>
    </footer>
  )
}

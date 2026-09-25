import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { primaryNav } from '@/lib/seo/nav'

/** Header for inner marketing pages (blog, product pages). */
export function SiteHeader({ locale, current }: { locale: string; current?: string }) {
  const uk = locale === 'uk'
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6">
      <Link href={`/${locale}`} className="text-fg no-underline" aria-label={uk ? 'проЯв — на головну' : 'proiav — home'}>
        <Logo />
      </Link>
      <nav aria-label={uk ? 'Головне меню' : 'Main'} className="hidden items-center gap-7 text-sm text-muted sm:flex">
        {primaryNav(locale).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current === link.href ? 'page' : undefined}
            className={current === link.href ? 'font-semibold text-fg no-underline' : 'no-underline hover:text-fg'}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href={`/${locale}/login`}
        className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-accent-deep"
      >
        {uk ? 'Почати безкоштовно' : 'Start for free'}
      </Link>
    </header>
  )
}

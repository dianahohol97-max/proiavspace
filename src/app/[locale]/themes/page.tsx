import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { THEME_DEMOS } from '@/lib/site/demoContent'
import { SiteRenderer, type SiteLabels } from '@/components/site/SiteRenderer'
import { Logo } from '@/components/Logo'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const uk = params.locale === 'uk'
  const title = uk ? 'Теми сайтів для фотографів — проЯв' : 'Site themes for photographers — proiav'
  const description = uk
    ? 'Вісім готових тем для персонального сайту фотографа: весілля, сімейні, фешн, документальна та комерційна зйомка.'
    : 'Eight ready themes for a photographer’s personal site: weddings, family, fashion, documentary and commercial.'
  return {
    title,
    description,
    alternates: { canonical: `/${params.locale}/themes` },
    openGraph: { type: 'website', title, description, url: `/${params.locale}/themes` },
  }
}

export default function ThemesPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const uk = locale === 'uk'

  const labels: SiteLabels = {
    portfolio: uk ? 'Портфоліо' : 'Portfolio',
    about: uk ? 'Про мене' : 'About',
    pricing: uk ? 'Ціни' : 'Pricing',
    contacts: uk ? 'Контакти' : 'Contacts',
    book: uk ? 'Забронювати зйомку' : 'Book a shoot',
    photos: uk ? 'фото' : 'photos',
    viewSeries: uk ? 'Дивитись серію' : 'View series',
    close: uk ? 'Закрити' : 'Close',
  }
  const leadFormLabels = {
    title: uk ? 'Залишити заявку' : 'Get in touch',
    name: uk ? 'Ваше імʼя' : 'Your name',
    contact: uk ? 'Телефон або email' : 'Phone or email',
    message: uk ? 'Кілька слів про зйомку' : 'A few words about the shoot',
    send: uk ? 'Надіслати' : 'Send',
    sent: uk ? 'Надіслано' : 'Sent',
    error: uk ? 'Помилка' : 'Error',
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href={`/${locale}`} className="text-fg no-underline">
          <Logo />
        </Link>
        <Link
          href={`/${locale}/login`}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-accent-deep"
        >
          {uk ? 'Спробувати' : 'Try it'}
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-6 pt-10 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          {uk ? 'Конструктор сайтів' : 'Site builder'}
        </p>
        <h1 className="mt-4 max-w-3xl font-brand text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          {uk ? 'Вісім тем — під ваш почерк' : 'Eight themes — for your style'}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          {uk
            ? 'Оберіть тему, підставте свої фото — і персональний сайт готовий. Тему можна змінити будь-коли без втрати контенту.'
            : 'Pick a theme, add your photos — your personal site is ready. Switch themes anytime without losing content.'}
        </p>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <div className="flex flex-col gap-14">
          {THEME_DEMOS.map((demo) => (
            <section key={demo.value}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-brand text-2xl">{demo.name}</h2>
                <p className="text-sm text-muted">{demo.suits}</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
                {/* Scaled, non-interactive live preview of the real theme. */}
                <div style={{ height: 620, overflow: 'hidden' }}>
                  <div style={{ zoom: 0.62 as unknown as number, pointerEvents: 'none' }}>
                    <SiteRenderer
                      theme={demo.theme}
                      mode={demo.mode}
                      content={demo.content}
                      displayName={demo.displayName}
                      logoUrl={null}
                      portfolio={demo.portfolio}
                      labels={labels}
                      leadForm={{ handle: null, labels: leadFormLabels }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href={`/${locale}/login`}
                  className="inline-flex items-center gap-2 rounded-full border border-fg px-6 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-fg hover:text-bg"
                >
                  {uk ? `Обрати «${demo.name}»` : `Choose “${demo.name}”`} →
                </Link>
              </div>
            </section>
          ))}
        </div>
      </div>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-brand text-2xl sm:text-3xl">
              {uk ? 'Зберіть свій сайт за вечір' : 'Build your site in an evening'}
            </h2>
            <p className="mt-2 max-w-md text-muted">
              {uk
                ? 'Портфоліо, ціни, бронювання — під вашим брендом. Перший місяць безкоштовно.'
                : 'Portfolio, pricing, bookings — under your brand. First month free.'}
            </p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="shrink-0 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {uk ? 'Почати безкоштовно' : 'Start for free'}
          </Link>
        </div>
      </section>
    </main>
  )
}

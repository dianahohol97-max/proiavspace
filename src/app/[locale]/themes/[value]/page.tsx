import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { THEME_DEMOS } from '@/lib/site/demoContent'
import { SiteRenderer, type SiteLabels } from '@/components/site/SiteRenderer'

export const dynamic = 'force-dynamic'

export function generateMetadata({
  params,
}: {
  params: { locale: string; value: string }
}): Metadata {
  const demo = THEME_DEMOS.find((d) => d.value === params.value)
  const uk = params.locale === 'uk'
  const title = demo
    ? uk
      ? `Превʼю теми «${demo.name}» — проЯв`
      : `Theme preview «${demo.name}» — proiav`
    : 'проЯв'
  return { title, robots: { index: false, follow: true } }
}

/** Full-page live preview of a single theme's demo site (real size, scrollable). */
export default function ThemePreviewPage({
  params,
}: {
  params: { locale: string; value: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const uk = locale === 'uk'
  const demo = THEME_DEMOS.find((d) => d.value === params.value)
  if (!demo) notFound()

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
    <>
      {/* thin bar so the viewer knows this is a demo and can get back */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg px-4 py-2 text-sm">
        <span className="font-semibold">
          {uk ? 'Демо теми' : 'Theme demo'}: «{demo.name}»
        </span>
        <span className="flex items-center gap-4">
          <Link href={`/${locale}/themes`} className="text-muted no-underline hover:text-fg">
            ← {uk ? 'Усі теми' : 'All themes'}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="rounded-full bg-accent px-4 py-1.5 font-semibold text-white no-underline hover:bg-accent-deep"
          >
            {uk ? `Обрати «${demo.name}»` : `Choose “${demo.name}”`}
          </Link>
        </span>
      </div>

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
    </>
  )
}

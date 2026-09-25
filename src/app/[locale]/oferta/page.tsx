import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, locales } from '@/lib/i18n/config'
import { getLegalCopy } from '@/lib/legal/copy'
import { buildMetadata, clampDescription } from '@/lib/seo/metadata'
import { LegalDocView } from '@/components/legal/LegalDocView'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const copy = getLegalCopy(locale)
  return buildMetadata({
    locale,
    path: '/oferta',
    languages: ['uk', 'en'],
    title: copy.oferta.title,
    description: clampDescription(copy.oferta.intro),
  })
}

export default function OfertaPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const copy = getLegalCopy(params.locale)
  return (
    <LegalDocView
      doc={copy.oferta}
      locale={params.locale}
      backLabel={copy.backToHome}
      reviewNote={copy.reviewNote}
    />
  )
}

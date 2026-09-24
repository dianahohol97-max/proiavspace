import type { Metadata } from 'next'
import { ProductPage, productPageMetadata } from '@/components/marketing/ProductPage'

export function generateMetadata({ params }: { params: { locale: string; service: string } }): Metadata {
  return productPageMetadata(`porivniannia-${params.service}`, params.locale)
}

export default function Page({ params }: { params: { locale: string; service: string } }) {
  return <ProductPage id={`porivniannia-${params.service}`} locale={params.locale} />
}

import type { Metadata } from 'next'
import { ProductPage, productPageMetadata } from '@/components/marketing/ProductPage'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return productPageMetadata('tsiny', params.locale)
}

export default function Page({ params }: { params: { locale: string } }) {
  return <ProductPage id="tsiny" locale={params.locale} />
}

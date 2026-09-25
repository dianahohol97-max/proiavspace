import type { Metadata } from 'next'
import { ProductPage, productPageMetadata } from '@/components/marketing/ProductPage'

// Dollar prices are converted at the NBU rate: re-render daily even if the
// rate fetch failed at build time (then the page shows USD only).
export const revalidate = 86400

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return productPageMetadata('mihratsiia', params.locale)
}

export default function Page({ params }: { params: { locale: string } }) {
  return <ProductPage id="mihratsiia" locale={params.locale} />
}

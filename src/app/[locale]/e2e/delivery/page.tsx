import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { THEME_CATALOG } from '@/lib/site/themes'
import { deliveryLabels, galleryLabels } from '@/lib/gallery/labels'
import {
  countVisibleAssets,
  deliveryView,
  formatDeliveryEta,
  parseDeliveryStatus,
} from '@/lib/gallery/delivery'
import { DeliveryStatusScreen } from '@/components/gallery/DeliveryStatusScreen'
import { GalleryExperience, type GalleryItem } from '@/components/gallery/GalleryExperience'

/**
 * Test-only door to the «Статус зйомки» screen and banner, rendered with the
 * very components and decision logic of /g/[slug] but without a database
 * (tests/e2e/delivery-status.spec.ts). Exists only with E2E_THEME_PREVIEW=1
 * (playwright.config.ts); everywhere else 404.
 *
 *   ?status=shot|editing|ready  ?theme=<catalog value>  ?photos=N
 *   ?hidden=N (photos with hidden_from_client)  ?eta=YYYY-MM-DD
 *   ?cover=1 (a cover behind the status screen, as a light 1080 px WebP)
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default async function E2EDeliveryPreview({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { status?: string; theme?: string; photos?: string; hidden?: string; eta?: string; cover?: string }
}) {
  if (process.env.E2E_THEME_PREVIEW !== '1' || !isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const entry = THEME_CATALOG.find((item) => item.value === searchParams.theme) ?? THEME_CATALOG[0]
  const count = Math.min(Math.max(Number(searchParams.photos) || 0, 0), 24)
  const hidden = Math.min(Math.max(Number(searchParams.hidden) || 0, 0), 24)
  const assets = [
    ...Array.from({ length: count }, () => ({ hidden_from_client: false })),
    ...Array.from({ length: hidden }, () => ({ hidden_from_client: true })),
  ]

  const status = parseDeliveryStatus(searchParams.status)
  const view = deliveryView(status, countVisibleAssets(assets))
  const etaText = formatDeliveryEta(searchParams.eta, locale)
  const labels = deliveryLabels(dict)
  const title = dict.pages.demoCouple
  const brandName = dict.pages.demoBrand

  if (view === 'screen' && status) {
    return (
      <DeliveryStatusScreen
        locale={locale}
        title={title}
        brandName={brandName}
        logoUrl={null}
        coverUrl={searchParams.cover === '1' || count === 1 ? '/themes/07-1080.webp' : null}
        status={status}
        etaText={etaText}
        contactUrl="https://instagram.com/"
        showBadge
        theme={entry.theme}
        mode={entry.mode}
        labels={labels}
      />
    )
  }

  const items: GalleryItem[] = Array.from({ length: count }, (_, i) => {
    const n = String((i % 24) + 1).padStart(2, '0')
    return {
      id: `p${i}`,
      kind: 'photo',
      width: 2000,
      height: 1333,
      previewUrl: `/themes/${n}.webp`,
      gridUrl: `/themes/${n}-1080.webp`,
      posterUrl: null,
      downloadHref: `/themes/${n}.jpg`,
    }
  })
  return (
    <GalleryExperience
      demo
      locale={locale}
      slug="demo"
      title={title}
      eventLine={null}
      brandName={brandName}
      logoUrl={null}
      coverUrl={items[0]?.previewUrl ?? null}
      coverGridUrl={items[0]?.gridUrl ?? null}
      items={items}
      initialFavorites={[]}
      showBadge
      tipUrl={null}
      theme={entry.theme}
      mode={entry.mode}
      labels={galleryLabels(dict)}
      deliveryNotice={
        view === 'banner'
          ? { text: labels.banner, etaText: etaText ? labels.bannerEta.replace('{date}', etaText) : null }
          : null
      }
    />
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { GalleryExperience, type GalleryItem } from '@/components/gallery/GalleryExperience'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const uk = params.locale === 'uk'
  const title = uk ? 'Демо клієнтської галереї — проЯв' : 'Client gallery demo — proiav'
  const description = uk
    ? 'Подивіться, як клієнт отримує фото: галерея з обкладинкою, вибором улюблених кадрів і завантаженням оригіналів.'
    : 'See how a client receives photos: a branded gallery with favourites and full-resolution downloads.'
  return { title, description, alternates: { canonical: `/${params.locale}/gallery-demo` } }
}

function img(n: number): string {
  return `/themes/${String(n).padStart(2, '0')}.jpg`
}

// A believable wedding gallery from the generated set.
const PHOTOS = [1, 11, 2, 5, 3, 7, 8, 4, 6, 12, 9, 10]

export default async function GalleryDemoPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const uk = locale === 'uk'

  const items: GalleryItem[] = PHOTOS.map((n) => ({
    id: String(n),
    kind: 'photo',
    width: 1100,
    height: 1375,
    previewUrl: img(n),
    posterUrl: null,
    downloadHref: img(n),
  }))

  return (
    <GalleryExperience
      demo
      locale={locale}
      slug="demo"
      title={uk ? 'Марта і Богдан' : 'Marta & Bohdan'}
      eventLine={uk ? '14 вересня 2026 · Львів' : '14 September 2026 · Lviv'}
      brandName="Ольга Вишня"
      logoUrl={null}
      coverUrl={img(1)}
      items={items}
      initialFavorites={['11', '5']}
      showBadge
      tipUrl={null}
      theme="tysha"
      mode="light"
      labels={{
        scrollHint: dict.publicGallery.scrollHint,
        selected: dict.publicGallery.selected,
        downloadAll: dict.publicGallery.downloadAll,
        downloadHint: dict.publicGallery.downloadHint,
        preparingArchive: dict.publicGallery.preparingArchive,
        archiveError: dict.publicGallery.archiveError,
        downloadOriginal: dict.publicGallery.downloadOriginal,
        favoriteToggle: dict.publicGallery.favoriteToggle,
        madeOn: dict.publicGallery.madeOn,
        tip: dict.publicGallery.tip,
      }}
    />
  )
}

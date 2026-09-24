import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { breadcrumbNode, graph } from '@/lib/seo/structured-data'
import { JsonLd } from '@/components/seo/JsonLd'
import { THEME_DEMOS } from '@/lib/site/demoContent'
import { GalleryExperience, type GalleryItem } from '@/components/gallery/GalleryExperience'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const uk = locale === 'uk'
  return buildMetadata({
    locale,
    path: '/gallery-demo',
    languages: ['uk', 'en'],
    title: uk ? 'Демо онлайн-галереї: як клієнт бачить фото' : 'Client gallery demo',
    description: uk
      ? 'Подивіться, як клієнт отримує зйомку в онлайн-галереї: обкладинка, відбір улюблених кадрів, слайдшоу й завантаження оригіналів. Спробуйте різні стилі.'
      : 'See how a client receives a shoot in an online gallery: a cover, picking favourite frames, a slideshow and full-resolution downloads. Try every style.',
    image: { url: ogImagePath('page.gallery-demo'), alt: uk ? 'Демо клієнтської галереї проЯв' : 'proiav client gallery demo' },
  })
}

function img(n: number): string {
  return `/themes/${String(n).padStart(2, '0')}.webp`
}

// One coherent golden-hour wedding story — only the shots that read as a
// single shoot (field couple, walk, bouquets, sparklers). The rest of the
// /themes set is other genres and must not mix into this demo.
// The focal pair keeps faces in frame when a cropped layout is chosen
// (same mechanism as real galleries' assets.focal_x/focal_y).
const PHOTOS: { n: number; focalY: number }[] = [
  { n: 13, focalY: 20 },
  { n: 11, focalY: 28 },
  { n: 14, focalY: 45 },
  { n: 2, focalY: 50 },
  { n: 3, focalY: 30 },
  { n: 1, focalY: 24 },
]

export default async function GalleryDemoPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { theme?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const uk = locale === 'uk'

  // The gallery inherits its palette/typography from the chosen theme.
  const active = THEME_DEMOS.find((d) => d.value === searchParams.theme) ?? THEME_DEMOS[0]

  const items: GalleryItem[] = PHOTOS.map(({ n, focalY }) => ({
    id: String(n),
    kind: 'photo',
    width: 1100,
    height: 1100,
    previewUrl: img(n),
    posterUrl: null,
    focalX: 50,
    focalY,
    downloadHref: img(n),
  }))

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbNode([
            { name: 'проЯв', path: `/${locale}` },
            { name: uk ? 'Демо галереї' : 'Gallery demo', path: `/${locale}/gallery-demo` },
          ])
        )}
      />
      {/* style switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-muted">
          {uk ? 'Стиль:' : 'Style:'}
        </span>
        {THEME_DEMOS.map((d) => {
          const on = d.value === active.value
          return (
            <a
              key={d.value}
              href={`/${locale}/gallery-demo?theme=${d.value}`}
              className={`rounded-full border px-3 py-1 text-sm no-underline transition-colors ${
                on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-fg'
              }`}
            >
              {d.name}
            </a>
          )
        })}
        <a
          href={`/${locale}/themes`}
          className="ml-auto text-sm text-accent no-underline hover:underline"
        >
          ← {uk ? 'До тем сайтів' : 'Site themes'}
        </a>
      </div>

      <GalleryExperience
        demo
        key={active.value}
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
        theme={active.theme}
        mode={active.mode}
        // Cover focal: the hero couple's faces sit in the upper third.
        style={{ focalX: 50, focalY: 28 }}
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
    </>
  )
}

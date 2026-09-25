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

/** WebP for viewing; the "download" button hands out the original JPEG. */
function img(n: number, ext: 'webp' | 'jpg' = 'webp'): string {
  return `/themes/${String(n).padStart(2, '0')}.${ext}`
}

// One wedding story in the Norwegian mountains (fence, fields, road, red
// farmhouse). `v` marks the vertical frames (2:3); the rest are 3:2. The
// focal pair keeps the couple in frame when a cropped layout is chosen
// (same mechanism as real galleries' assets.focal_x/focal_y).
const PHOTOS: { n: number; v?: true; fx: number; fy: number }[] = [
  { n: 1, fx: 60, fy: 55 },
  { n: 2, fx: 47, fy: 75 },
  { n: 3, fx: 53, fy: 60 },
  { n: 4, fx: 52, fy: 55 },
  { n: 5, fx: 47, fy: 70 },
  { n: 6, v: true, fx: 50, fy: 55 },
  { n: 7, fx: 48, fy: 35 },
  { n: 8, fx: 48, fy: 85 },
  { n: 9, v: true, fx: 50, fy: 88 },
  { n: 10, v: true, fx: 50, fy: 75 },
  { n: 11, fx: 48, fy: 72 },
  { n: 12, fx: 52, fy: 55 },
  { n: 13, v: true, fx: 50, fy: 60 },
  { n: 14, fx: 70, fy: 55 },
  { n: 15, fx: 55, fy: 40 },
  { n: 16, fx: 42, fy: 45 },
  { n: 17, fx: 42, fy: 62 },
  { n: 18, v: true, fx: 50, fy: 35 },
  { n: 19, v: true, fx: 50, fy: 55 },
  { n: 20, fx: 45, fy: 70 },
  { n: 21, fx: 48, fy: 65 },
  { n: 22, fx: 47, fy: 75 },
  { n: 23, fx: 52, fy: 75 },
  { n: 24, fx: 42, fy: 70 },
]

/** Close-up of the couple, forehead to forehead — the gallery cover. */
const COVER = 7

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

  const items: GalleryItem[] = PHOTOS.map(({ n, v, fx, fy }) => ({
    id: String(n),
    kind: 'photo',
    width: v ? 1333 : 2000,
    height: v ? 2000 : 1333,
    previewUrl: img(n),
    posterUrl: null,
    focalX: fx,
    focalY: fy,
    downloadHref: img(n, 'jpg'),
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
        coverUrl={img(COVER)}
        items={items}
        initialFavorites={['11', '5']}
        showBadge
        tipUrl={null}
        theme={active.theme}
        mode={active.mode}
        // Cover focal: the couple's faces sit just above the middle.
        style={{ focalX: 48, focalY: 35 }}
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

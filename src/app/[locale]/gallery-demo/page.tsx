import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { formatDate } from '@/lib/i18n/format'
import { buildMetadata } from '@/lib/seo/metadata'
import { ogImagePath } from '@/lib/seo/pages'
import { breadcrumbNode, graph } from '@/lib/seo/structured-data'
import { JsonLd } from '@/components/seo/JsonLd'
import { THEME_DEMOS } from '@/lib/site/demoContent'
import { GalleryExperience, type GalleryItem } from '@/components/gallery/GalleryExperience'
import { galleryLabels } from '@/lib/gallery/labels'
import { parseGalleryStyle, type GalleryStyle } from '@/lib/gallery/style'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : 'uk'
  const { pages } = await getDictionary(locale)
  return buildMetadata({
    locale,
    path: '/gallery-demo',
    languages: ['uk', 'en'],
    title: pages.demoTitle,
    description: pages.demoDescription,
    image: { url: ogImagePath('page.gallery-demo'), alt: pages.demoOgAlt },
  })
}

/** WebP for viewing; the "download" button hands out the original JPEG. */
function img(n: number, ext: 'webp' | 'jpg' = 'webp'): string {
  return `/themes/${String(n).padStart(2, '0')}.${ext}`
}

/** The light ~1080 px WebP, as a real gallery's `mobile` rendition. */
function light(n: number): string {
  return `/themes/${String(n).padStart(2, '0')}-1080.webp`
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

const MAX_DEMO_ITEMS = 2000
const LAYOUTS: NonNullable<GalleryStyle['layout']>[] = ['masonry', 'square', 'portrait', 'collage', 'editorial', 'rows']
const COVERS: NonNullable<GalleryStyle['cover']>[] = ['classic', 'left', 'minimal']

export default async function GalleryDemoPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: {
    theme?: string
    n?: string
    layout?: string
    cover?: string
    nodims?: string
    cols?: string
    gap?: string
    radius?: string
  }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const uk = locale === 'uk'

  // The gallery inherits its palette/typography from the chosen theme.
  const active = THEME_DEMOS.find((d) => d.value === searchParams.theme) ?? THEME_DEMOS[0]

  // ?n=1500 repeats the 24 frames into a big gallery (load check of the
  // virtualized grid); ?layout= and ?cover= show the other grid layouts and
  // cover treatments («minimal» puts the grid on the first screen).
  const count = Math.min(Math.max(Number.parseInt(searchParams.n ?? '', 10) || PHOTOS.length, 1), MAX_DEMO_ITEMS)
  const layout = LAYOUTS.find((l) => l === searchParams.layout)
  const cover = COVERS.find((c) => c === searchParams.cover)
  // ?cols=, ?gap=, ?radius= — the designer's grid settings (validated like the saved style).
  const gridStyle = parseGalleryStyle({
    columns: Number(searchParams.cols),
    gap: Number(searchParams.gap),
    radius: Number(searchParams.radius),
  })
  const frames = Array.from({ length: count }, (_, i) => ({ ...PHOTOS[i % PHOTOS.length], i }))

  // ?nodims=3: photos 2, 5, 8 lose their stored size, like old HEIC uploads.
  const noDims = Math.min(Math.max(Number.parseInt(searchParams.nodims ?? '', 10) || 0, 0), PHOTOS.length)
  const unsized = (i: number) => i % 3 === 1 && (i - 1) / 3 < noDims

  const items: GalleryItem[] = frames.map(({ n, v, fx, fy, i }) => ({
    id: i < PHOTOS.length ? String(n) : `${n}-${i}`,
    kind: 'photo',
    width: unsized(i) ? null : v ? 1333 : 2000,
    height: unsized(i) ? null : v ? 2000 : 1333,
    previewUrl: img(n),
    gridUrl: light(n),
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
            { name: dict.pages.demoBreadcrumb, path: `/${locale}/gallery-demo` },
          ])
        )}
      />
      {/* style switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-muted">
          {dict.pages.demoStyle}
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
          href={`/${locale}`}
          className="ml-auto text-sm text-accent no-underline hover:underline"
        >
          ← {dict.pages.backHome}
        </a>
      </div>

      <GalleryExperience
        demo
        key={active.value}
        locale={locale}
        slug="demo"
        title={dict.pages.demoCouple}
        eventLine={`${formatDate('2026-09-14T12:00:00Z', locale, { day: 'numeric', month: 'long', year: 'numeric' })} · ${dict.pages.demoCity}`}
        brandName={dict.pages.demoBrand}
        logoUrl={null}
        coverUrl={img(COVER)}
        coverGridUrl={light(COVER)}
        items={items}
        initialFavorites={['11', '5']}
        showBadge
        tipUrl={null}
        theme={active.theme}
        mode={active.mode}
        // Cover focal: the couple's faces sit just above the middle.
        style={{ focalX: 48, focalY: 35, ...gridStyle, ...(layout ? { layout } : {}), ...(cover ? { cover } : {}) }}
        labels={galleryLabels(dict)}
      />
    </>
  )
}

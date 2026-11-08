import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDictionary, type Dictionary } from '@/lib/i18n'
import { setGalleryDelivery } from '@/lib/actions/galleries'
import { parseDeliveryEta, parseDeliveryStatus } from '@/lib/gallery/delivery'
import { GalleryList, type GalleryCardData } from '@/components/dashboard/GalleryList'
import { isLocale } from '@/lib/i18n/config'
import { daysLeft } from '@/lib/free-expiry'
import { effectiveGalleryPlan } from '@/lib/plans'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Gallery } from '@/lib/types'
import { buildRecentEvents, type BookingRow, type SelectionRow } from '@/lib/app/events'
import { InstallAppCard } from '@/components/app/InstallAppCard'
import { QuickActions } from '@/components/app/QuickActions'

export const dynamic = 'force-dynamic'

interface CoverRow {
  id: string
  r2_key: string
  variants: Record<string, string>
}

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ data: galleries }, { data: planRow }] = await Promise.all([
    supabase
      .from('galleries')
      .select(
        'id, owner_id, slug, title, description, event_date, cover_asset_id, has_password, expires_at, free_expires_at, free_expired_at, free_purged_at, is_published, view_count, created_at, updated_at, theme, delivery_status, delivery_eta'
      )
      // Required: RLS alone is not enough here. "galleries: public read when
      // published" lets every role — signed-in photographers included — read
      // any published gallery, so without this filter the dashboard listed
      // other photographers' galleries as the user's own.
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Gallery[]>(),
    supabase
      .from('profiles')
      .select('plan, grace_until')
      .eq('user_id', user.id)
      .single<{ plan: string; grace_until: string | null }>(),
  ])
  const ownerPlan = effectiveGalleryPlan(planRow?.plan ?? 'free', planRow?.grace_until)

  // Card data: cover thumb + photo count per gallery (fine at dashboard scale).
  const storage = getStorage()
  const cards = await Promise.all(
    (galleries ?? []).map(async (gallery) => {
      const coverQuery = gallery.cover_asset_id
        ? supabase
            .from('assets')
            .select('id, r2_key, variants')
            .eq('id', gallery.cover_asset_id)
            .maybeSingle<CoverRow>()
        : supabase
            .from('assets')
            .select('id, r2_key, variants')
            .eq('gallery_id', gallery.id)
            .order('position')
            .order('created_at')
            .limit(1)
            .maybeSingle<CoverRow>()
      const [{ data: cover }, { count: photoCount }] = await Promise.all([
        coverQuery,
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('gallery_id', gallery.id),
      ])
      const coverUrl = cover
        ? await storage.getSignedReadUrl(cover.variants.thumb ?? cover.variants.preview ?? cover.r2_key, {
            expiresInSeconds: 60 * 60,
          })
        : null
      return { gallery, coverUrl, photoCount: photoCount ?? 0 }
    })
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const d = dict.dashboard
  const m = dict.galleryManage
  const cardData: GalleryCardData[] = cards.map(({ gallery, coverUrl, photoCount }) => ({
    id: gallery.id,
    title: gallery.title,
    slug: gallery.slug,
    is_published: gallery.is_published,
    has_password: gallery.has_password,
    event_date: gallery.event_date,
    created_at: gallery.created_at,
    updated_at: gallery.updated_at,
    delivery_status: parseDeliveryStatus(gallery.delivery_status),
    delivery_eta: parseDeliveryEta(gallery.delivery_eta),
    coverUrl,
    photoCount,
    views: ownerPlan.features.stats ? gallery.view_count : null,
    freeBadge: freeBadge(gallery, dict),
  }))

  // Phone home screen: «Поділитися останньою» + the latest client events.
  const lastPublishedGallery = (galleries ?? []).find((gallery) => gallery.is_published)
  const lastPublished = lastPublishedGallery
    ? { title: lastPublishedGallery.title, url: `${appUrl}/${locale}/g/${lastPublishedGallery.slug}` }
    : null
  const events = cards.length > 0 ? await recentClientEvents(supabase, user.id, galleries ?? []) : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col gap-4 lg:hidden" data-testid="phone-home">
        {cards.length > 0 && <QuickActions t={dict.app} locale={locale} lastPublished={lastPublished} events={events} />}
        <InstallAppCard t={dict.app} dismissible />
      </div>
      <header className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-brand text-2xl sm:text-3xl">{d.title}</h1>
          {cards.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-muted">{d.galleriesCount.replace('{n}', String(cards.length))}</p>
          )}
        </div>
        {cards.length > 0 && (
          <Link
            href={`/${locale}/dashboard/import`}
            className="hidden rounded-full border border-line px-5 py-3 text-sm font-bold text-fg no-underline transition-colors hover:border-fg sm:inline-block"
          >
            {d.importLink}
          </Link>
        )}
        {cards.length > 0 && (
          <Link
            href={`/${locale}/dashboard/galleries/new`}
            data-testid="new-gallery"
            className="hidden w-full rounded-full bg-accent px-6 py-3 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep sm:w-auto lg:inline-block"
          >
            + {d.newGallery}
          </Link>
        )}
      </header>

      {cards.length === 0 ? (
        <div className="max-w-2xl rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8" data-testid="empty-state">
          <h2 className="font-brand text-2xl">{d.onboardTitle}</h2>
          <p className="mt-3 leading-relaxed text-muted">{d.onboardLede}</p>
          <ol className="mt-6 flex flex-col gap-4">
            {[d.onboardStep1, d.onboardStep2, d.onboardStep3].map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href={`/${locale}/dashboard/galleries/new`}
            data-testid="new-gallery"
            className="mt-8 block rounded-full bg-accent px-7 py-3.5 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep sm:inline-block"
          >
            {d.onboardCta} →
          </Link>
          <Link href={`/${locale}/dashboard/import`} className="mt-4 block text-sm text-muted">
            {d.importLink}
          </Link>
        </div>
      ) : (
        <GalleryList
          galleries={cardData}
          locale={locale}
          appUrl={appUrl}
          saveDelivery={setGalleryDelivery.bind(null, locale)}
          labels={{
            searchPlaceholder: d.searchPlaceholder,
            sortLabel: d.sortLabel,
            sorts: { newest: d.sortNewest, shoot: d.sortShootDate, updated: d.sortUpdated, title: d.sortTitle },
            nothingFound: d.nothingFound,
            published: d.published,
            draft: d.draft,
            photos: d.photosCount,
            views: d.views,
            noPhotosYet: d.noPhotosYet,
            copyLink: d.actionCopyLink,
            copied: d.actionCopied,
            upload: d.actionUpload,
            share: d.actionShare,
            draftHint: d.actionDraftHint,
            deliveryLabel: d.deliveryLabel,
            deliveryNone: m.deliveryNone,
            deliveryShot: m.deliveryShot,
            deliveryEditing: m.deliveryEditing,
            deliveryReady: m.deliveryReady,
            deliverySaveError: d.deliverySaveError,
            galleriesCount: d.galleriesCount,
          }}
        />
      )}
      {cards.some(({ gallery }) => gallery.free_expires_at || gallery.free_expired_at) && (
        <div className="mt-8 max-w-2xl rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed text-muted">
          <p>{d.freeExplain}</p>
          <Link
            href={`/${locale}/dashboard/billing`}
            className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-white no-underline hover:bg-accent-deep"
          >
            {d.freeExtend}
          </Link>
        </div>
      )}
    </main>
  )
}

/** «До закриття N дн.» / «Закрита для клієнтів» — the Free plan's 30 days (0049). */
function freeBadge(gallery: Gallery, dict: Dictionary): GalleryCardData['freeBadge'] {
  if (gallery.free_purged_at) return { text: dict.dashboard.freePurged, tone: 'red' }
  if (gallery.free_expired_at) return { text: dict.dashboard.freeClosed, tone: 'red' }
  if (!gallery.free_expires_at) return null
  const days = daysLeft(gallery.free_expires_at)
  return {
    text: days === 0 ? dict.dashboard.freeClosesToday : dict.dashboard.freeClosesIn.replace('{n}', String(days)),
    tone: days <= 7 ? 'amber' : 'muted',
  }
}

/**
 * Client picks of the last 14 days and recent bookings, for «Останні події від
 * клієнтів». Selections are filtered by the photographer's own gallery ids:
 * RLS alone also lets anyone read picks of published galleries.
 */
async function recentClientEvents(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  galleries: Pick<Gallery, 'id' | 'title'>[]
) {
  const titles = new Map(galleries.map((gallery) => [gallery.id, gallery.title]))
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const ids = Array.from(titles.keys()).slice(0, 200)
  const [{ data: selections }, { data: bookings }] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('selections')
          .select('gallery_id, asset_id, kind, created_at')
          .in('gallery_id', ids)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500)
          .returns<SelectionRow[]>()
      : Promise.resolve({ data: [] as SelectionRow[] }),
    supabase
      .from('booking_slots')
      .select('id, client_name, starts_at, booked_at')
      .eq('owner_id', userId)
      .in('status', ['booked', 'paid'])
      .gte('booked_at', since)
      .order('booked_at', { ascending: false })
      .limit(5)
      .returns<BookingRow[]>(),
  ])
  return buildRecentEvents(selections ?? [], titles, bookings ?? [])
}

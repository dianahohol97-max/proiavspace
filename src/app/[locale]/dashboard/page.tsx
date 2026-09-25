import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { effectiveGalleryPlan } from '@/lib/plans'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Gallery } from '@/lib/types'

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
        'id, owner_id, slug, title, description, event_date, cover_asset_id, has_password, expires_at, is_published, view_count, created_at, updated_at, theme'
      )
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <h1 className="font-brand text-3xl">{dict.dashboard.title}</h1>
        <Link
          href={`/${locale}/dashboard/import`}
          className="ml-auto rounded-full border border-line px-6 py-3 text-sm font-bold text-fg no-underline transition-colors hover:border-fg"
        >
          {dict.dashboard.importLink}
        </Link>
        <Link
          href={`/${locale}/dashboard/galleries/new`}
          className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
        >
          + {dict.dashboard.newGallery}
        </Link>
      </header>

      {cards.length === 0 ? (
        <div className="mt-6 max-w-2xl rounded-2xl border border-line bg-white p-8 shadow-sm">
          <h2 className="font-brand text-2xl">{dict.dashboard.onboardTitle}</h2>
          <p className="mt-3 leading-relaxed text-muted">{dict.dashboard.onboardLede}</p>
          <ol className="mt-6 flex flex-col gap-4">
            {[
              dict.dashboard.onboardStep1,
              dict.dashboard.onboardStep2,
              dict.dashboard.onboardStep3,
            ].map((step, index) => (
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
            className="mt-8 inline-block rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
          >
            {dict.dashboard.onboardCta}
          </Link>
          <Link
            href={`/${locale}/dashboard/import`}
            className="mt-4 block text-sm text-muted"
          >
            {dict.dashboard.importLink}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ gallery, coverUrl, photoCount }) => (
            <Link
              key={gallery.id}
              href={`/${locale}/dashboard/galleries/${gallery.id}`}
              className="group rounded-2xl bg-white p-3 no-underline shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <span
                className="block aspect-[4/2.6] rounded-xl bg-line bg-cover bg-center"
                style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
              />
              <span className="mt-3 block px-1 pb-1">
                <span className="block truncate text-[15px] font-extrabold text-fg">
                  {gallery.title}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-extrabold ${
                      gallery.is_published
                        ? 'bg-emerald-600/10 text-emerald-700'
                        : 'bg-bg text-muted'
                    }`}
                  >
                    {gallery.is_published ? dict.dashboard.published : dict.dashboard.draft}
                  </span>
                  <span>
                    {photoCount} {dict.dashboard.photosCount.toLowerCase()}
                  </span>
                  {ownerPlan.features.stats && (
                    <span>
                      · {gallery.view_count} {dict.dashboard.views.toLowerCase()}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  deleteGallery,
  setGalleryCover,
  setGalleryPublished,
  setGalleryTheme,
  updateGallerySettings,
} from '@/lib/actions/galleries'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { effectiveGalleryPlan } from '@/lib/plans'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { ExportFavoritesButton } from '@/components/ExportFavoritesButton'
import { GalleryDesigner } from '@/components/gallery/GalleryDesigner'
import { parseGalleryStyle } from '@/lib/gallery/style'
import { Uploader } from '@/components/Uploader'
import type { Asset, Gallery } from '@/lib/types'

/** Original filename as the client knows it: r2 basename minus the uuid- prefix. */
function assetFileName(asset: Asset): string {
  return (asset.r2_key.split('/').pop() ?? asset.id).replace(/^[0-9a-f-]{37}/, '')
}

export const dynamic = 'force-dynamic'

export default async function ManageGalleryPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: gallery } = await supabase
    .from('galleries')
    .select(
      'id, owner_id, slug, title, description, event_date, cover_asset_id, has_password, expires_at, is_published, view_count, created_at, updated_at, theme, style'
    )
    .eq('id', params.id)
    .eq('owner_id', user.id)
    .single<Gallery>()
  if (!gallery) notFound()

  // Statistics are a «Плюс»+ feature; selection/favorites are free for all.
  const { data: planRow } = await supabase
    .from('profiles')
    .select('plan, grace_until, watermark_enabled, display_name')
    .eq('user_id', user.id)
    .single<{
      plan: string
      grace_until: string | null
      watermark_enabled: boolean
      display_name: string | null
    }>()
  const ownerPlan = effectiveGalleryPlan(planRow?.plan ?? 'free', planRow?.grace_until)
  const watermarkText =
    planRow?.watermark_enabled && planRow.display_name ? planRow.display_name : undefined

  const [{ data: assets }, { count: downloadCount }, { data: selections }] = await Promise.all([
    supabase
      .from('assets')
      .select('*')
      .eq('gallery_id', gallery.id)
      .order('position')
      .order('created_at')
      .returns<Asset[]>(),
    supabase
      .from('gallery_events')
      .select('*', { count: 'exact', head: true })
      .eq('gallery_id', gallery.id)
      .eq('type', 'download'),
    supabase
      .from('selections')
      .select('asset_id, kind, client_token')
      .eq('gallery_id', gallery.id)
      .returns<{ asset_id: string; kind: string; client_token: string }[]>(),
  ])

  const favoriteCounts = new Map<string, number>()
  const favoriteClients = new Set<string>()
  for (const selection of selections ?? []) {
    if (selection.kind !== 'favorite') continue
    favoriteCounts.set(selection.asset_id, (favoriteCounts.get(selection.asset_id) ?? 0) + 1)
    favoriteClients.add(selection.client_token)
  }
  const totalFavorites = [...favoriteCounts.values()].reduce((sum, n) => sum + n, 0)

  // Short-lived previews for the owner's thumbnails — signed server-side,
  // fetched by the browser straight from R2.
  const storage = getStorage()
  const previews = await Promise.all(
    (assets ?? []).map(async (asset) => ({
      asset,
      url: await storage.getSignedReadUrl(
        asset.variants.poster ?? asset.variants.thumb ?? asset.variants.preview ?? asset.r2_key,
        { expiresInSeconds: 60 * 60 }
      ),
    }))
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicUrl = `${appUrl}/${locale}/g/${gallery.slug}`

  const publishAction = setGalleryPublished.bind(null, locale, gallery.id, !gallery.is_published)
  const deleteAction = deleteGallery.bind(null, locale, gallery.id)
  const themeAction = setGalleryTheme.bind(null, locale, gallery.id)
  const settingsAction = updateGallerySettings.bind(null, locale, gallery.id)
  const hasPassword = gallery.has_password
  const expiryDefault = gallery.expires_at ? gallery.expires_at.slice(0, 10) : ''

  const themeOptions: { value: string; label: string }[] = [
    { value: '', label: dict.galleryManage.styleInherit },
    { value: 'tysha', label: dict.site.themeTysha },
    { value: 'opivnich', label: dict.site.themeOpivnich },
    { value: 'povitria', label: dict.site.themePovitria },
    { value: 'plivka', label: dict.site.themePlivka },
    { value: 'zhurnal', label: dict.site.themeZhurnal },
    { value: 'galereia', label: dict.site.themeGalereia },
    { value: 'arkhiv', label: dict.site.themeArkhiv },
    { value: 'prodakshn', label: dict.site.themeProdakshn },
  ]

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>

      <header className="mt-6 border-b border-line pb-8">
        <h1 className="font-display text-4xl">{gallery.title}</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          {gallery.is_published ? dict.galleryManage.publishedHint : dict.galleryManage.draftHint}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <form action={publishAction}>
            <button
              type="submit"
              className="border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
            >
              {gallery.is_published ? dict.galleryManage.unpublish : dict.galleryManage.publish}
            </button>
          </form>

          {gallery.is_published && (
            <CopyLinkButton
              url={publicUrl}
              label={dict.galleryManage.copyLink}
              copiedLabel={dict.galleryManage.copied}
            />
          )}

          <span className="text-sm text-muted">
            {dict.dashboard.photosCount}: {assets?.length ?? 0} ·{' '}
            {dict.galleryManage.statsFavorites}: {totalFavorites}
            {ownerPlan.features.stats && (
              <>
                {' '}
                · {dict.dashboard.views}: {gallery.view_count} ·{' '}
                {dict.galleryManage.statsDownloads}: {downloadCount ?? 0}
              </>
            )}
          </span>
        </div>

        {gallery.is_published && (
          <p className="mt-4 break-all text-sm text-muted">
            {dict.galleryManage.publicLink}: {publicUrl}
          </p>
        )}

        <GalleryDesigner
          action={themeAction}
          themeOptions={themeOptions}
          initialTheme={gallery.theme ?? ''}
          initialStyle={parseGalleryStyle(gallery.style)}
          labels={{
            styleLabel: dict.galleryManage.styleLabel,
            styleSave: dict.galleryManage.styleSave,
            styleSaved: dict.galleryManage.styleSaved,
            accent: locale === 'uk' ? 'Акцент' : 'Accent',
            columns: locale === 'uk' ? 'Колонки' : 'Columns',
            radius: locale === 'uk' ? 'Кути' : 'Corners',
            font: locale === 'uk' ? 'Шрифт' : 'Font',
            preview: locale === 'uk' ? 'Превʼю' : 'Preview',
          }}
        />
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl">{dict.galleryManage.settingsTitle}</h2>
        <form action={settingsAction} className="mt-6 flex max-w-md flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted" htmlFor="g-password">
              {dict.galleryManage.settingsPasswordLabel}
            </label>
            <input
              id="g-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={
                hasPassword
                  ? dict.galleryManage.settingsPasswordSet
                  : dict.galleryManage.settingsPasswordNone
              }
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
            />
            <p className="text-xs text-muted">{dict.galleryManage.settingsPasswordHint}</p>
            {hasPassword && (
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" name="remove_password" />
                {dict.galleryManage.settingsPasswordRemove}
              </label>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted" htmlFor="g-expires">
              {dict.galleryManage.settingsExpiryLabel}
            </label>
            <input
              id="g-expires"
              name="expires_at"
              type="date"
              defaultValue={expiryDefault}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
            />
            <p className="text-xs text-muted">{dict.galleryManage.settingsExpiryHint}</p>
          </div>
          <button
            type="submit"
            className="self-start border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.galleryManage.settingsSave}
          </button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl">{dict.galleryManage.uploadTitle}</h2>
        <div className="mt-6">
          <Uploader
            galleryId={gallery.id}
            dropHint={dict.galleryManage.dropHint}
            watermarkText={watermarkText}
          />
        </div>
      </section>

      <section className="mt-12">
        {previews.length === 0 ? (
          <p className="max-w-xl leading-relaxed text-muted">{dict.galleryManage.noAssets}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {previews.map(({ asset, url }) => {
              const favoritedBy = favoriteCounts.get(asset.id) ?? 0
              const isCover = gallery.cover_asset_id === asset.id
              return (
                <div
                  key={asset.id}
                  className="group relative aspect-square overflow-hidden bg-line"
                >
                  {asset.kind === 'photo' || asset.variants.poster ? (
                    // Photo, or a video's poster still — never streams the original.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                  {favoritedBy > 0 && (
                    <span className="absolute right-2 top-2 bg-bg/90 px-2 py-0.5 text-xs text-accent">
                      ♥ {favoritedBy}
                    </span>
                  )}
                  {isCover ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-fg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bg">
                      {dict.galleryManage.coverBadge}
                    </span>
                  ) : (
                    <form
                      action={setGalleryCover.bind(null, locale, gallery.id, asset.id)}
                      className="absolute bottom-2 left-2 hidden group-hover:block"
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-bg/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg hover:text-accent"
                      >
                        {dict.galleryManage.setCover}
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="font-display text-2xl">{dict.galleryManage.favoritesTitle}</h2>
        {totalFavorites === 0 ? (
          <p className="mt-4 max-w-xl leading-relaxed text-muted">
            {dict.galleryManage.favoritesEmpty}
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-sm text-muted">
                {dict.galleryManage.statsFavorites}: {totalFavorites} ·{' '}
                {dict.galleryManage.favoritesClients}: {favoriteClients.size}
              </span>
              <ExportFavoritesButton
                fileNames={previews
                  .filter(({ asset }) => favoriteCounts.has(asset.id))
                  .map(({ asset }) => assetFileName(asset))}
                label={dict.galleryManage.exportFavorites}
                copiedLabel={dict.galleryManage.exportCopied}
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {previews
                .filter(({ asset }) => favoriteCounts.has(asset.id))
                .map(({ asset, url }) => (
                  <div key={asset.id} className="relative aspect-square overflow-hidden bg-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute right-2 top-2 bg-bg/90 px-2 py-0.5 text-xs text-accent">
                      ♥ {favoriteCounts.get(asset.id)}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-16 border-t border-line pt-8">
        <form action={deleteAction}>
          <button type="submit" className="text-sm text-accent underline">
            {dict.galleryManage.deleteGallery}
          </button>
          <p className="mt-2 max-w-md text-xs text-muted">{dict.galleryManage.deleteConfirm}</p>
        </form>
      </section>
    </main>
  )
}

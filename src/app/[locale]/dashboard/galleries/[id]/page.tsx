import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  deleteGallery,
  setAssetFocal,
  setGalleryCover,
  sortGalleryAssets,
  setGalleryDelivery,
  setGalleryPublished,
  setGalleryTheme,
  saveGalleryAccess,
  updateGalleryDetails,
} from '@/lib/actions/galleries'
import { getDictionary } from '@/lib/i18n'
import { formatMessage, intlLocale } from '@/lib/i18n/format'
import { isLocale, locales, type Locale } from '@/lib/i18n/config'
import { effectiveGalleryPlan } from '@/lib/plans'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AssetFocusTile } from '@/components/gallery/AssetFocusTile'
import { GallerySortControl } from '@/components/gallery/GallerySortControl'
import { CullingPanel } from '@/components/gallery/CullingPanel'
import type { CullingPhoto } from '@/lib/culling/types'
import { setHiddenFromClient } from '@/lib/actions/culling'
import { GalleryDesigner } from '@/components/gallery/GalleryDesigner'
import { DeliveryStatusControl } from '@/components/gallery/DeliveryStatusControl'
import { ClientEmailControl } from '@/components/gallery/ClientEmailControl'
import { ClientPicksExport } from '@/components/gallery/ClientPicksExport'
import { sendClientReadyEmailAgain, setClientEmail } from '@/lib/actions/client-email'
import {
  pickLabels as buildPickLabels,
  assetOriginalName,
  buildClientPicks,
  lightroomFilterLine,
  picksCsv,
  picksTxt,
} from '@/lib/gallery/client-picks'
import { loadClientEmailState } from '@/lib/gallery/ready-email-store'
import { countVisibleAssets, deliveryView, parseDeliveryEta, parseDeliveryStatus } from '@/lib/gallery/delivery'
import type { ShareMessageStrings } from '@/lib/gallery/share'
import { parseGalleryTab } from '@/lib/dashboard/tabs'
import { GalleryTabs, GoToTabButton } from '@/components/dashboard/GalleryTabs'
import { OpenShareButton, ShareDialog } from '@/components/dashboard/ShareDialog'
import { DeleteGalleryButton, GalleryAccessForm, GalleryDetailsForm } from '@/components/dashboard/GalleryForms'
import { parseGalleryStyle } from '@/lib/gallery/style'
import { Uploader } from '@/components/Uploader'
import { HowItWorks } from '@/components/gallery/HowItWorks'
import { galleryHelp } from '@/lib/gallery/help'
import { daysLeft, purgeDate } from '@/lib/free-expiry'
import type { Asset, Gallery } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ManageGalleryPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams: { tab?: string; created?: string; share?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const help = galleryHelp(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: gallery } = await supabase
    .from('galleries')
    .select(
      'id, owner_id, slug, title, description, event_date, cover_asset_id, has_password, expires_at, free_expires_at, free_expired_at, free_purged_at, is_published, view_count, created_at, updated_at, theme, style, delivery_status, delivery_eta'
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

  const [{ data: assets }, { count: downloadCount }, { data: selections }, clientEmail] = await Promise.all([
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
    loadClientEmailState(params.id, user.id),
  ])

  const favoriteCounts = new Map<string, number>()
  const favoriteClients = new Set<string>()
  for (const selection of selections ?? []) {
    if (selection.kind !== 'favorite') continue
    favoriteCounts.set(selection.asset_id, (favoriteCounts.get(selection.asset_id) ?? 0) + 1)
    favoriteClients.add(selection.client_token)
  }
  const totalFavorites = [...favoriteCounts.values()].reduce((sum, n) => sum + n, 0)

  // «Обране клієнта»: hearts AND retouch requests, in gallery order, with the
  // original file names (lib/gallery/client-picks) — for Lightroom and the list.
  const picks = buildClientPicks(assets ?? [], selections ?? [])
  const pickClients = new Set((selections ?? []).map((s) => s.client_token))
  const retouchCount = picks.filter((p) => p.retouch > 0).length
  const lightroom = lightroomFilterLine(picks)
  const pickLabels = buildPickLabels(dict.designer)

  // Per-photo engagement (a «Плюс»+ stat): download and view events carry the
  // asset id in meta, so we can show views + downloads on each individual photo.
  const downloadCounts = new Map<string, number>()
  const viewCounts = new Map<string, number>()
  if (ownerPlan.features.stats) {
    const { data: perAsset } = await supabase
      .from('gallery_events')
      .select('type, meta')
      .eq('gallery_id', gallery.id)
      .in('type', ['download', 'view'])
      .returns<{ type: string; meta: { asset_id?: string } }[]>()
    for (const event of perAsset ?? []) {
      const id = event.meta?.asset_id
      if (!id) continue
      const target = event.type === 'download' ? downloadCounts : viewCounts
      target.set(id, (target.get(id) ?? 0) + 1)
    }
  }

  // Short-lived previews for the owner's thumbnails — signed server-side,
  // fetched by the browser straight from R2.
  const storage = getStorage()
  const previews = await Promise.all(
    (assets ?? []).map(async (asset) => {
      // Signing must never crash the whole page: one unreadable/broken asset
      // degrades to a missing thumbnail instead of a blank error screen.
      let url = ''
      try {
        url = await storage.getSignedReadUrl(
          asset.variants.poster ?? asset.variants.thumb ?? asset.variants.preview ?? asset.r2_key,
          { expiresInSeconds: 60 * 60 }
        )
      } catch {
        url = ''
      }
      return { asset, url }
    })
  )

  // AI culling reads only the light renditions (thumb ~512 px → mobile →
  // preview), never originals. Photos without any rendition are skipped.
  const cullingPhotos: CullingPhoto[] = (
    await Promise.all(
      previews.map(async ({ asset, url }, order): Promise<CullingPhoto | null> => {
        if (asset.kind !== 'photo') return null
        const key = asset.variants.thumb ?? asset.variants.mobile ?? asset.variants.preview
        if (!key) return null
        const shownKey = asset.variants.poster ?? asset.variants.thumb ?? asset.variants.preview
        let analysisUrl = key === shownKey ? url : ''
        if (!analysisUrl) {
          try {
            analysisUrl = await storage.getSignedReadUrl(key, { expiresInSeconds: 60 * 60 })
          } catch {
            return null
          }
        }
        return analysisUrl
          ? {
              id: asset.id,
              url: analysisUrl,
              order,
              takenAt: asset.taken_at ? Date.parse(asset.taken_at) : null,
              name: assetOriginalName(asset),
              hidden: asset.hidden_from_client === true,
            }
          : null
      })
    )
  ).filter((p): p is CullingPhoto => p !== null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const publishAction = setGalleryPublished.bind(null, locale, gallery.id, !gallery.is_published)
  const sharePublishAction = setGalleryPublished.bind(null, locale, gallery.id, true)
  const deleteAction = deleteGallery.bind(null, locale, gallery.id)
  const themeAction = setGalleryTheme.bind(null, locale, gallery.id)
  const deliveryAction = setGalleryDelivery.bind(null, locale, gallery.id)
  const hasPassword = gallery.has_password
  const expiryDefault = gallery.expires_at ? gallery.expires_at.slice(0, 10) : ''
  const m = dict.galleryManage
  const photoCount = assets?.length ?? 0
  const deliveryStatus = parseDeliveryStatus(gallery.delivery_status)
  const statsOn = ownerPlan.features.stats

  // The ready-made client message in every language the link can have.
  const allDicts = await Promise.all(locales.map((code) => getDictionary(code)))
  const shareMessages = Object.fromEntries(
    locales.map((code, i) => {
      const pg = allDicts[i].publicGallery
      return [
        code,
        {
          shareReady: pg.shareReady,
          shareInProgress: pg.shareInProgress,
          sharePassword: pg.sharePassword,
          shareSubject: pg.shareSubject,
        },
      ]
    })
  ) as Record<Locale, ShareMessageStrings>
  const inProgress = deliveryView(deliveryStatus, countVisibleAssets(assets)) !== 'gallery'

  // The 8 site-theme cards read as near-identical swatches in the gallery
  // studio, so the picker is reduced to three clearly distinct moods. Legacy
  // stored themes stay valid and are normalized to the nearest mood below.
  const themeOptions: { value: string; label: string }[] = [
    { value: 'tysha', label: dict.designer.themeLight },
    { value: 'opivnich', label: dict.designer.themeDark },
    { value: 'plivka', label: dict.designer.themeCream },
  ]
  const themeMood: Record<string, string> = {
    tysha: 'tysha',
    povitria: 'tysha',
    galereia: 'tysha',
    opivnich: 'opivnich',
    prodakshn: 'opivnich',
    plivka: 'plivka',
    zhurnal: 'plivka',
    arkhiv: 'plivka',
  }

  const dateLocale = intlLocale(locale)
  const freeNotice = (gallery.free_expires_at || gallery.free_expired_at) && (
    <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-50 p-5 text-sm leading-relaxed">
      <p className="font-extrabold text-fg">
        {gallery.free_purged_at
          ? dict.dashboard.freePurged
          : gallery.free_expired_at
            ? `${dict.dashboard.freeClosed} · ${dict.dashboard.freePurgeOn.replace(
                '{date}',
                purgeDate(gallery.free_expired_at).toLocaleDateString(dateLocale, { timeZone: 'Europe/Kyiv' })
              )}`
            : daysLeft(gallery.free_expires_at!) === 0
              ? dict.dashboard.freeClosesToday
              : formatMessage(dict.dashboard.freeClosesIn, { n: daysLeft(gallery.free_expires_at!) }, locale)}
      </p>
      <p className="mt-2 text-muted">{dict.dashboard.freeExplain}</p>
      <Link
        href={`/${locale}/dashboard/billing`}
        className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-white no-underline hover:bg-accent-deep"
      >
        {dict.dashboard.freeExtend}
      </Link>
    </section>
  )

  const pill = 'rounded-full px-2.5 py-0.5 text-xs font-extrabold'
  const header = (
    <>
      <Link
        href={`/${locale}/dashboard`}
        className="inline-flex min-h-[32px] items-center text-xs font-bold text-muted no-underline hover:text-fg sm:text-sm"
      >
        ← {m.back}
      </Link>
      <div className="mt-1 flex items-start gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-words font-brand text-xl leading-tight sm:line-clamp-1 sm:text-3xl" title={gallery.title}>
            {gallery.title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
            <span
              data-testid="publish-status"
              className={`${pill} ${gallery.is_published ? 'bg-emerald-600/10 text-emerald-700' : 'bg-amber-500/15 text-amber-800'}`}
            >
              {gallery.is_published ? dict.dashboard.published : dict.dashboard.draft}
            </span>
            {deliveryStatus && (
              <span className={`${pill} bg-bg text-fg`}>
                {{ shot: m.deliveryShot, editing: m.deliveryEditing, ready: m.deliveryReady }[deliveryStatus]}
              </span>
            )}
            {hasPassword && <span className={`${pill} bg-bg text-fg`}>🔒</span>}
            <span className="px-1">
              {photoCount} {dict.dashboard.photosCount.toLowerCase()}
            </span>
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <form action={publishAction} className="hidden sm:block">
            <button
              type="submit"
              className="min-h-[44px] rounded-full border border-line px-4 text-sm font-bold text-muted transition-colors hover:border-fg hover:text-fg"
            >
              {gallery.is_published ? m.unpublish : m.publish}
            </button>
          </form>
          <ShareDialog
            slug={gallery.slug}
            appUrl={appUrl}
            title={gallery.title}
            isPublished={gallery.is_published}
            hasPassword={hasPassword}
            inProgress={inProgress}
            defaultLocale={locale}
            messages={shareMessages}
            publish={sharePublishAction}
            initialOpen={searchParams.share === '1'}
            labels={{
              share: m.share,
              shareTitle: m.shareTitle,
              shareDraft: m.shareDraft,
              sharePublish: m.sharePublish,
              sharePublishing: m.sharePublishing,
              sharePublished: m.sharePublished,
              sharePublishError: m.sharePublishError,
              shareLinkLabel: m.shareLinkLabel,
              shareLangLabel: m.shareLangLabel,
              shareLangHint: m.shareLangHint,
              shareCopy: m.shareCopy,
              shareCopied: m.shareCopied,
              shareQr: m.shareQr,
              shareQrHint: m.shareQrHint,
              shareQrDownload: m.shareQrDownload,
              shareMessageLabel: m.shareMessageLabel,
              shareMessageHint: m.shareMessageHint,
              shareVia: m.shareVia,
              shareEmail: m.shareEmail,
              shareMore: m.shareMore,
              shareCopyMessage: m.shareCopyMessage,
              sharePasswordReminder: m.sharePasswordReminder,
              shareClose: m.shareClose,
            }}
          />
        </div>
      </div>
    </>
  )

  const hintBox = 'mb-6 flex flex-col gap-3 rounded-2xl border border-[#d4dbff] bg-[#eef1ff] p-4 text-sm leading-relaxed text-fg sm:flex-row sm:items-center sm:p-5'
  const hintButton = 'min-h-[40px] rounded-full bg-white px-4 text-sm font-bold text-fg shadow-sm hover:text-accent'

  // ------------------------------------------------------------------ Фото
  const photosPanel = (
    <>
      {freeNotice}
      {photoCount === 0 && searchParams.created === '1' && (
        <p className={hintBox} data-testid="hint-created" role="status">
          {m.hintCreated}
        </p>
      )}
      {photoCount > 0 && !gallery.is_published && (
        <div className={hintBox} data-testid="hint-uploaded">
          <p className="flex-1">{m.hintUploaded}</p>
          <div className="flex flex-wrap gap-2">
            <GoToTabButton tab="design" label={m.hintGoDesign} className={hintButton} />
            <OpenShareButton label={m.hintGoShare} className="min-h-[40px] rounded-full bg-accent px-4 text-sm font-bold text-white hover:bg-accent-deep" />
          </div>
        </div>
      )}

      <div id="upload" className="scroll-mt-40">
        <h2 className="sr-only">{m.uploadTitle}</h2>
        {gallery.free_expired_at ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-muted">{dict.dashboard.freeUploadClosed}</p>
        ) : (
          <Uploader
            galleryId={gallery.id}
            dropHint={m.dropHint}
            watermarkText={watermarkText}
            videoPlanNotice={m.videoPlanNotice}
            videoPlanLink={m.videoPlanLink}
            billingHref={`/${locale}/dashboard/billing`}
            emphasis={photoCount === 0}
            progressLabel={m.uploadProgress}
            retryLabel={m.uploadRetry}
            errorLabels={{
              quota: m.uploadErrQuota,
              tooBig: m.uploadErrTooBig,
              type: m.uploadErrType,
              closed: m.uploadErrClosed,
              duplicate: m.uploadErrDuplicate,
              generic: m.uploadErrGeneric,
            }}
          />
        )}
        <HowItWorks help={help.upload} testId="help-upload" />
      </div>

      {cullingPhotos.length > 0 && (
        // «Сховати від клієнта» / «Повернути клієнту»: assets.hidden_from_client
        // (0054). The action re-checks ownership on the server.
        <CullingPanel
          galleryId={gallery.id}
          locale={locale}
          photos={cullingPhotos}
          onSetHidden={setHiddenFromClient.bind(null, locale, gallery.id)}
          ownerId={user.id}
        />
      )}
      {cullingPhotos.length > 0 && <HowItWorks help={help.culling} testId="help-culling" />}

      {previews.length > 0 && (
        <div className="mt-10">
          <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted">{m.photosFocusHint}</p>
          {previews.length > 1 && (
            <GallerySortControl
              locale={locale}
              total={previews.length}
              withTakenAt={previews.filter(({ asset }) => asset.taken_at).length}
              action={sortGalleryAssets.bind(null, locale, gallery.id)}
            />
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="photo-grid">
            {previews.map(({ asset, url }) => {
              const favoritedBy = favoriteCounts.get(asset.id) ?? 0
              const isCover = gallery.cover_asset_id === asset.id
              return (
                <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl bg-line">
                  <AssetFocusTile
                    url={url}
                    isVideo={!(asset.kind === 'photo' || asset.variants.poster)}
                    initialX={asset.focal_x ?? null}
                    initialY={asset.focal_y ?? null}
                    action={setAssetFocal.bind(null, locale, asset.id)}
                    title={dict.designer.focalHint}
                  />
                  {(favoritedBy > 0 ||
                    (downloadCounts.get(asset.id) ?? 0) > 0 ||
                    (viewCounts.get(asset.id) ?? 0) > 0) && (
                    <span className="absolute right-2 top-2 flex flex-col items-end gap-1">
                      {favoritedBy > 0 && (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-accent">♥ {favoritedBy}</span>
                      )}
                      {(viewCounts.get(asset.id) ?? 0) > 0 && (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-muted">◉ {viewCounts.get(asset.id)}</span>
                      )}
                      {(downloadCounts.get(asset.id) ?? 0) > 0 && (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-muted">↓ {downloadCounts.get(asset.id)}</span>
                      )}
                    </span>
                  )}
                  {asset.hidden_from_client && (
                    // Hidden by the photographer (culling): the client never
                    // sees it; one click puts it back.
                    <form
                      action={setHiddenFromClient.bind(null, locale, gallery.id, [asset.id], false)}
                      className="absolute left-2 top-2 flex flex-col items-start gap-1"
                    >
                      <span className="rounded-full bg-neutral-900/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {dict.designer.hiddenFromClient}
                      </span>
                      <button
                        type="submit"
                        className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-900 hover:text-accent"
                      >
                        {dict.designer.showToClient}
                      </button>
                    </form>
                  )}
                  {isCover ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-fg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bg">
                      {m.coverBadge}
                    </span>
                  ) : (
                    <form
                      action={setGalleryCover.bind(null, locale, gallery.id, asset.id)}
                      // Always visible on touch devices — hover-only made the
                      // cover picker undiscoverable on phones.
                      className="absolute bottom-2 left-2 lg:hidden lg:group-hover:block"
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fg hover:text-accent"
                      >
                        {m.setCover}
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  // ------------------------------------------------------------------ Дизайн
  const designPanel = (
    <>
      <GalleryDetailsForm
        action={updateGalleryDetails.bind(null, locale, gallery.id)}
        initial={{
          title: gallery.title,
          eventDate: gallery.event_date ?? '',
          description: gallery.description ?? '',
        }}
        labels={{
          title: m.detailsTitle,
          titleLabel: m.detailsTitleLabel,
          dateLabel: m.detailsDateLabel,
          descriptionLabel: m.detailsDescriptionLabel,
          save: m.settingsSave,
          saving: m.saving,
          saved: m.saved,
          saveError: m.saveError,
          titleRequired: m.titleRequired,
        }}
      />
      {photoCount === 0 && (
        <p className={`${hintBox} mt-6`} data-testid="hint-design-empty">
          <span className="flex-1">{m.hintDesignNoPhotos}</span>
          <GoToTabButton tab="photos" label={dict.dashboard.actionUpload} className={hintButton} />
        </p>
      )}
      <GalleryDesigner
        action={themeAction}
        themeOptions={themeOptions}
        initialTheme={themeMood[gallery.theme ?? ''] ?? 'tysha'}
        initialStyle={parseGalleryStyle(gallery.style)}
        coverUrl={previews.find((p) => p.asset.id === gallery.cover_asset_id)?.url ?? previews[0]?.url ?? null}
        photos={previews.slice(0, 8).map((p) => p.url).filter(Boolean)}
        galleryTitle={gallery.title}
        locale={locale}
        labels={{
          ...dict.designer,
          styleLabel: m.styleLabel,
          styleSave: m.styleSave,
          styleSaved: m.styleSaved,
        }}
      />
    </>
  )

  const card = 'rounded-2xl border border-line bg-white p-5 sm:p-6'
  const cardTitle = 'font-brand text-lg'

  // ------------------------------------------------------------------ Доступ
  const accessPanel = (
    <div className="flex max-w-2xl flex-col gap-6">
      {freeNotice}
      <section className={card}>
        <h2 className={cardTitle}>{gallery.is_published ? dict.dashboard.published : dict.dashboard.draft}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {gallery.is_published ? m.publishedHint : m.draftHint}
        </p>
        <form action={publishAction} className="mt-4">
          <button
            type="submit"
            data-testid="publish-toggle"
            className={`min-h-[44px] rounded-full px-5 text-sm font-bold ${
              gallery.is_published ? 'border border-line text-fg hover:border-fg' : 'bg-fg text-bg'
            }`}
          >
            {gallery.is_published ? m.unpublish : m.publish}
          </button>
        </form>
      </section>
      <section className={card}>
        <h2 className={`${cardTitle} mb-4`}>{m.settingsTitle}</h2>
        <GalleryAccessForm
          action={saveGalleryAccess.bind(null, locale, gallery.id)}
          hasPassword={hasPassword}
          expiry={expiryDefault}
          labels={{
            passwordLabel: m.settingsPasswordLabel,
            passwordSet: m.settingsPasswordSet,
            passwordNone: m.settingsPasswordNone,
            passwordHint: m.settingsPasswordHint,
            passwordRemove: m.settingsPasswordRemove,
            expiryLabel: m.settingsExpiryLabel,
            expiryHint: m.settingsExpiryHint,
            save: m.settingsSave,
            saving: m.saving,
            saved: m.saved,
            saveError: m.saveError,
          }}
        />
      </section>
      <section className={card}>
        <h2 className={cardTitle}>{m.accessDownloadsTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{m.accessDownloadsText}</p>
        {statsOn && (
          <p className="mt-2 text-sm font-bold text-fg">
            {m.accessDownloadsCount.replace('{n}', String(downloadCount ?? 0))}
          </p>
        )}
      </section>
      <section className={`${card} border-red-600/20`}>
        <h2 className={cardTitle}>{m.dangerTitle}</h2>
        <p className="mb-4 mt-2 text-sm leading-relaxed text-muted">{m.deleteConfirm}</p>
        <DeleteGalleryButton
          action={deleteAction}
          label={m.deleteGallery}
          confirmText={m.deleteAsk.replace('{title}', gallery.title)}
        />
      </section>
    </div>
  )

  // ------------------------------------------------------------------ Клієнт
  const stat = (value: number, label: string) => (
    <div className="rounded-xl bg-bg px-4 py-3">
      <p className="font-brand text-2xl leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
    </div>
  )
  const clientPanel = (
    <div className="flex flex-col gap-6">
      <DeliveryStatusControl
        initialStatus={deliveryStatus}
        initialEta={parseDeliveryEta(gallery.delivery_eta)}
        save={deliveryAction}
        labels={{
          title: m.deliveryTitle,
          hint: m.deliveryHint,
          teaser: dict.galleryManage.deliveryTeaserHint,
          none: m.deliveryNone,
          shot: m.deliveryShot,
          editing: m.deliveryEditing,
          ready: m.deliveryReady,
          etaLabel: m.deliveryEtaLabel,
          etaHint: m.deliveryEtaHint,
          etaClear: m.deliveryEtaClear,
          saving: m.deliverySaving,
          saved: m.deliverySaved,
          error: m.deliveryError,
        }}
      />
      <HowItWorks help={help.delivery} testId="help-delivery" />

      <ClientEmailControl
        available={clientEmail.available}
        initialEmail={clientEmail.email}
        sentAtText={
          clientEmail.sentAt
            ? new Date(clientEmail.sentAt).toLocaleString(intlLocale(locale), {
                timeZone: 'Europe/Kyiv',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null
        }
        isReady={gallery.delivery_status === 'ready'}
        isPublished={gallery.is_published}
        save={setClientEmail.bind(null, locale, gallery.id)}
        sendAgain={sendClientReadyEmailAgain.bind(null, locale, gallery.id)}
        labels={{
          title: dict.galleryManage.clientEmailTitle,
          hint: dict.galleryManage.clientEmailHint,
          label: dict.galleryManage.clientEmailLabel,
          consent: dict.galleryManage.clientEmailConsent,
          save: dict.galleryManage.clientEmailSave,
          remove: dict.galleryManage.clientEmailRemove,
          saving: dict.galleryManage.clientEmailSaving,
          saved: dict.galleryManage.clientEmailSaved,
          invalid: dict.galleryManage.clientEmailInvalid,
          needConsent: dict.galleryManage.clientEmailNeedConsent,
          error: dict.galleryManage.clientEmailError,
          unavailable: dict.galleryManage.clientEmailUnavailable,
          sentAt: dict.galleryManage.clientEmailSentAt,
          waitReady: dict.galleryManage.clientEmailWaitReady,
          waitPublish: dict.galleryManage.clientEmailWaitPublish,
          sendAgain: dict.galleryManage.clientEmailSendAgain,
          sendNow: dict.galleryManage.clientEmailSendNow,
          sending: dict.galleryManage.clientEmailSending,
          sent: dict.galleryManage.clientEmailSent,
          tooSoon: dict.galleryManage.clientEmailTooSoon,
          sendFailed: dict.galleryManage.clientEmailSendFailed,
        }}
      />

      <section className={card}>
        <h2 className={cardTitle}>{m.clientActivityTitle}</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat(totalFavorites, m.statsFavorites)}
          {stat(favoriteClients.size, m.favoritesClients)}
          {statsOn && stat(gallery.view_count, dict.dashboard.views)}
          {statsOn && stat(downloadCount ?? 0, m.statsDownloads)}
        </div>
        {picks.length === 0 && gallery.view_count === 0 && (
          <p className="mt-4 text-sm leading-relaxed text-muted" data-testid="hint-client-empty">
            {m.hintClientEmpty}
          </p>
        )}
      </section>

      <section className={card} data-testid="client-picks">
        <h2 className={cardTitle}>{m.favoritesTitle}</h2>
        {picks.length === 0 ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{m.favoritesEmpty}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              {m.statsFavorites}: {totalFavorites} · {m.picksRetouch}: {retouchCount} · {m.favoritesClients}:{' '}
              {pickClients.size}
            </p>
            <ClientPicksExport
              line={lightroom.text}
              count={lightroom.count}
              skipped={lightroom.skipped}
              txt={picksTxt(picks, pickLabels)}
              csv={picksCsv(picks, pickLabels)}
              fileBase={`${gallery.slug}-picks`}
              labels={{
                copy: m.picksCopy,
                copied: m.picksCopied,
                copyFailed: m.picksCopyFailed,
                hint: m.picksHint,
                substringNote: m.picksSubstringNote,
                lineLabel: m.picksLineLabel,
                skipped: m.picksSkipped,
                download: m.picksDownload,
              }}
            />
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {picks.map((pick) => {
                const url = previews.find((p) => p.asset.id === pick.assetId)?.url ?? ''
                return (
                  <figure key={pick.assetId} className="min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-line">
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
                        {pick.favorites > 0 && (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-accent">♥ {pick.favorites}</span>
                        )}
                        {pick.retouch > 0 && (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-fg">
                            {dict.designer.picksRetouch}
                            {pick.retouch > 1 ? ` ×${pick.retouch}` : ''}
                          </span>
                        )}
                      </span>
                    </div>
                    <figcaption className="mt-1 truncate text-xs text-muted" title={pick.name}>
                      {pick.name}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <GalleryTabs
        initialTab={parseGalleryTab(searchParams.tab)}
        ariaLabel={m.tabsLabel}
        labels={{ photos: m.tabPhotos, design: m.tabDesign, access: m.tabAccess, client: m.tabClient }}
        badges={{ photos: photoCount, client: picks.length }}
        header={header}
        panels={{ photos: photosPanel, design: designPanel, access: accessPanel, client: clientPanel }}
      />
    </main>
  )
}

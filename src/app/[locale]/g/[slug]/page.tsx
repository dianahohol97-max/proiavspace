import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { isGalleryUnlocked } from '@/lib/gallery-access'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { effectiveGalleryPlan } from '@/lib/plans'
import { resolveGalleryTheme } from '@/lib/site/themes'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseGalleryStyle } from '@/lib/gallery/style'
import { GalleryExperience, type GalleryItem } from '@/components/gallery/GalleryExperience'
import { LangPicker } from '@/components/LangPicker'
import type { Asset } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Client galleries are private-by-link — never in search indexes. */
export const metadata = {
  robots: { index: false, follow: false },
}

/**
 * The client-facing gallery: full-bleed cover, sticky selection bar,
 * lightbox with explicit download buttons. The STYLE is the photographer's:
 * per-gallery theme override → their site theme → «Тиша». Reads run as anon
 * under RLS (published, non-expired galleries only).
 */
export default async function PublicGalleryPage({
  params,
  searchParams,
}: {
  params: { locale: string; slug: string }
  searchParams: { error?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()

  // has_password (a safe boolean) — the scrypt hash itself is not selectable by
  // the anon key at all (revoked in migration 0020), so it can never leak here.
  const { data: gallery } = await supabase
    .from('galleries')
    .select(
      'id, slug, title, description, event_date, has_password, is_published, cover_asset_id, theme, style'
    )
    .eq('slug', params.slug)
    .single<{
      id: string
      slug: string
      title: string
      description: string | null
      event_date: string | null
      has_password: boolean
      is_published: boolean
      cover_asset_id: string | null
      theme: string | null
      style: unknown
    }>()

  if (!gallery) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 text-center">
        <p className="leading-relaxed text-muted">{dict.publicGallery.notFound}</p>
      </main>
    )
  }

  if (!isGalleryUnlocked(gallery)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="absolute right-6 top-6">
          <LangPicker current={locale} />
        </div>
        <h1 className="font-display text-3xl">{gallery.title}</h1>
        <p className="mt-4 text-muted">{dict.publicGallery.passwordTitle}</p>
        <form
          method="post"
          action={`/api/galleries/${gallery.slug}/unlock`}
          className="mt-8 flex flex-col gap-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <label className="text-sm text-muted" htmlFor="password">
            {dict.publicGallery.passwordLabel}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="border border-line bg-transparent px-4 py-3 outline-none focus:border-fg"
          />
          {searchParams.error === 'password' && (
            <p className="text-sm text-accent">{dict.publicGallery.passwordError}</p>
          )}
          <button
            type="submit"
            className="mt-2 border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.publicGallery.passwordSubmit}
          </button>
        </form>
      </main>
    )
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('gallery_id', gallery.id)
    .order('position')
    .order('created_at')
    .returns<Asset[]>()

  // Branding + plan gates + site theme for style inheritance.
  const { data: brandingData } = await supabase.rpc('get_gallery_branding', {
    gallery_slug: gallery.slug,
  })
  const branding =
    (
      brandingData as
        | {
            display_name: string | null
            display_name_en: string | null
            logo_key: string | null
            plan: string | null
            grace_until: string | null
            site_theme: string | null
            site_mode: string | null
            tip_link: string | null
            contact_url: string | null
          }[]
        | null
    )?.[0] ?? null

  // English-locale galleries show the Latin-script name when the photographer
  // set one — «Діана Гоголь» reads wrong under an English UI.
  const brandName =
    (locale === 'en' ? branding?.display_name_en : null) ?? branding?.display_name ?? null
  // Honour the grace window: once a canceled plan's grace expires, the public
  // gallery must fall back to free (badge returns, custom logo drops) instead of
  // keeping paid perks forever. grace_until comes from get_gallery_branding
  // (added in migration 0018); older RPC output leaves it undefined → treated as null.
  const ownerPlan = effectiveGalleryPlan(branding?.plan ?? 'free', branding?.grace_until ?? null)
  const { theme, mode } = resolveGalleryTheme(
    gallery.theme,
    branding?.site_theme,
    branding?.site_mode
  )

  const storage = getStorage()
  const logoUrl =
    branding?.logo_key && ownerPlan.features.photographerLogo
      ? await storage.getSignedReadUrl(branding.logo_key, { expiresInSeconds: 60 * 60 })
      : null

  const items: GalleryItem[] = await Promise.all(
    (assets ?? []).map(async (asset) => ({
      id: asset.id,
      kind: asset.kind,
      width: asset.width,
      height: asset.height,
      focalX: asset.focal_x ?? null,
      focalY: asset.focal_y ?? null,
      previewUrl: await storage.getSignedReadUrl(asset.variants.preview ?? asset.r2_key, {
        expiresInSeconds: 60 * 60,
      }),
      // For videos, a still frame so the grid never streams the original.
      posterUrl: asset.variants.poster
        ? await storage.getSignedReadUrl(asset.variants.poster, { expiresInSeconds: 60 * 60 })
        : null,
      downloadHref: `/api/assets/${asset.id}/download`,
    }))
  )

  const coverAsset =
    (gallery.cover_asset_id && (assets ?? []).find((a) => a.id === gallery.cover_asset_id)) ||
    (assets ?? [])[0]
  const coverIsVideo = coverAsset?.kind === 'video'
  // Poster: a video's still, else the photo preview.
  const coverUrl = coverAsset
    ? await storage.getSignedReadUrl(
        (coverIsVideo ? coverAsset.variants.poster : coverAsset.variants.preview) ??
          coverAsset.variants.preview ??
          coverAsset.r2_key,
        { expiresInSeconds: 60 * 60 }
      )
    : null
  // Looping clip behind the title when the cover is a video.
  const coverVideoUrl = coverIsVideo
    ? await storage.getSignedReadUrl(coverAsset.variants.preview ?? coverAsset.r2_key, {
        expiresInSeconds: 60 * 60,
      })
    : null

  // Basic stats: count the view (fire-and-forget semantics, errors ignored).
  await supabase.rpc('record_gallery_view', { gallery_slug: gallery.slug })

  // This client's current favorites (scoped by the middleware-minted token).
  const clientToken = cookies().get('ct')?.value
  let initialFavorites: string[] = []
  if (clientToken) {
    // Token-scoped RPC — the selections table is no longer readable directly
    // by the anon key, so this can only ever return this client's own picks.
    const { data: selections } = await supabase.rpc('list_selections', {
      p_gallery: gallery.id,
      p_token: clientToken,
    })
    initialFavorites = ((selections ?? []) as { asset_id: string; kind: string }[])
      .filter((s) => s.kind === 'favorite')
      .map((s) => s.asset_id)
  }

  const eventLine = [
    gallery.event_date
      ? new Date(gallery.event_date).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null,
    gallery.description,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <GalleryExperience
      locale={locale}
      slug={gallery.slug}
      title={gallery.title}
      eventLine={eventLine || null}
      brandName={brandName}
      contactUrl={branding?.contact_url ?? null}
      logoUrl={logoUrl}
      coverUrl={coverUrl}
      coverVideoUrl={coverVideoUrl}
      items={items}
      initialFavorites={initialFavorites}
      showBadge={!ownerPlan.features.brandingRemoval}
      tipUrl={ownerPlan.features.tips ? (branding?.tip_link ?? null) : null}
      theme={theme}
      mode={mode}
      style={parseGalleryStyle(gallery.style)}
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

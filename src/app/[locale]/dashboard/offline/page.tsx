import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { OfflinePortfolio, type PortfolioCandidate } from '@/components/app/OfflinePortfolio'

export const dynamic = 'force-dynamic'

/** «Портфоліо офлайн»: which galleries live on this phone (components/app/OfflinePortfolio). */
export default async function OfflinePortfolioPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: galleries } = await supabase
    .from('galleries')
    .select('id, title, cover_asset_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)
    .returns<{ id: string; title: string; cover_asset_id: string | null }[]>()

  const storage = getStorage()
  const candidates: PortfolioCandidate[] = await Promise.all(
    (galleries ?? []).map(async (gallery) => {
      const [{ count }, { data: cover }] = await Promise.all([
        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('gallery_id', gallery.id)
          .eq('kind', 'photo'),
        gallery.cover_asset_id
          ? supabase
              .from('assets')
              .select('r2_key, variants')
              .eq('id', gallery.cover_asset_id)
              .maybeSingle<{ r2_key: string; variants: Record<string, string> }>()
          : Promise.resolve({ data: null }),
      ])
      const coverKey = cover ? cover.variants?.thumb ?? cover.variants?.preview ?? null : null
      return {
        id: gallery.id,
        title: gallery.title,
        photoCount: count ?? 0,
        coverUrl: coverKey ? await storage.getSignedReadUrl(coverKey, { expiresInSeconds: 60 * 60 }) : null,
      }
    })
  )

  return (
    <main className="mx-auto max-w-xl px-4 py-6 lg:px-6 lg:py-12">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>
      <h1 className="mt-4 font-brand text-3xl">{dict.app.offlineTitle}</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">{dict.app.offlineLede}</p>
      <OfflinePortfolio t={dict.app} locale={locale} galleries={candidates.filter((g) => g.photoCount > 0)} />
    </main>
  )
}

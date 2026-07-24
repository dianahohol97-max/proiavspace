import { notFound, redirect } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { localizedSiteContent, parseSiteContent } from '@/lib/site/content'
import { isThemeId } from '@/lib/site/themes'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SiteRenderer, type PortfolioItem } from '@/components/site/SiteRenderer'

export const dynamic = 'force-dynamic'

/** Owner-only, never indexed — it renders drafts too. */
export const metadata = { robots: { index: false, follow: false } }

interface PortfolioRow {
  id: string
  r2_key: string
  variants: Record<string, string>
  visible: boolean
  category: string | null
  caption: string | null
}

/**
 * Full-page preview of the photographer's OWN site — exactly as the public
 * page renders it, but readable even while the site is a draft. Lives outside
 * the dashboard layout so there is no sidebar chrome around it.
 */
export default async function SitePreviewPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ data: site }, { data: profile }, { data: portfolioRows }] = await Promise.all([
    supabase
      .from('sites')
      .select('handle, theme, mode, content')
      .eq('user_id', user.id)
      .maybeSingle<{ handle: string | null; theme: string; mode: string; content: unknown }>(),
    supabase
      .from('profiles')
      .select('display_name, logo_url')
      .eq('user_id', user.id)
      .single<{ display_name: string | null; logo_url: string | null }>(),
    supabase
      .from('portfolio_assets')
      .select('id, r2_key, variants, visible, category, caption')
      .eq('owner_id', user.id)
      .order('position')
      .order('created_at')
      .returns<PortfolioRow[]>(),
  ])
  if (!site) notFound()

  const storage = getStorage()
  const logoUrl = profile?.logo_url
    ? await storage.getSignedReadUrl(profile.logo_url, { expiresInSeconds: 60 * 60 })
    : null

  const portfolio: PortfolioItem[] = await Promise.all(
    (portfolioRows ?? [])
      .filter((row) => row.visible !== false)
      .map(async (row) => ({
        id: row.id,
        previewUrl: await storage.getSignedReadUrl(
          row.variants.preview ?? row.variants.thumb ?? row.r2_key,
          { expiresInSeconds: 60 * 60 }
        ),
        visible: row.visible,
        category: row.category,
        caption: row.caption,
      }))
  )

  const raw = parseSiteContent(site.content)
  const content = localizedSiteContent(raw, locale)
  const theme = isThemeId(site.theme) ? site.theme : 'tysha'
  const mode = site.mode === 'night' ? 'night' : 'light'

  return (
    <SiteRenderer
      theme={theme}
      mode={mode}
      content={content}
      displayName={profile?.display_name ?? null}
      logoUrl={logoUrl}
      portfolio={portfolio}
      labels={{
        portfolio: dict.publicSite.portfolio,
        about: dict.publicSite.about,
        pricing: dict.publicSite.pricing,
        contacts: dict.publicSite.contacts,
        book: dict.publicSite.book,
        photos: locale === 'uk' ? 'фото' : 'photos',
        viewSeries: locale === 'uk' ? 'Дивитись серію' : 'View series',
        close: locale === 'uk' ? 'Закрити' : 'Close',
      }}
      leadForm={
        raw.settings.leadForm
          ? {
              handle: site.handle,
              labels: {
                title: dict.publicSite.leadTitle,
                name: dict.publicSite.leadName,
                contact: dict.publicSite.leadContact,
                message: dict.publicSite.leadMessage,
                send: dict.publicSite.leadSend,
                sent: dict.publicSite.leadSent,
                error: dict.publicSite.leadError,
              },
            }
          : undefined
      }
    />
  )
}

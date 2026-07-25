import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { saveSite } from '@/lib/actions/site'
import { SiteLeads } from '@/components/site-editor/SiteLeads'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { isSiteTrialExpired, siteTrialDaysLeft } from '@/lib/plans'
import { parseSiteContent } from '@/lib/site/content'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SiteEditor } from '@/components/site-editor/SiteEditor'
import type { PortfolioItem } from '@/components/site/SiteRenderer'

export const dynamic = 'force-dynamic'

interface SiteRow {
  handle: string | null
  theme: string
  mode: string
  is_published: boolean
  content: unknown
  custom_domain: string | null
  custom_domain_status: string | null
}

interface PortfolioRow {
  id: string
  r2_key: string
  variants: Record<string, string>
  visible: boolean
  category: string | null
  caption: string | null
}

export default async function SiteEditorPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ data: site }, { data: profile }, { data: portfolioRows }, { data: leadRows }] =
    await Promise.all([
      supabase
        .from('sites')
        .select('handle, theme, mode, is_published, content, custom_domain, custom_domain_status')
        .eq('user_id', user.id)
        .maybeSingle<SiteRow>(),
      supabase
        .from('profiles')
        .select('display_name, logo_url, site_plan, created_at')
        .eq('user_id', user.id)
        .single<{
          display_name: string | null
          logo_url: string | null
          site_plan: string
          created_at: string
        }>(),
      supabase
        .from('portfolio_assets')
        .select('id, r2_key, variants, visible, category, caption')
        .eq('owner_id', user.id)
        .order('position')
        .order('created_at')
        .returns<PortfolioRow[]>(),
      supabase
        .from('site_leads')
        .select('id, name, contact, message, created_at')
        .eq('site_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const storage = getStorage()
  const logoUrl = profile?.logo_url
    ? await storage.getSignedReadUrl(profile.logo_url, { expiresInSeconds: 60 * 60 })
    : null
  const portfolio: PortfolioItem[] = await Promise.all(
    (portfolioRows ?? []).map(async (row) => ({
      id: row.id,
      previewUrl: await storage.getSignedReadUrl(
        row.variants.thumb ?? row.variants.preview ?? row.r2_key,
        { expiresInSeconds: 60 * 60 }
      ),
      visible: row.visible,
      category: row.category,
      caption: row.caption,
    }))
  )

  const content = parseSiteContent(site?.content)
  const currentCatalogValue =
    site?.theme === 'tysha' && site.mode === 'night' ? 'opivnich' : (site?.theme ?? 'tysha')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicUrl =
    site?.is_published && site.handle ? `${appUrl}/${locale}/s/${site.handle}` : null

  // Site trial status (uk-first internal copy; the site product launches UA).
  const sitePlan = profile?.site_plan ?? 'site_trial'
  const createdAt = profile?.created_at ?? null
  const trialExpired = isSiteTrialExpired(sitePlan, createdAt)
  const trialDaysLeft = siteTrialDaysLeft(sitePlan, createdAt)

  const themeNames: Record<string, string> = {
    tysha: dict.site.themeTysha,
    opivnich: dict.site.themeOpivnich,
    povitria: dict.site.themePovitria,
    plivka: dict.site.themePlivka,
    zhurnal: dict.site.themeZhurnal,
    galereia: dict.site.themeGalereia,
    arkhiv: dict.site.themeArkhiv,
    prodakshn: dict.site.themeProdakshn,
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>
      <h1 className="mb-2 mt-5 font-brand text-3xl">{dict.site.title}</h1>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">{dict.site.intro}</p>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4 text-sm">
        <span className="mt-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          {locale === 'uk' ? 'В розробці' : 'In progress'}
        </span>
        <p className="text-muted">
          {locale === 'uk'
            ? 'Конструктор сайтів ще в розробці — можете гратися й готувати контент, але поки не радимо давати адресу сайту клієнтам. Про повноцінний запуск повідомимо. А серце сервісу зараз — клієнтські галереї.'
            : 'The site builder is still in development — feel free to experiment and prep content, but we don’t recommend sharing the site address with clients yet. We’ll announce the full launch. For now, client galleries are the core of the service.'}
        </p>
      </div>

      <a
        href={`/${locale}/site-preview`}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-fg px-5 py-2 text-sm font-semibold no-underline transition-colors hover:bg-fg hover:text-bg"
      >
        {locale === 'uk' ? 'Повне превʼю сайту ↗' : 'Full site preview ↗'}
      </a>
      {publicUrl && (
        <p className="mb-6 break-all text-sm text-muted">
          {dict.site.publicLink}: {publicUrl}
        </p>
      )}

      {trialExpired ? (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <p className="font-semibold text-amber-800">Пробний місяць сайту завершився</p>
          <p className="mt-1 text-amber-900/80">
            Сайт знято з публікації й повернуто в чернетки. Оформіть тариф сайту, щоб знову
            опублікувати його —{' '}
            <Link href={`/${locale}/dashboard/billing`} className="underline">
              перейти до тарифів
            </Link>
            . Ваш контент і портфоліо збережені.
          </p>
        </div>
      ) : (
        sitePlan === 'site_trial' &&
        trialDaysLeft !== null && (
          <div className="mb-6 rounded-2xl border border-line bg-bg px-5 py-4 text-sm text-muted">
            Пробний період сайту: залишилось <b className="text-fg">{trialDaysLeft}</b>{' '}
            {trialDaysLeft === 1 ? 'день' : trialDaysLeft < 5 ? 'дні' : 'днів'}. Після цього сайт
            стане чернеткою, поки не оформите тариф.
          </div>
        )
      )}

      <SiteEditor
        locale={locale}
        action={saveSite.bind(null, locale)}
        initialHandle={site?.handle ?? ''}
        initialCatalogValue={currentCatalogValue}
        initialPublished={site?.is_published ?? false}
        initialDomain={site?.custom_domain ?? ''}
        initialDomainStatus={site?.custom_domain_status ?? 'pending'}
        content={content}
        displayName={profile?.display_name ?? null}
        logoUrl={logoUrl}
        portfolio={portfolio}
        siteLabels={{
          portfolio: dict.publicSite.portfolio,
          about: dict.publicSite.about,
          pricing: dict.publicSite.pricing,
          contacts: dict.publicSite.contacts,
          book: dict.publicSite.book,
          photos: locale === 'uk' ? 'фото' : 'photos',
          viewSeries: locale === 'uk' ? 'Дивитись серію' : 'View series',
          close: locale === 'uk' ? 'Закрити' : 'Close',
        }}
        leadFormLabels={{
          title: dict.publicSite.leadTitle,
          name: dict.publicSite.leadName,
          contact: dict.publicSite.leadContact,
          message: dict.publicSite.leadMessage,
          send: dict.publicSite.leadSend,
          sent: dict.publicSite.leadSent,
          error: dict.publicSite.leadError,
        }}
        labels={{
          publish: dict.site.publish,
          handleLabel: dict.site.handleLabel,
          handleHint: dict.site.handleHint,
          themeLabel: dict.site.themeLabel,
          themeNames,
          heroLegend: dict.site.heroLegend,
          heroTitle: dict.site.heroTitle,
          heroSubtitle: dict.site.heroSubtitle,
          portfolioLegend: dict.site.portfolioLegend,
          portfolioHint: dict.site.portfolioHint,
          portfolioUpload: dict.site.portfolioUpload,
          portfolioUploading: dict.site.portfolioUploading,
          portfolioManageHint: dict.site.portfolioManageHint,
          portfolioDragHint: dict.site.portfolioDragHint,
          portfolioHiddenBadge: dict.site.portfolioHiddenBadge,
          portfolioShow: dict.site.portfolioShow,
          portfolioHide: dict.site.portfolioHide,
          portfolioCategory: dict.site.portfolioCategory,
          portfolioCaption: dict.site.portfolioCaption,
          portfolioUploadTo: dict.site.portfolioUploadTo,
          portfolioCategoryEg: dict.site.portfolioCategoryEg,
          portfolioUncategorized: dict.site.portfolioUncategorized,
          aboutLegend: dict.site.aboutLegend,
          aboutPlaceholder: dict.site.aboutPlaceholder,
          pricingLegend: dict.site.pricingLegend,
          priceName: dict.site.priceName,
          priceAmount: dict.site.priceAmount,
          priceIncludes: dict.site.priceIncludes,
          contactLegend: dict.site.contactLegend,
          contactEmail: dict.site.contactEmail,
          contactPhone: dict.site.contactPhone,
          contactInstagram: dict.site.contactInstagram,
          contactBooking: dict.site.contactBooking,
          contactBookingHint: dict.site.contactBookingHint,
          optionsLegend: dict.site.optionsLegend,
          optLeadForm: dict.site.optLeadForm,
          optLeadFormHint: dict.site.optLeadFormHint,
          langLegend: dict.site.langLegend,
          langHint: dict.site.langHint,
          translateLegend: dict.site.translateLegend,
          translateHint: dict.site.translateHint,
          translateHeroTitle: dict.site.translateHeroTitle,
          translateHeroSubtitle: dict.site.translateHeroSubtitle,
          translateAbout: dict.site.translateAbout,
          save: dict.site.save,
          previewLabel: dict.site.previewLabel,
          delete: dict.common.delete,
        }}
      />

      <SiteLeads
        locale={locale}
        leads={leadRows ?? []}
        labels={{
          title: dict.site.leadsTitle,
          empty: dict.site.leadsEmpty,
          delete: dict.common.delete,
        }}
      />
    </main>
  )
}

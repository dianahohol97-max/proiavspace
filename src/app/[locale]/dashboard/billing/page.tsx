import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDictionary, type Dictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import {
  GALLERY_PLANS,
  SITE_PLANS,
  effectiveGalleryPlan,
  planStorageBytes,
  type GalleryPlan,
  type GalleryPlanId,
  type SitePlanId,
} from '@/lib/plans'
import { IMPORT_PROMO, isPromoRunning, type PromoGrant } from '@/lib/promo'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BillingPlans } from '@/components/BillingPlans'
import { PromoAutopay } from '@/components/PromoAutopay'
import { buildGalleryCard, buildSiteCard } from '@/components/billing-cards'
import {
  BillingSubscriptions,
  type SubscriptionView,
} from '@/components/BillingSubscriptions'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

function formatGb(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} ГБ` : `${Math.max(Math.round(bytes / (1024 * 1024)), 0)} МБ`
}

function galleryFeatureLines(plan: GalleryPlan, dict: Dictionary): string[] {
  const f = plan.features
  const lines: string[] = [dict.billing.featureSelection]
  if (f.brandingRemoval) lines.push(dict.billing.featureNoBranding)
  if (f.photographerLogo) lines.push(dict.billing.featureLogo)
  if (f.video) lines.push(dict.billing.featureVideo)
  if (f.stats) lines.push(dict.billing.featureStats)
  if (f.tips) lines.push(dict.billing.featureTips)
  if (f.prioritySupport) lines.push(dict.billing.featureSupport)
  return lines
}

export default async function BillingPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single<Profile>()
  if (!profile) notFound()

  const { data: subRows } = await supabase
    .from('billing_subscriptions')
    .select('product, plan, period, next_charge_at, status')
    .eq('user_id', user.id)

  const { data: promoGrant } = await supabase
    .from('promo_grants')
    .select('ends_at, autopay_at')
    .eq('user_id', user.id)
    .maybeSingle<PromoGrant>()
  const promoRunning = isPromoRunning(promoGrant)

  const galleryNames: Record<GalleryPlanId, string> = {
    free: dict.billing.planFree,
    basic: dict.billing.planBasic,
    plus: dict.billing.planPlus,
    pro: dict.billing.planPro,
  }
  const galleryNotes: Record<GalleryPlanId, string> = {
    free: dict.billing.noteFree,
    basic: dict.billing.noteBasic,
    plus: dict.billing.notePlus,
    pro: dict.billing.notePro,
  }
  const siteNames: Record<SitePlanId, string> = {
    site_trial: dict.billing.sitePlanTrial,
    site_basic: dict.billing.sitePlanBasic,
    site_plus: dict.billing.sitePlanPlus,
  }
  const siteNotes: Record<SitePlanId, string> = {
    site_trial: dict.billing.siteTrialNote,
    site_basic: dict.billing.siteBasicNote,
    site_plus: dict.billing.sitePlusNote,
  }

  const galleryCards = (Object.keys(GALLERY_PLANS) as GalleryPlanId[]).map((id) =>
    buildGalleryCard(
      GALLERY_PLANS[id],
      galleryNames[id],
      galleryNotes[id],
      `${GALLERY_PLANS[id].storageGb >= 1024 ? `${GALLERY_PLANS[id].storageGb / 1024} ТБ` : `${GALLERY_PLANS[id].storageGb} ГБ`} ${dict.billing.storage}`,
      galleryFeatureLines(GALLERY_PLANS[id], dict),
      profile.plan
    )
  )
  const siteCards = (Object.keys(SITE_PLANS) as SitePlanId[]).map((id) =>
    buildSiteCard(SITE_PLANS[id], siteNames[id], siteNotes[id], profile.site_plan)
  )

  const labels = {
    periodMonth: dict.billing.periodMonth,
    periodYear: dict.billing.periodYear,
    upgrade: dict.billing.upgrade,
    currentBadge: dict.billing.currentBadge,
    perMonth: dict.billing.perMonth,
    perYear: dict.billing.perYear,
    freePrice: dict.billing.freePrice,
    notConfigured: dict.billing.notConfigured,
    checkoutError: dict.billing.checkoutError,
  }

  const subscriptions: SubscriptionView[] = (subRows ?? [])
    .filter(
      (row): row is typeof row & { product: 'gallery' | 'site' } =>
        row.product === 'gallery' || row.product === 'site'
    )
    .map((row) => ({
      product: row.product,
      planName:
        row.product === 'gallery' && isGalleryKey(row.plan)
          ? galleryNames[row.plan]
          : row.product === 'site' && isSiteKey(row.plan)
            ? siteNames[row.plan]
            : row.plan,
      period: row.period,
      nextChargeAt: row.next_charge_at,
      status:
        row.status === 'canceled' || row.status === 'past_due'
          ? row.status
          : 'active',
    }))

  const currentGalleryName = isGalleryKey(profile.plan)
    ? galleryNames[profile.plan]
    : profile.plan
  const currentSiteName = isSiteKey(profile.site_plan)
    ? siteNames[profile.site_plan]
    : profile.site_plan

  // Show the limit that actually gates uploads — mirrors src/lib/uploads.ts, so
  // an expired/downgraded account shows its real (free) quota, not a stale one.
  const effectiveStorageLimit = Math.min(
    profile.storage_limit_bytes,
    planStorageBytes(effectiveGalleryPlan(profile.plan, profile.grace_until))
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>

      <h1 className="mt-6 font-brand text-3xl">{dict.billing.title}</h1>
      <p className="mt-4 text-sm text-muted">
        {dict.billing.currentPlan}: {currentGalleryName} · {dict.billing.currentSitePlan}:{' '}
        {currentSiteName} · {dict.dashboard.storageUsed}: {formatGb(profile.storage_used_bytes)} /{' '}
        {formatGb(effectiveStorageLimit)}
      </p>
      {promoGrant && promoRunning && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
          {(() => {
            const values: Record<string, string> = {
              date: new Date(promoGrant.ends_at).toLocaleDateString(
                locale === 'uk' ? 'uk-UA' : 'en-GB'
              ),
              price: String(IMPORT_PROMO.plan.priceUahMonth),
            }
            const fill = (template: string) =>
              template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
            return promoGrant.autopay_at ? (
              <p className="text-sm leading-relaxed">{fill(dict.billing.promoAutopayDone)}</p>
            ) : (
              <>
                <p className="font-bold">{fill(dict.billing.promoActive)}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {fill(dict.billing.promoAutopayHint)}
                </p>
                <PromoAutopay
                  locale={locale}
                  labels={{
                    button: dict.billing.promoAutopayButton,
                    notConfigured: dict.billing.notConfigured,
                    checkoutError: dict.billing.checkoutError,
                  }}
                />
              </>
            )
          })()}
        </div>
      )}
      {profile.grace_until && !promoRunning && (
        <p className="mt-2 text-sm text-accent">
          {dict.billing.graceNotice}{' '}
          {new Date(profile.grace_until).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB')}
        </p>
      )}

      <section className="mt-12">
        <h2 className="mb-6 font-brand text-xl">{dict.billing.galleryPlansTitle}</h2>
        <BillingPlans cards={galleryCards} locale={locale} labels={labels} columns={3} />
      </section>

      <section className="mt-14">
        <h2 className="mb-6 font-brand text-xl">{dict.billing.sitePlansTitle}</h2>
        <BillingPlans cards={siteCards} locale={locale} labels={labels} columns={3} />
        <p className="mt-4 text-xs text-muted">{dict.billing.bundleNote}</p>
      </section>

      <BillingSubscriptions
        subscriptions={subscriptions}
        locale={locale}
        labels={{
          title: dict.billing.autoRenewTitle,
          productGallery: dict.billing.galleryPlansTitle,
          productSite: dict.billing.sitePlansTitle,
          nextCharge: dict.billing.autoRenewNextCharge,
          activeUntil: dict.billing.autoRenewActiveUntil,
          statusPastDue: dict.billing.autoRenewPastDue,
          cancel: dict.billing.autoRenewCancel,
          canceled: dict.billing.autoRenewCanceled,
          confirm: dict.billing.autoRenewConfirm,
        }}
      />
    </main>
  )
}

function isGalleryKey(value: string): value is GalleryPlanId {
  return value in GALLERY_PLANS
}
function isSiteKey(value: string): value is SitePlanId {
  return value in SITE_PLANS
}

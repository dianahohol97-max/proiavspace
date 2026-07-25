/**
 * Pricing v2 — the single source of truth for tiers, prices and feature
 * gates. The landing, the billing page, checkout and upload gating all read
 * from here; changing a number here changes it everywhere.
 *
 * Margin logic behind the storage numbers: light tiers live on R2, heavy
 * tiers (500 GB+) move to B2 + CDN — that is why StorageProvider is an
 * abstraction. Yearly = two months free.
 */

export type GalleryPlanId = 'free' | 'basic' | 'plus' | 'pro'
export type SitePlanId = 'site_trial' | 'site_basic' | 'site_plus'
export type BillingPeriod = 'month' | 'year'

const GB = 1024 * 1024 * 1024

export interface PlanFeatures {
  /** No «Прояв» badge on public galleries/sites. */
  brandingRemoval: boolean
  /** Photographer's own logo shown in galleries. */
  photographerLogo: boolean
  /** Client photo selection (favorites/retouch) — free for everyone. */
  clientSelection: boolean
  /** Video files in galleries. */
  video: boolean
  /** Gallery view/download statistics. */
  stats: boolean
  /** Client tips (не реалізовано ще — гейт на майбутнє). */
  tips: boolean
  prioritySupport: boolean
}

export interface GalleryPlan {
  id: GalleryPlanId
  storageGb: number
  priceUahMonth: number
  priceUahYear: number
  /** Which storage backend the tier is costed for (informational). */
  backend: 'r2' | 'b2'
  features: PlanFeatures
}

const baseFeatures: PlanFeatures = {
  brandingRemoval: false,
  photographerLogo: false,
  clientSelection: true,
  video: false,
  stats: false,
  tips: false,
  prioritySupport: false,
}

export const GALLERY_PLANS: Record<GalleryPlanId, GalleryPlan> = {
  free: {
    id: 'free',
    storageGb: 3,
    priceUahMonth: 0,
    priceUahYear: 0,
    backend: 'r2',
    features: { ...baseFeatures },
  },
  basic: {
    id: 'basic',
    storageGb: 100,
    priceUahMonth: 79,
    priceUahYear: 790,
    backend: 'b2',
    features: { ...baseFeatures, brandingRemoval: true, photographerLogo: true },
  },
  plus: {
    id: 'plus',
    storageGb: 500,
    priceUahMonth: 319,
    priceUahYear: 3190,
    backend: 'b2',
    features: {
      ...baseFeatures,
      brandingRemoval: true,
      photographerLogo: true,
      video: true,
      stats: true,
      tips: true,
    },
  },
  pro: {
    id: 'pro',
    storageGb: 1024,
    priceUahMonth: 559,
    priceUahYear: 5590,
    backend: 'b2',
    features: {
      ...baseFeatures,
      brandingRemoval: true,
      photographerLogo: true,
      video: true,
      stats: true,
      tips: true,
      prioritySupport: true,
    },
  },
}

export interface SitePlan {
  id: SitePlanId
  sites: number
  priceUahMonth: number
  priceUahYear: number
  customDomain: boolean
}

/** Sites are a separate product with near-zero storage cost. */
export const SITE_PLANS: Record<SitePlanId, SitePlan> = {
  site_trial: { id: 'site_trial', sites: 1, priceUahMonth: 0, priceUahYear: 0, customDomain: false },
  site_basic: { id: 'site_basic', sites: 1, priceUahMonth: 99, priceUahYear: 990, customDomain: true },
  site_plus: { id: 'site_plus', sites: 2, priceUahMonth: 149, priceUahYear: 1490, customDomain: true },
}

/** Бандл «Галерея + Сайт»: знижка на сайт при активних обох підписках. */
export const BUNDLE_SITE_DISCOUNT = 0.15

/** Grace period after cancellation before limits drop to free (Pixover-style). */
export const GRACE_PERIOD_DAYS = 7

/** Free site trial: publish one site for this many days, then upgrade to keep it live. */
export const SITE_TRIAL_DAYS = 7

/**
 * True once a photographer still on the free site trial has passed the trial
 * window (counted from signup). Mirrors the SQL guard in get_site: after this,
 * the public site is hidden and the daily job flips it back to a draft.
 * A paid site (site_plan moved off 'site_trial') is never "expired".
 */
export function isSiteTrialExpired(sitePlan: string, createdAtIso: string | null): boolean {
  if (sitePlan !== 'site_trial' || !createdAtIso) return false
  const created = new Date(createdAtIso).getTime()
  if (Number.isNaN(created)) return false
  const ageMs = Date.now() - created
  return ageMs > SITE_TRIAL_DAYS * 24 * 60 * 60 * 1000
}

/** Days left in the site trial (0 once expired); null if not on the trial. */
export function siteTrialDaysLeft(sitePlan: string, createdAtIso: string | null): number | null {
  if (sitePlan !== 'site_trial' || !createdAtIso) return null
  const created = new Date(createdAtIso).getTime()
  if (Number.isNaN(created)) return null
  const endMs = created + SITE_TRIAL_DAYS * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function isGalleryPlanId(value: string): value is GalleryPlanId {
  return value in GALLERY_PLANS
}

export function isSitePlanId(value: string): value is SitePlanId {
  return value in SITE_PLANS
}

export function isBillingPeriod(value: string): value is BillingPeriod {
  return value === 'month' || value === 'year'
}

export function planStorageBytes(plan: GalleryPlan): number {
  return plan.storageGb * GB
}

export function galleryPlanPriceUah(plan: GalleryPlan, period: BillingPeriod): number {
  return period === 'month' ? plan.priceUahMonth : plan.priceUahYear
}

export function sitePlanPriceUah(plan: SitePlan, period: BillingPeriod): number {
  return period === 'month' ? plan.priceUahMonth : plan.priceUahYear
}

/**
 * The plan whose limits/features actually apply right now: after the grace
 * period of a canceled subscription runs out, the account behaves as free
 * (files are never deleted — uploads just stop while over the free limit).
 */
export function effectiveGalleryPlan(
  plan: string,
  graceUntil: string | null | undefined
): GalleryPlan {
  const known = isGalleryPlanId(plan) ? GALLERY_PLANS[plan] : GALLERY_PLANS.free
  if (graceUntil && new Date(graceUntil).getTime() < Date.now()) {
    return GALLERY_PLANS.free
  }
  return known
}

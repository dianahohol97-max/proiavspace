import { GALLERY_PLANS } from '@/lib/plans'

/**
 * «Імпортуй галерею — місяць Базового безкоштовно». The rules live here; the
 * atomic grant (slot count, once per account, free accounts only) is the
 * grant_import_promo() function in migration 0038.
 */
export const IMPORT_PROMO = {
  plan: GALLERY_PLANS.basic,
  /** First N accounts … */
  maxGrants: 30,
  /** … or until 31.12.2026 inclusive (Kyiv time), whichever comes first. */
  deadline: '2027-01-01T00:00:00+02:00',
  /** «Промо закінчується» email goes out this many days before the end. */
  reminderDaysBefore: 7,
} as const

export interface PromoGrant {
  ends_at: string
  autopay_at: string | null
}

/** The free month is still running (auto-payment connected or not). */
export function isPromoRunning(grant: PromoGrant | null | undefined, now = Date.now()): boolean {
  return !!grant && new Date(grant.ends_at).getTime() > now
}

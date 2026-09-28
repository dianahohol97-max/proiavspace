/**
 * Free plan: a gallery lives 30 days (decision 28.09.2026). Pure rules — the
 * cron /api/cron/free-expiry applies them (migration 0049 has the state).
 *
 *   created on Free          free_expires_at = created + 30 d
 *   7 days / 1 day before    e-mail «галерея закриється …» (one per owner/day)
 *   past free_expires_at     closed for clients (free_expired_at)
 *   closed + 7 d             files deleted (free_purged_at)
 *
 * A paid plan (payment, promo, partner period) clears the deadline in the
 * database (trigger on profiles); the cron never touches a paying owner.
 */

export const DAY_MS = 24 * 3600 * 1000
export const FREE_GALLERY_DAYS = 30
export const FREE_PURGE_AFTER_DAYS = 7
export const FREE_WARNING_DAYS = [7, 1] as const

export type FreeNoticeKind = 'd7' | 'd1'

export interface FreeGallery {
  galleryId: string
  expiresAt: string
  expiredAt: string | null
  assetCount: number
  ownerPaid: boolean
}

export type FreeGalleryAction =
  | { type: 'none' }
  | { type: 'notify'; kind: FreeNoticeKind; alsoMark: FreeNoticeKind[] }
  | { type: 'expire' }
  | { type: 'purge' }

const t = (iso: string) => new Date(iso).getTime()

/** Whole days until the deadline, rounded up (0 once it has passed). */
export function daysLeft(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((t(expiresAt) - now) / DAY_MS))
}

/** When the files of a closed gallery are deleted. */
export function purgeDate(expiredAt: string): Date {
  return new Date(t(expiredAt) + FREE_PURGE_AFTER_DAYS * DAY_MS)
}

export function planFreeGallery(
  gallery: FreeGallery,
  sent: Partial<Record<FreeNoticeKind, string>>,
  now: number = Date.now()
): FreeGalleryAction {
  if (gallery.ownerPaid) return { type: 'none' }
  if (gallery.expiredAt) {
    return now >= purgeDate(gallery.expiredAt).getTime() ? { type: 'purge' } : { type: 'none' }
  }
  if (now >= t(gallery.expiresAt)) return { type: 'expire' }
  // Empty drafts close silently — a letter about nothing is noise.
  if (gallery.assetCount === 0) return { type: 'none' }

  const msLeft = t(gallery.expiresAt) - now
  if (msLeft <= 1 * DAY_MS && !sent.d1) {
    // Missed the 7-day window (or created 1 day before, never): one letter, the latest.
    return { type: 'notify', kind: 'd1', alsoMark: sent.d7 ? [] : ['d7'] }
  }
  if (msLeft <= 7 * DAY_MS && !sent.d7 && !sent.d1) {
    return { type: 'notify', kind: 'd7', alsoMark: [] }
  }
  return { type: 'none' }
}

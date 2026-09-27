import { GALLERY_PLANS, GRACE_PERIOD_DAYS } from '@/lib/plans'

/**
 * Plan lifecycle after a paid plan or the import promo ends (audit LC-01,
 * decision 26.09.2026). Pure rules — the cron /api/cron/storage-retention
 * applies them; tests exercise every state here without a database.
 *
 *   grace_until − 14 d   plan / promo ended           → e-mail «14 днів усе працює»
 *   grace_until          galleries closed to clients  → e-mail «галереї закриті»
 *   closed + 30 / 7 / 1  reminders                    → e-mail «через N днів…»
 *   closed + 60 d        files deleted from B2
 *
 * Only accounts that do NOT fit into the Free allowance go down this road; a
 * lapsed account within 3 GB simply becomes Free (no deadline, only the limit).
 *
 * Safety rules baked in here (and relied on by the cron):
 *   • closure never comes sooner than 14 days after the grace e-mail was
 *     sent — so accounts that lapsed before this policy existed get a full
 *     notice period, not an instant closure;
 *   • deletion needs the «завтра» (1-day) reminder to have been sent at least
 *     20 hours earlier — no warning, no deletion;
 *   • anything that is paying again (grace_until in the future, or an
 *     auto-renewing plan) is reopened, never touched.
 */

export const DAY_MS = 24 * 3600 * 1000
export const RETENTION_DAYS = 60
export const REMINDER_DAYS = [30, 7, 1] as const
/** The last reminder must have gone out at least this long before deletion. */
export const LAST_REMINDER_LEAD_MS = 20 * 3600 * 1000

export const FREE_LIMIT_BYTES = GALLERY_PLANS.free.storageGb * 1024 * 1024 * 1024

export type NoticeKind =
  | 'grace_start'
  | 'failed_charge'
  | 'closed'
  | 'delete_30'
  | 'delete_7'
  | 'delete_1'
  | 'deleted'

export interface RetentionAccount {
  userId: string
  plan: string
  graceUntil: string | null
  galleryClosedAt: string | null
  storageUsedBytes: number
}

/** Notices already sent for this account's current lapse (cycle = grace_until). */
export type SentNotices = Partial<Record<NoticeKind, string>>

export type RetentionAction =
  /** Paying again (or never lapsed): clear a stale closure. */
  | { type: 'reopen' }
  /** Fits into Free: becomes a plain Free account, nothing is closed. */
  | { type: 'normalize' }
  | { type: 'notify'; kind: 'grace_start'; closesAt: Date }
  | { type: 'close'; deletesAt: Date }
  | { type: 'notify'; kind: 'delete_30' | 'delete_7' | 'delete_1'; deletesAt: Date; alsoMark: NoticeKind[] }
  | { type: 'delete' }

export type RetentionState =
  | 'free'
  | 'paid'
  | 'grace'
  | 'closing'
  | 'closed'
  | 'deleting'

export interface RetentionPlan {
  state: RetentionState
  /** Current lapse — the key notices are stored under. */
  cycle: string | null
  actions: RetentionAction[]
  closesAt: Date | null
  deletesAt: Date | null
}

const t = (iso: string) => new Date(iso).getTime()

/** True while a paid plan / promo gives full access (grace included). */
export function isPaying(account: Pick<RetentionAccount, 'plan' | 'graceUntil'>, now: number): boolean {
  return account.plan !== 'free' && (account.graceUntil === null || t(account.graceUntil) > now)
}

/** When a lapsed account's galleries close: grace end, but ≥ 14 d after the grace e-mail. */
export function closureDate(graceUntil: string, notices: SentNotices): Date {
  const noticeAt = notices.grace_start ?? notices.failed_charge
  const earliest = noticeAt ? t(noticeAt) + GRACE_PERIOD_DAYS * DAY_MS : Infinity
  return new Date(Math.max(t(graceUntil), earliest))
}

export function deletionDate(galleryClosedAt: string): Date {
  return new Date(t(galleryClosedAt) + RETENTION_DAYS * DAY_MS)
}

export function planRetention(
  account: RetentionAccount,
  notices: SentNotices,
  now: number = Date.now()
): RetentionPlan {
  const base = { cycle: account.graceUntil, closesAt: null, deletesAt: null }

  // Paying again (payment, new promo, ambassador): nothing to do but reopen.
  if (isPaying(account, now)) {
    const lapseStarted =
      account.graceUntil !== null && t(account.graceUntil) - GRACE_PERIOD_DAYS * DAY_MS <= now
    const actions: RetentionAction[] = account.galleryClosedAt ? [{ type: 'reopen' }] : []
    if (!lapseStarted || account.storageUsedBytes <= FREE_LIMIT_BYTES) {
      return { ...base, state: 'paid', actions }
    }
    // In the 14-day grace, over the Free allowance: tell them once.
    if (!notices.grace_start && !notices.failed_charge) {
      const closesAt = closureDate(account.graceUntil!, { grace_start: new Date(now).toISOString() })
      actions.push({ type: 'notify', kind: 'grace_start', closesAt })
      return { ...base, state: 'grace', actions, closesAt }
    }
    return { ...base, state: 'grace', actions, closesAt: closureDate(account.graceUntil!, notices) }
  }

  if (account.plan === 'free' && !account.galleryClosedAt) {
    return { ...base, state: 'free', actions: [] }
  }

  // Lapsed, but everything fits into Free (or they tidied up while closed).
  if (account.storageUsedBytes <= FREE_LIMIT_BYTES) {
    return { ...base, state: 'free', actions: [{ type: 'normalize' }] }
  }

  // Lapsed and over the Free allowance.
  if (!account.galleryClosedAt) {
    if (!notices.grace_start && !notices.failed_charge) {
      // Lapsed before this policy (or the grace e-mail never went out):
      // start the 14-day notice now instead of closing without warning.
      const closesAt = closureDate(account.graceUntil ?? new Date(now).toISOString(), {
        grace_start: new Date(now).toISOString(),
      })
      return {
        ...base,
        state: 'grace',
        actions: [{ type: 'notify', kind: 'grace_start', closesAt }],
        closesAt,
      }
    }
    const closesAt = closureDate(account.graceUntil ?? new Date(now).toISOString(), notices)
    if (closesAt.getTime() > now) {
      return { ...base, state: 'grace', actions: [], closesAt }
    }
    const deletesAt = new Date(now + RETENTION_DAYS * DAY_MS)
    return { ...base, state: 'closing', actions: [{ type: 'close', deletesAt }], closesAt, deletesAt }
  }

  const deletesAt = deletionDate(account.galleryClosedAt)
  const closesAt = new Date(account.galleryClosedAt)

  // Reminders: the latest one that is due; earlier due ones are marked as
  // covered so a cron that missed days never sends three letters at once.
  const due = REMINDER_DAYS.filter((days) => now >= deletesAt.getTime() - days * DAY_MS)
  const pending = due.filter((days) => !notices[`delete_${days}` as NoticeKind])
  if (pending.length > 0) {
    const latest = pending[pending.length - 1]
    const kind = `delete_${latest}` as 'delete_30' | 'delete_7' | 'delete_1'
    const alsoMark = pending.slice(0, -1).map((days) => `delete_${days}` as NoticeKind)
    return {
      ...base,
      state: 'closed',
      actions: [{ type: 'notify', kind, deletesAt, alsoMark }],
      closesAt,
      deletesAt,
    }
  }

  const lastReminder = notices.delete_1
  if (
    now >= deletesAt.getTime() &&
    lastReminder &&
    now - t(lastReminder) >= LAST_REMINDER_LEAD_MS
  ) {
    return { ...base, state: 'deleting', actions: [{ type: 'delete' }], closesAt, deletesAt }
  }
  return { ...base, state: 'closed', actions: [], closesAt, deletesAt }
}

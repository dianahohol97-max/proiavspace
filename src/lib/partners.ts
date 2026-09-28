import type { SupabaseClient } from '@supabase/supabase-js'
import { partnerEndingEmail } from '@/lib/lifecycle-emails'
import { contactOf, send } from '@/lib/lifecycle-notify'
import type { GalleryPlanId } from '@/lib/plans'

/**
 * Partner accounts (migration 0051): a paid plan for a set period, without
 * paying. The database does the plan switching (apply_partner_period); this
 * module is the admin-side defaults and the daily sync the cron runs.
 */

export const PARTNER_DEFAULT_PLAN: Exclude<GalleryPlanId, 'free'> = 'plus'
export const PARTNER_PRESET_MONTHS = [3, 6] as const
export const PARTNER_NOTICE_DAYS = 7
const DAY_MS = 24 * 3600 * 1000

export interface PartnerPeriod {
  id: string
  user_id: string
  plan: string
  starts_at: string
  ends_at: string
  note: string | null
  applied_at: string | null
  ending_notice_at: string | null
  finished_at: string | null
  finish_reason: string | null
}

/** End date for «3 / 6 місяців» from the start date (same day, N months on). */
export function partnerEndFromMonths(start: Date, months: number): Date {
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + months)
  return end
}

/** True when the «закінчується через 7 днів» letter is due. */
export function partnerNoticeDue(period: Pick<PartnerPeriod, 'ends_at' | 'applied_at' | 'ending_notice_at' | 'finished_at'>, now = Date.now()): boolean {
  if (period.finished_at || !period.applied_at || period.ending_notice_at) return false
  const left = new Date(period.ends_at).getTime() - now
  return left > 0 && left <= PARTNER_NOTICE_DAYS * DAY_MS
}

export interface PartnerSyncSummary {
  open: number
  active: number
  ended: number
  paid: number
  notified: number
  emailFailures: number
  errors: number
}

/**
 * Daily: apply / finish every open period, then send the 7-day letters.
 * The letter is journalled first (conditional update), sent, and un-journalled
 * if Brevo failed — tomorrow retries.
 */
export async function syncPartners(admin: SupabaseClient, options: { dryRun?: boolean } = {}): Promise<PartnerSyncSummary> {
  const summary: PartnerSyncSummary = { open: 0, active: 0, ended: 0, paid: 0, notified: 0, emailFailures: 0, errors: 0 }
  const { data, error } = await admin
    .from('partner_periods')
    .select('id, user_id, plan, starts_at, ends_at, note, applied_at, ending_notice_at, finished_at, finish_reason')
    .is('finished_at', null)
  if (error) throw new Error(`partner_periods: ${error.message}`)
  const periods = (data ?? []) as PartnerPeriod[]
  summary.open = periods.length
  if (options.dryRun) return summary

  for (const period of periods) {
    const { data: state, error: applyError } = await admin.rpc('apply_partner_period', { p_user: period.user_id })
    if (applyError) {
      summary.errors += 1
      console.error('partners: apply failed', period.user_id, applyError.message)
      continue
    }
    if (state === 'active') summary.active += 1
    if (state === 'ended') summary.ended += 1
    if (state === 'paid') summary.paid += 1
    if (state !== 'active') continue

    const current = { ...period, applied_at: period.applied_at ?? new Date().toISOString() }
    if (!partnerNoticeDue(current)) continue
    const { data: claimed } = await admin
      .from('partner_periods')
      .update({ ending_notice_at: new Date().toISOString() })
      .eq('id', period.id)
      .is('ending_notice_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) continue
    const contact = await contactOf(admin, period.user_id)
    const delivered =
      !!contact &&
      (await send(contact, partnerEndingEmail({ name: contact.name, plan: period.plan, endsAt: new Date(period.ends_at) })))
    if (delivered) {
      summary.notified += 1
    } else {
      summary.emailFailures += 1
      await admin.from('partner_periods').update({ ending_notice_at: null }).eq('id', period.id)
    }
  }
  return summary
}

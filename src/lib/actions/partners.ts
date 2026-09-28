'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { PARTNER_DEFAULT_PLAN, partnerEndFromMonths } from '@/lib/partners'
import { isGalleryPlanId } from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

/**
 * Admin: partner periods (migration 0051). Saving creates the account's open
 * period or edits it (plan, start, end, note), then applies it to the profile
 * right away; «Завершити зараз» ends it today (back to Free, galleries get 30
 * more days). Errors come back as ?partner=<code> on the account card.
 */

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect('/uk/dashboard')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Service role not configured')
  return { admin, email: user.email ?? '' }
}

const cardUrl = (locale: Locale, userId: string, result: string) =>
  `/${locale}/dashboard/stats/account/${userId}?partner=${result}`

/** «YYYY-MM-DD» from a date input → that day, 00:00 Kyiv. */
function kyivDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  // Kyiv is UTC+2/+3; noon UTC keeps the calendar day, then snap to 00:00 Kyiv.
  const noon = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(noon.getTime())) return null
  const offset = new Date(noon.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' })).getTime() - noon.getTime()
  return new Date(Date.parse(`${value}T00:00:00Z`) - offset)
}

export async function savePartnerPeriod(locale: Locale, userId: string, formData: FormData): Promise<void> {
  const { admin, email } = await requireAdmin()

  const planRaw = String(formData.get('plan') ?? PARTNER_DEFAULT_PLAN)
  const plan = isGalleryPlanId(planRaw) && planRaw !== 'free' ? planRaw : null
  const start = kyivDay(String(formData.get('starts_at') ?? '')) ?? new Date()
  const months = Number(formData.get('months') ?? 0)
  const end = months > 0 ? partnerEndFromMonths(start, months) : kyivDay(String(formData.get('ends_at') ?? ''))
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null

  if (!plan) redirect(cardUrl(locale, userId, 'bad_plan'))
  if (!end || end.getTime() <= start.getTime() || end.getTime() <= Date.now()) {
    redirect(cardUrl(locale, userId, 'bad_dates'))
  }

  const { data: sub } = await admin
    .from('billing_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('product', 'gallery')
    .eq('status', 'active')
    .maybeSingle()
  if (sub) redirect(cardUrl(locale, userId, 'has_subscription'))

  const { data: open } = await admin
    .from('partner_periods')
    .select('id')
    .eq('user_id', userId)
    .is('finished_at', null)
    .maybeSingle()
  const fields = { plan, starts_at: start.toISOString(), ends_at: end!.toISOString(), note, ending_notice_at: null }
  const { error } = open
    ? await admin.from('partner_periods').update(fields).eq('id', open.id)
    : await admin.from('partner_periods').insert({ ...fields, user_id: userId, created_by: email })
  if (error) {
    console.error('partners: save failed', error.message)
    redirect(cardUrl(locale, userId, 'save_failed'))
  }

  const { error: applyError } = await admin.rpc('apply_partner_period', { p_user: userId })
  if (applyError) console.error('partners: apply failed', applyError.message)
  revalidatePath(`/${locale}/dashboard/stats`)
  redirect(cardUrl(locale, userId, applyError ? 'apply_failed' : 'saved'))
}

export async function endPartnerPeriod(locale: Locale, userId: string): Promise<void> {
  const { admin } = await requireAdmin()
  const { data: open } = await admin
    .from('partner_periods')
    .select('id, starts_at')
    .eq('user_id', userId)
    .is('finished_at', null)
    .maybeSingle<{ id: string; starts_at: string }>()
  if (!open) redirect(cardUrl(locale, userId, 'none'))

  if (new Date(open.starts_at).getTime() > Date.now()) {
    // Not started yet: nothing was applied, just cancel it.
    await admin
      .from('partner_periods')
      .update({ finished_at: new Date().toISOString(), finish_reason: 'revoked' })
      .eq('id', open.id)
  } else {
    await admin.from('partner_periods').update({ ends_at: new Date().toISOString() }).eq('id', open.id)
    const { error } = await admin.rpc('apply_partner_period', { p_user: userId })
    if (error) console.error('partners: end failed', error.message)
  }
  revalidatePath(`/${locale}/dashboard/stats`)
  redirect(cardUrl(locale, userId, 'ended'))
}

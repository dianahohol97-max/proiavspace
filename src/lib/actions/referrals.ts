'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { canChargeTokens, getPayments } from '@/lib/payments'
import { GALLERY_PLANS, planStorageBytes } from '@/lib/plans'
import { sendWithdrawalEmail } from '@/lib/referral-emails'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

/**
 * Ambassador cash-out request. The RPC enforces the rules (ambassador only,
 * ≥ 200 ₴, up to the balance) and atomically moves the balance into a pending
 * withdrawal for the admin to pay out manually.
 */
export async function requestWithdrawal(locale: Locale, formData: FormData): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const details = String(formData.get('details') ?? '').trim().slice(0, 500)
  const { data: withdrawalId, error } = await supabase.rpc('request_withdrawal', {
    p_details: details,
  })
  if (!error && withdrawalId) {
    // Tell the admin (best-effort; the request itself is already saved).
    const [{ data: row }, { data: profile }] = await Promise.all([
      supabase.from('withdrawals').select('amount_kop').eq('id', withdrawalId).maybeSingle(),
      supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
    ])
    await sendWithdrawalEmail({
      name: profile?.display_name || user.email || user.id,
      email: user.email ?? '',
      amountKop: row?.amount_kop ?? 0,
      details,
    }).catch((cause: unknown) => console.error('withdrawal e-mail failed', cause))
  }
  if (error) {
    // Surface the RPC's guard reasons as a query flag the page can show.
    const reason = /below_minimum/.test(error.message)
      ? 'min'
      : /not_ambassador/.test(error.message)
        ? 'forbidden'
        : 'error'
    redirect(`/${locale}/dashboard/referrals?w=${reason}`)
  }
  revalidatePath(`/${locale}/dashboard/referrals`)
  redirect(`/${locale}/dashboard/referrals?w=ok`)
}

async function requireAdminClient() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect('/uk/dashboard')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Service role not configured')
  return admin
}

/**
 * Admin: mark a photographer as an ambassador (their own plans become free and
 * their referral rewards accrue as cash), or revoke it. Turning it on lifts them
 * to the top plans with a far-future expiry; revoking only flips the flag.
 */
export async function setAmbassador(locale: Locale, userId: string, on: boolean): Promise<void> {
  const admin = await requireAdminClient()
  const patch: Record<string, unknown> = { is_ambassador: on }
  if (on) {
    // «Все безкоштовно»: top gallery + site plans, storage lifted, expiry far out.
    patch.plan = 'pro'
    patch.storage_limit_bytes = planStorageBytes(GALLERY_PLANS.pro)
    patch.site_plan = 'site_plus'
    patch.grace_until = new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString()
  }
  const { error } = await admin.from('profiles').update(patch).eq('user_id', userId)
  if (error) throw new Error(error.message)
  if (on) {
    // «Все безкоштовно» also means the saved card is never charged again:
    // drop the auto-renewal rows (and the provider tokens) right away.
    const { data: subs } = await admin
      .from('billing_subscriptions')
      .select('id, card_token')
      .eq('user_id', userId)
    const payments = getPayments()
    for (const sub of (subs ?? []) as { id: string; card_token: string }[]) {
      if (payments && canChargeTokens(payments)) {
        await payments.deleteToken(sub.card_token).catch(() => undefined)
      }
      await admin.from('billing_subscriptions').delete().eq('id', sub.id)
    }
  }
  revalidatePath(`/${locale}/dashboard/stats`)
}

/**
 * Admin: resolve a cash-out request. 'paid' closes it; 'rejected' returns the
 * amount to the ambassador's cash balance so nothing is lost.
 */
export async function processWithdrawal(
  locale: Locale,
  withdrawalId: string,
  action: 'paid' | 'rejected'
): Promise<void> {
  const admin = await requireAdminClient()
  // Flip the status only if it is still 'requested'; the conditional update
  // fires at most once, so a double-click can't refund or pay twice.
  const { data: updated } = await admin
    .from('withdrawals')
    .update({ status: action, processed_at: new Date().toISOString() })
    .eq('id', withdrawalId)
    .eq('status', 'requested')
    .select('user_id, amount_kop')
    .maybeSingle<{ user_id: string; amount_kop: number }>()
  if (!updated) return // already processed by a prior click

  if (action === 'rejected') {
    // Atomic refund so it can't clobber a concurrent balance change.
    await admin.rpc('refund_cash', { p_user: updated.user_id, p_amount: updated.amount_kop })
  }
  revalidatePath(`/${locale}/dashboard/stats`)
}

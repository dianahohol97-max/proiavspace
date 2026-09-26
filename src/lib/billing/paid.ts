import type { SupabaseClient } from '@supabase/supabase-js'
import { AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL, referralRewardKop } from '@/lib/referrals'

/**
 * What happens to the money side once a payment is definitely paid, shared by
 * the provider webhook and the renewal cron (the cron sees synchronous
 * successes the webhook then skips, so it must run this itself):
 *
 *   1. the проЯв credit reserved against the payment is consumed;
 *   2. the payer's referrer is rewarded (credit / ambassador cash);
 *   3. the referral flips to 'converted' on the first payment;
 *   4. payments.referral_processed_at is set — the cron's repair pass retries
 *      any payment where step 2 failed, so a reward is never lost silently.
 *
 * Every step is idempotent in the database (consume_credit runs once per
 * claimed 'paid' transition; accrual is unique per payment_id), so re-running
 * this for the same payment is harmless.
 */
export interface PaidPayment {
  id: string
  user_id: string
  amount: number | string | null
  credit_applied_kop: number | null
}

export async function applyPaidSideEffects(
  admin: SupabaseClient,
  payment: PaidPayment,
  options: { cardToken?: string; consumeCredit?: boolean } = {}
): Promise<void> {
  const creditUsed = payment.credit_applied_kop ?? 0
  if (creditUsed > 0 && options.consumeCredit !== false) {
    const { error } = await admin.rpc('consume_credit', {
      p_user: payment.user_id,
      p_amount: creditUsed,
    })
    if (error) console.error('billing: consume_credit failed', payment.id, error.message)
  }
  await rewardReferrer(admin, payment, options.cardToken)
}

/** Steps 2–4 only: used directly by the cron's repair pass. */
export async function rewardReferrer(
  admin: SupabaseClient,
  payment: PaidPayment,
  cardToken?: string
): Promise<void> {
  const { data: payer, error: payerError } = await admin
    .from('profiles')
    .select('referred_by')
    .eq('user_id', payment.user_id)
    .single()
  if (payerError) {
    console.error('billing: payer lookup failed', payment.id, payerError.message)
    return
  }

  if (payer?.referred_by) {
    const rewardKop = referralRewardKop(Number(payment.amount ?? 0))
    const { error } = await admin.rpc('accrue_referral_reward', {
      p_referrer: payer.referred_by as string,
      p_referred: payment.user_id,
      p_payment: payment.id,
      p_amount: rewardKop,
      p_card_token: cardToken ?? null,
      p_max_payments: AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL,
    })
    if (error) {
      // Left unprocessed on purpose: the renewal cron retries it tomorrow.
      console.error('billing: referral accrual failed', payment.id, error.message)
      return
    }
    await admin
      .from('referrals')
      .update({ status: 'converted', converted_at: new Date().toISOString() })
      .eq('referred_id', payment.user_id)
      .eq('status', 'pending')
  }

  await admin
    .from('payments')
    .update({ referral_processed_at: new Date().toISOString() })
    .eq('id', payment.id)
}

/**
 * A paid payment was refunded: the referrer's reward is taken back (negative
 * earnings row; the balance may go below zero) and the credit the payer spent
 * on it is returned.
 */
export async function reversePaidSideEffects(
  admin: SupabaseClient,
  payment: PaidPayment
): Promise<void> {
  const { error } = await admin.rpc('reverse_referral_reward', { p_payment: payment.id })
  if (error) console.error('billing: reverse_referral_reward failed', payment.id, error.message)
  const creditUsed = payment.credit_applied_kop ?? 0
  if (creditUsed > 0) {
    const { error: refundError } = await admin.rpc('refund_credit', {
      p_user: payment.user_id,
      p_amount: creditUsed,
    })
    if (refundError) console.error('billing: refund_credit failed', payment.id, refundError.message)
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { getPayments } from '@/lib/payments'
import {
  GALLERY_PLANS,
  GRACE_PERIOD_DAYS,
  isGalleryPlanId,
  isSitePlanId,
  planStorageBytes,
} from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Paid period without auto-renewal → an expiry date on the profile.
 * grace_until doubles as that date — past it, limits lazily behave as free,
 * same as after a canceled subscription.
 */
function paidUntil(period: string, from = new Date()): string {
  const until = new Date(from)
  if (period === 'year') until.setFullYear(until.getFullYear() + 1)
  else until.setMonth(until.getMonth() + 1)
  until.setDate(until.getDate() + GRACE_PERIOD_DAYS)
  return until.toISOString()
}

/** Referral share: 10% of this UAH amount, in kopecks. */
const REFERRAL_RATE = 0.1
function referralRewardKop(amountUah: number): number {
  return Math.round(amountUah * 100 * REFERRAL_RATE)
}

/** Next cron charge: one period from now (no extra grace — that's for expiry). */
function nextChargeAt(period: string): string {
  const next = new Date()
  if (period === 'year') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

/** Monobank probes webHookUrl with a GET before it starts delivering events. */
export function GET() {
  return NextResponse.json({ ok: true })
}

/**
 * Provider server-to-server callback. The payload signature is verified by
 * the provider class; anything unverifiable is dropped with 400.
 *
 * On payment: apply the plan. When the payer saved a card (cardToken in the
 * event), upsert an auto-renewal subscription; renewals (payment rows with
 * subscription_id) advance next_charge_at instead. Without a card token on a
 * non-recurring provider the paid period becomes an expiry date.
 * On failure/cancellation: renewals mark the subscription past_due and start
 * the grace window; canceled gallery subscriptions get the 7-day grace —
 * limits stay until it ends, files are NEVER deleted.
 */
export async function POST(request: NextRequest) {
  const payments = getPayments()
  const admin = createSupabaseAdminClient()
  if (!payments || !admin) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 })
  }

  const rawBody = await request.text().catch(() => null)
  if (!rawBody) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  const event = await payments.parseWebhook(rawBody, headers)
  if (!event) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 })
  }

  const { data: payment } = await admin
    .from('payments')
    .select('id, user_id, plan, period, status, subscription_id, amount, credit_applied_kop')
    .eq('order_id', event.orderId)
    .single()
  if (!payment) {
    return NextResponse.json({ error: 'unknown_order' }, { status: 404 })
  }

  // Terminal states are processed once — providers re-deliver webhooks, and
  // the renewal cron may have already applied a synchronous charge result.
  if (payment.status === 'paid' && event.status === 'paid') {
    return NextResponse.json({ ok: true })
  }

  await admin
    .from('payments')
    .update({ status: event.status, raw: event.raw })
    .eq('id', payment.id)

  const product = isGalleryPlanId(payment.plan)
    ? 'gallery'
    : isSitePlanId(payment.plan)
      ? 'site'
      : null
  if (!product) return NextResponse.json({ ok: true })

  if (event.status === 'paid') {
    // Auto-renewal bookkeeping decides whether the plan needs an expiry date.
    let autoRenews = payments.recurring
    if (payment.subscription_id) {
      // A cron-initiated renewal: push the next charge one period out.
      await admin
        .from('billing_subscriptions')
        .update({ next_charge_at: nextChargeAt(payment.period), status: 'active' })
        .eq('id', payment.subscription_id)
      autoRenews = true
    } else if (event.cardToken) {
      // First checkout with a saved card: start (or replace) the subscription.
      const { error } = await admin.from('billing_subscriptions').upsert(
        {
          user_id: payment.user_id,
          product,
          plan: payment.plan,
          period: payment.period,
          provider: payments.name,
          card_token: event.cardToken,
          next_charge_at: nextChargeAt(payment.period),
          status: 'active',
        },
        { onConflict: 'user_id,product' }
      )
      autoRenews = !error
    }

    if (product === 'gallery') {
      const plan = GALLERY_PLANS[payment.plan as keyof typeof GALLERY_PLANS]
      await admin
        .from('profiles')
        .update({
          plan: plan.id,
          storage_limit_bytes: planStorageBytes(plan),
          grace_until: autoRenews ? null : paidUntil(payment.period),
        })
        .eq('user_id', payment.user_id)
    } else {
      await admin
        .from('profiles')
        .update({ site_plan: payment.plan })
        .eq('user_id', payment.user_id)
    }

    // Deduct any проЯв credit redeemed against this checkout — once (a
    // re-delivered 'paid' webhook returns early above, so this never repeats).
    // Atomic in the DB so it can't race another concurrent charge.
    const creditUsed = (payment.credit_applied_kop as number | undefined) ?? 0
    if (creditUsed > 0) {
      await admin.rpc('consume_credit', { p_user: payment.user_id, p_amount: creditUsed })
    }

    // Referral reward: 10% of EVERY payment a referred photographer makes goes
    // to their referrer — credit for regular referrers, cash for ambassadors.
    // Re-delivered webhooks can't double-accrue: an already-'paid' payment
    // returns early above, and each renewal is its own payment row. The accrual
    // (balance + earnings log) is a single atomic DB call.
    const { data: payerProfile } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('user_id', payment.user_id)
      .single()
    if (payerProfile?.referred_by) {
      const rewardKop = referralRewardKop((payment.amount as number | undefined) ?? 0)
      if (rewardKop > 0) {
        await admin.rpc('accrue_referral_reward', {
          p_referrer: payerProfile.referred_by as string,
          p_referred: payment.user_id,
          p_payment: payment.id,
          p_amount: rewardKop,
        })
      }
      // First payment also flips the referral to 'converted' (fires once).
      await admin
        .from('referrals')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('referred_id', payment.user_id)
        .eq('status', 'pending')
    }
  } else if (event.status === 'failed' && payment.subscription_id) {
    // A renewal charge bounced: stop the cron retries, start the grace
    // window so the user has a week to update the card / re-subscribe.
    await admin
      .from('billing_subscriptions')
      .update({ status: 'past_due' })
      .eq('id', payment.subscription_id)
    if (product === 'gallery') {
      await admin
        .from('profiles')
        .update({
          grace_until: new Date(
            Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000
          ).toISOString(),
        })
        .eq('user_id', payment.user_id)
    } else {
      await admin
        .from('profiles')
        .update({ site_plan: 'site_trial' })
        .eq('user_id', payment.user_id)
    }
  } else if (event.status === 'canceled') {
    if (product === 'gallery') {
      const graceUntil = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000)
      await admin
        .from('profiles')
        .update({ grace_until: graceUntil.toISOString() })
        .eq('user_id', payment.user_id)
    } else {
      await admin
        .from('profiles')
        .update({ site_plan: 'site_trial' })
        .eq('user_id', payment.user_id)
    }
  }

  return NextResponse.json({ ok: true })
}

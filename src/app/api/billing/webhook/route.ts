import { NextResponse, type NextRequest } from 'next/server'
import { getPayments } from '@/lib/payments'
import type { PaymentStatus } from '@/lib/payments/PaymentProvider'
import {
  GALLERY_PLANS,
  GRACE_PERIOD_DAYS,
  isGalleryPlanId,
  isSitePlanId,
  planStorageBytes,
} from '@/lib/plans'
import { applyPaidSideEffects, reversePaidSideEffects } from '@/lib/billing/paid'
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

/**
 * Which stored statuses each incoming status may replace. 'paid' is final
 * except for a refund (reversed → canceled); a failed/canceled payment is never
 * reopened by a late processing/hold event.
 */
const ALLOWED_FROM: Record<PaymentStatus, readonly string[]> = {
  paid: ['pending', 'failed', 'other'],
  failed: ['pending', 'other'],
  canceled: ['pending', 'failed', 'other', 'paid'],
  pending: ['pending', 'other'],
  other: ['pending', 'other'],
}

/** Next cron charge: one period from now (no extra grace — that's for expiry). */
function nextChargeAt(period: string, from = new Date()): string {
  const next = new Date(from)
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

  const { data: payment, error: lookupError } = await admin
    .from('payments')
    .select(
      'id, user_id, plan, period, status, subscription_id, amount, credit_applied_kop, purpose'
    )
    .eq('order_id', event.orderId)
    .maybeSingle()
  if (lookupError) {
    console.error('billing webhook: payment lookup failed', lookupError.message)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!payment) {
    return NextResponse.json({ error: 'unknown_order' }, { status: 404 })
  }

  // Claim the transition with a conditional update: of two concurrent or
  // re-delivered webhooks only one gets the row back, so side effects below run
  // at most once, and a late processing/hold event can never pull a settled
  // payment back to pending (which would let a re-delivered success apply twice).
  const previousStatus = payment.status as string
  if (!ALLOWED_FROM[event.status].includes(previousStatus)) {
    return NextResponse.json({ ok: true })
  }
  const { data: claimed, error: claimError } = await admin
    .from('payments')
    .update({ status: event.status, raw: event.raw })
    .eq('id', payment.id)
    .eq('status', previousStatus)
    .select('id')
  if (claimError) {
    console.error('billing webhook: status update failed', claimError.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const product = isGalleryPlanId(payment.plan)
    ? 'gallery'
    : isSitePlanId(payment.plan)
      ? 'site'
      : null
  if (!product) return NextResponse.json({ ok: true })

  if (event.status === 'paid') {
    // Applying the plan failed: release the claim and answer 500 so the
    // provider re-delivers — the payer must never end up charged without a plan.
    const retryLater = async (step: string, message: string) => {
      console.error(`billing webhook: ${step} failed for payment ${payment.id}:`, message)
      await admin
        .from('payments')
        .update({ status: previousStatus })
        .eq('id', payment.id)
        .eq('status', 'paid')
      return NextResponse.json({ error: 'apply_failed' }, { status: 500 })
    }

    // «Підключити автоплатіж» in the import promo month: this payment covers
    // the month AFTER the free one, so every period below starts at the
    // promo's end instead of today (see lib/promo, checkout route).
    let periodStart = new Date()
    if (payment.purpose === 'promo_autopay') {
      const { data: grant, error: grantError } = await admin
        .from('promo_grants')
        .select('ends_at')
        .eq('user_id', payment.user_id)
        .maybeSingle()
      if (grantError) return retryLater('promo grant lookup', grantError.message)
      if (grant?.ends_at && new Date(grant.ends_at).getTime() > periodStart.getTime()) {
        periodStart = new Date(grant.ends_at)
      }
      const { error: autopayError } = await admin
        .from('promo_grants')
        .update({ autopay_at: new Date().toISOString() })
        .eq('user_id', payment.user_id)
      if (autopayError) return retryLater('promo autopay mark', autopayError.message)
    }

    // Auto-renewal bookkeeping decides whether the plan needs an expiry date.
    let autoRenews = payments.recurring
    if (payment.subscription_id) {
      // A cron-initiated renewal: push the next charge one period out.
      const { error } = await admin
        .from('billing_subscriptions')
        .update({ next_charge_at: nextChargeAt(payment.period), status: 'active' })
        .eq('id', payment.subscription_id)
      if (error) return retryLater('subscription advance', error.message)
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
          next_charge_at: nextChargeAt(payment.period, periodStart),
          status: 'active',
        },
        { onConflict: 'user_id,product' }
      )
      if (error) {
        // The plan still applies, just as a fixed paid period without renewal.
        console.error('billing webhook: subscription upsert failed', error.message)
      }
      autoRenews = !error
    }

    if (product === 'gallery') {
      const plan = GALLERY_PLANS[payment.plan as keyof typeof GALLERY_PLANS]
      const { error } = await admin
        .from('profiles')
        .update({
          plan: plan.id,
          storage_limit_bytes: planStorageBytes(plan),
          grace_until: autoRenews ? null : paidUntil(payment.period, periodStart),
        })
        .eq('user_id', payment.user_id)
      if (error) return retryLater('plan update', error.message)
    } else {
      const { error } = await admin
        .from('profiles')
        .update({ site_plan: payment.plan })
        .eq('user_id', payment.user_id)
      if (error) return retryLater('site plan update', error.message)
    }

    // The plan is applied; from here on failures are logged, not retried —
    // a re-delivery would find the payment already 'paid' and stop at the claim.
    // Credit consumption + referral reward + 'converted' (lib/billing/paid).
    await applyPaidSideEffects(admin, payment, { cardToken: event.cardToken })
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
    // A refund of a settled payment takes the referral reward back and returns
    // the credit the payer spent on it.
    if (previousStatus === 'paid') await reversePaidSideEffects(admin, payment)
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

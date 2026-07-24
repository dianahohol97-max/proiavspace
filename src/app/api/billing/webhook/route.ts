import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
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

/** Bank one referral free month for a user (applied at their next renewal). */
async function addFreeMonth(admin: SupabaseClient, userId: string): Promise<void> {
  const { data } = await admin
    .from('profiles')
    .select('pending_free_months')
    .eq('user_id', userId)
    .single()
  const current = (data?.pending_free_months as number | undefined) ?? 0
  await admin.from('profiles').update({ pending_free_months: current + 1 }).eq('user_id', userId)
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
    .select('id, user_id, plan, period, status, subscription_id')
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

    // Referral: this payer's FIRST payment converts their referral (the
    // conditional update fires once) and banks a free month for both sides,
    // applied automatically at each one's next renewal.
    const { data: converted } = await admin
      .from('referrals')
      .update({ status: 'converted', converted_at: new Date().toISOString() })
      .eq('referred_id', payment.user_id)
      .eq('status', 'pending')
      .select('referrer_id')
      .maybeSingle()
    if (converted?.referrer_id) {
      await addFreeMonth(admin, converted.referrer_id)
      await addFreeMonth(admin, payment.user_id)
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

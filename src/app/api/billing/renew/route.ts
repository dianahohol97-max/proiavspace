import { NextResponse, type NextRequest } from 'next/server'
import { canChargeTokens, getPayments } from '@/lib/payments'
import {
  BUNDLE_SITE_DISCOUNT,
  GALLERY_PLANS,
  GRACE_PERIOD_DAYS,
  SITE_PLANS,
  galleryPlanPriceUah,
  isBillingPeriod,
  isGalleryPlanId,
  isSitePlanId,
  planStorageBytes,
  sitePlanPriceUah,
} from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

interface SubscriptionRow {
  id: string
  user_id: string
  product: 'gallery' | 'site'
  plan: string
  period: string
  provider: string
  card_token: string
  next_charge_at: string
  status: string
}

function nextChargeAt(period: string): string {
  const next = new Date()
  if (period === 'year') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

/**
 * Daily renewal sweep (Vercel Cron, see vercel.json). Charges saved cards
 * for subscriptions whose paid period ran out, and downgrades subscriptions
 * the user canceled once their paid period ends. Protected by CRON_SECRET —
 * Vercel sends it as a Bearer token on cron invocations.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 })
  }

  // Site-trial enforcement runs every day regardless of whether an acquiring
  // provider is connected: trials older than 30 days (still on site_trial) are
  // turned back into drafts. Best-effort — never blocks the billing sweep.
  let expiredSites = 0
  try {
    const { data } = await admin.rpc('expire_trial_sites')
    expiredSites = typeof data === 'number' ? data : 0
  } catch {
    // ignore — the read-time guard in get_site already hides expired trials
  }

  const payments = getPayments()
  if (!payments) {
    return NextResponse.json({ expiredSites, charges: 'billing_not_configured' })
  }

  const nowIso = new Date().toISOString()
  let renewed = 0
  let failed = 0
  let swept = 0

  // 1. Canceled subscriptions whose paid period is over: finish the downgrade
  //    (gallery grace_until was set at cancel time) and drop the row.
  const { data: endedSubs } = await admin
    .from('billing_subscriptions')
    .select('id, user_id, product, card_token')
    .eq('status', 'canceled')
    .lte('next_charge_at', nowIso)
    .limit(50)
  for (const sub of (endedSubs ?? []) as Pick<
    SubscriptionRow,
    'id' | 'user_id' | 'product' | 'card_token'
  >[]) {
    if (sub.product === 'site') {
      await admin
        .from('profiles')
        .update({ site_plan: 'site_trial' })
        .eq('user_id', sub.user_id)
    }
    if (canChargeTokens(payments)) {
      await payments.deleteToken(sub.card_token).catch(() => undefined)
    }
    await admin.from('billing_subscriptions').delete().eq('id', sub.id)
    swept += 1
  }

  // 2. Active subscriptions that are due: charge the saved card.
  if (!canChargeTokens(payments)) {
    return NextResponse.json({ renewed, failed, swept, expiredSites, charges: 'unsupported' })
  }

  const { data: dueSubs } = await admin
    .from('billing_subscriptions')
    .select(
      'id, user_id, product, plan, period, provider, card_token, next_charge_at, status'
    )
    .eq('status', 'active')
    .eq('provider', payments.name)
    .lte('next_charge_at', nowIso)
    .limit(25)

  // Same fallback as the checkout route — without it a missing env var yields
  // a "undefined/api/billing/webhook" URL, so async (3DS) charges never get
  // their callback and the subscription silently stalls behind the pending guard.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  for (const sub of (dueSubs ?? []) as SubscriptionRow[]) {
    if (!isBillingPeriod(sub.period)) continue

    // Backstop against double charges: skip when a renewal attempt from the
    // last 48h is still waiting for its webhook.
    const { data: pendingPayment } = await admin
      .from('payments')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
      .limit(1)
      .maybeSingle()
    if (pendingPayment) continue

    // Referral reward: if the user has a free month banked (from referring or
    // being referred), burn one instead of charging this cycle — push the next
    // charge out a period and move on.
    const { data: freeProfile } = await admin
      .from('profiles')
      .select('pending_free_months')
      .eq('user_id', sub.user_id)
      .single()
    const freeMonths = freeProfile?.pending_free_months ?? 0
    if (freeMonths > 0) {
      await admin
        .from('billing_subscriptions')
        .update({ next_charge_at: nextChargeAt(sub.period), status: 'active' })
        .eq('id', sub.id)
      await admin
        .from('profiles')
        .update({ pending_free_months: freeMonths - 1 })
        .eq('user_id', sub.user_id)
      continue
    }

    // Price is recomputed at charge time, mirroring the checkout route
    // (including the gallery+site bundle discount).
    let amount: number
    let description: string
    if (isGalleryPlanId(sub.plan) && sub.plan !== 'free') {
      const plan = GALLERY_PLANS[sub.plan]
      amount = galleryPlanPriceUah(plan, sub.period)
      description = `Renewal: gallery plan "${plan.id}", per ${sub.period}`
    } else if (isSitePlanId(sub.plan) && sub.plan !== 'site_trial') {
      const plan = SITE_PLANS[sub.plan]
      amount = sitePlanPriceUah(plan, sub.period)
      description = `Renewal: site plan "${plan.id}", per ${sub.period}`
      const { data: profile } = await admin
        .from('profiles')
        .select('plan, grace_until')
        .eq('user_id', sub.user_id)
        .single()
      const paidGallery =
        profile &&
        isGalleryPlanId(profile.plan) &&
        profile.plan !== 'free' &&
        (!profile.grace_until ||
          new Date(profile.grace_until).getTime() > Date.now())
      if (paidGallery) {
        amount = Math.round(amount * (1 - BUNDLE_SITE_DISCOUNT))
        description += ' (bundle -15%)'
      }
    } else {
      continue
    }

    const orderId = crypto.randomUUID()
    const { error: insertError } = await admin.from('payments').insert({
      user_id: sub.user_id,
      provider: payments.name,
      order_id: orderId,
      plan: sub.plan,
      period: sub.period,
      amount,
      currency: 'UAH',
      status: 'pending',
      subscription_id: sub.id,
    })
    if (insertError) continue

    let status: 'paid' | 'failed' | 'pending'
    try {
      status = (await payments.chargeToken({
        cardToken: sub.card_token,
        orderId,
        amount,
        description,
        serverUrl: `${appUrl}/api/billing/webhook`,
      })) as 'paid' | 'failed' | 'pending'
    } catch {
      // Transient provider/network error: leave the subscription active so
      // tomorrow's run retries; the pending payment row blocks doubles.
      await admin
        .from('payments')
        .update({ status: 'failed' })
        .eq('order_id', orderId)
      continue
    }

    if (status === 'paid') {
      // Synchronous success: apply everything now; the webhook (if any)
      // no-ops thanks to the paid/paid dedupe.
      await admin.from('payments').update({ status: 'paid' }).eq('order_id', orderId)
      await admin
        .from('billing_subscriptions')
        .update({ next_charge_at: nextChargeAt(sub.period), status: 'active' })
        .eq('id', sub.id)
      if (sub.product === 'gallery' && isGalleryPlanId(sub.plan)) {
        const plan = GALLERY_PLANS[sub.plan]
        await admin
          .from('profiles')
          .update({
            plan: plan.id,
            storage_limit_bytes: planStorageBytes(plan),
            grace_until: null,
          })
          .eq('user_id', sub.user_id)
      }
      renewed += 1
    } else if (status === 'failed') {
      await admin
        .from('payments')
        .update({ status: 'failed' })
        .eq('order_id', orderId)
      await admin
        .from('billing_subscriptions')
        .update({ status: 'past_due' })
        .eq('id', sub.id)
      if (sub.product === 'gallery') {
        await admin
          .from('profiles')
          .update({
            grace_until: new Date(
              Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000
            ).toISOString(),
          })
          .eq('user_id', sub.user_id)
      } else {
        await admin
          .from('profiles')
          .update({ site_plan: 'site_trial' })
          .eq('user_id', sub.user_id)
      }
      failed += 1
    }
    // 'pending' — the webhook finishes the job.
  }

  return NextResponse.json({ renewed, failed, swept, expiredSites })
}

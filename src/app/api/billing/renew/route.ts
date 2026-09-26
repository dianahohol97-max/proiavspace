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
import { IMPORT_PROMO } from '@/lib/promo'
import { sendEmail } from '@/lib/email'
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

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>

/** A renewal charge went through: advance the subscription, keep the plan. */
async function applyRenewalPaid(admin: AdminClient, sub: SubscriptionRow): Promise<void> {
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
}

/** A renewal charge bounced: past_due + the grace window (sites drop to trial). */
async function applyRenewalFailed(admin: AdminClient, sub: SubscriptionRow): Promise<void> {
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

  // Import promo: one reminder 7 days before the free month ends, to anyone
  // who hasn't connected auto-payment. Independent of the payment provider.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  let promoReminders = 0
  try {
    promoReminders = await sendPromoReminders(admin, appUrl)
  } catch {
    // Best-effort; tomorrow's run retries whatever wasn't marked as sent.
  }

  const payments = getPayments()
  if (!payments) {
    return NextResponse.json({
      expiredSites,
      promoReminders,
      charges: 'billing_not_configured',
    })
  }

  const nowIso = new Date().toISOString()
  let renewed = 0
  let failed = 0
  let swept = 0
  let stuck = 0

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
    return NextResponse.json({
      renewed,
      failed,
      swept,
      expiredSites,
      promoReminders,
      charges: 'unsupported',
    })
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

  // appUrl (above) uses the same fallback as the checkout route — without it a
  // missing env var yields a "undefined/api/billing/webhook" URL, so async
  // (3DS) charges never get their callback and the subscription silently
  // stalls behind the pending guard.
  for (const sub of (dueSubs ?? []) as SubscriptionRow[]) {
    if (!isBillingPeriod(sub.period)) continue

    // Backstop against double charges: while an earlier renewal attempt is
    // still pending (no webhook yet, or the charge call threw mid-flight) the
    // card is never charged again. The provider is asked what happened to it;
    // only a definite answer resolves it — anything else stays blocked and is
    // logged for a manual check, because charging again could charge twice.
    const { data: pendingPayment, error: pendingError } = await admin
      .from('payments')
      .select('id, order_id, created_at')
      .eq('subscription_id', sub.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (pendingError) {
      console.error('billing renew: pending lookup failed', sub.id, pendingError.message)
      continue
    }
    if (pendingPayment) {
      const outcome = payments.lookupCharge
        ? await payments
            .lookupCharge(pendingPayment.order_id, pendingPayment.created_at)
            .catch((cause: unknown) => {
              console.error('billing renew: charge lookup failed', pendingPayment.order_id, cause)
              return 'unknown' as const
            })
        : 'unknown'
      let settled = false
      if (outcome === 'paid' || outcome === 'failed') {
        const { data } = await admin
          .from('payments')
          .update({ status: outcome })
          .eq('id', pendingPayment.id)
          .eq('status', 'pending')
          .select('id')
        settled = !!data?.length
      }
      if (outcome === 'paid' && settled) {
        await applyRenewalPaid(admin, sub)
        renewed += 1
      } else if (outcome === 'failed' && settled) {
        await applyRenewalFailed(admin, sub)
        failed += 1
      } else {
        if (Date.now() - new Date(pendingPayment.created_at).getTime() > 48 * 3600 * 1000) {
          console.error(
            'billing renew: renewal payment unresolved for 48h+, check it in the Monobank cabinet',
            pendingPayment.order_id
          )
        }
        stuck += 1
      }
      continue
    }

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
    } catch (cause) {
      // The provider may have accepted the charge before the error (timeout,
      // dropped connection), so this is NOT a failure: the row stays pending,
      // which blocks another charge until the webhook or the lookup above
      // settles it.
      console.error('billing renew: charge call failed, left pending', orderId, cause)
      stuck += 1
      continue
    }

    if (status === 'paid') {
      // Synchronous success: apply everything now; the webhook (if any)
      // no-ops because the payment is already 'paid'.
      await admin.from('payments').update({ status: 'paid' }).eq('order_id', orderId)
      await applyRenewalPaid(admin, sub)
      renewed += 1
    } else if (status === 'failed') {
      await admin
        .from('payments')
        .update({ status: 'failed' })
        .eq('order_id', orderId)
      await applyRenewalFailed(admin, sub)
      failed += 1
    }
    // 'pending' — the webhook finishes the job.
  }

  return NextResponse.json({ renewed, failed, swept, stuck, expiredSites, promoReminders })
}

/**
 * «Промо закінчується за 7 днів» — sent once per grant (reminder_sent_at), only
 * while auto-payment isn't connected. Accounts that meanwhile bought a plan
 * with auto-renewal are marked as done without an email.
 */
async function sendPromoReminders(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  appUrl: string
): Promise<number> {
  // Email not configured: send nothing and mark nothing, so reminders still go
  // out once it is (if the promo hasn't ended by then).
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('promo reminders skipped: RESEND_API_KEY/EMAIL_FROM not set')
    return 0
  }
  const now = Date.now()
  const { data: due } = await admin
    .from('promo_grants')
    .select('user_id, ends_at')
    .is('reminder_sent_at', null)
    .is('autopay_at', null)
    .gt('ends_at', new Date(now).toISOString())
    .lte('ends_at', new Date(now + IMPORT_PROMO.reminderDaysBefore * 24 * 3600 * 1000).toISOString())
    .limit(50)

  let sent = 0
  for (const grant of (due ?? []) as { user_id: string; ends_at: string }[]) {
    const { data: activeSub } = await admin
      .from('billing_subscriptions')
      .select('id')
      .eq('user_id', grant.user_id)
      .eq('product', 'gallery')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!activeSub) {
      const [{ data: account }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(grant.user_id),
        admin.from('profiles').select('locale').eq('user_id', grant.user_id).single(),
      ])
      const email = account?.user?.email
      if (email) {
        const en = profile?.locale === 'en'
        const locale = en ? 'en' : 'uk'
        const date = new Date(grant.ends_at).toLocaleDateString(en ? 'en-GB' : 'uk-UA', {
          timeZone: 'Europe/Kyiv',
        })
        const price = IMPORT_PROMO.plan.priceUahMonth
        const link = `${appUrl}/${locale}/dashboard/billing`
        const delivered = await sendEmail(
          en
            ? {
                to: email,
                subject: `Your free «Basic» month ends on ${date}`,
                text: [
                  `Hi! The free month of the «Basic» plan you got for importing a gallery ends on ${date}.`,
                  '',
                  `To keep «Basic» (${IMPORT_PROMO.plan.storageGb} GB, ${price} UAH/month), connect auto-payment: ${price} UAH is charged now and the paid month starts on ${date}.`,
                  link,
                  '',
                  'Without auto-payment the account returns to the Free plan. Your files are not deleted; new uploads above the free limit pause.',
                  '',
                  '— proiav.space',
                ].join('\n'),
              }
            : {
                to: email,
                subject: `Безкоштовний місяць «Базового» закінчується ${date}`,
                text: [
                  `Привіт! Безкоштовний місяць тарифу «Базовий» за імпорт галереї закінчується ${date}.`,
                  '',
                  `Щоб лишитися на «Базовому» (${IMPORT_PROMO.plan.storageGb} ГБ, ${price} ₴/міс), підключи автоплатіж: ${price} ₴ спишемо зараз, а оплачений місяць почнеться ${date}.`,
                  link,
                  '',
                  'Без автоплатежу акаунт повернеться на Безкоштовний тариф. Файли не видаляються — лише нові завантаження понад безкоштовний ліміт стануть на паузу.',
                  '',
                  '— проЯв',
                ].join('\n'),
              }
        )
        // Not delivered (Resend down): leave it unmarked, tomorrow retries.
        if (!delivered) continue
        sent += 1
      }
    }

    await admin
      .from('promo_grants')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('user_id', grant.user_id)
  }
  return sent
}

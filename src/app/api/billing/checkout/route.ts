import { NextResponse, type NextRequest } from 'next/server'
import { getPayments, missingPaymentEnv } from '@/lib/payments'
import {
  BUNDLE_SITE_DISCOUNT,
  GALLERY_PLANS,
  SITE_PLANS,
  type BillingPeriod,
  galleryPlanPriceUah,
  isBillingPeriod,
  isGalleryPlanId,
  isSitePlanId,
  sitePlanPriceUah,
} from '@/lib/plans'
import { IMPORT_PROMO, isPromoRunning, type PromoGrant } from '@/lib/promo'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface CheckoutBody {
  plan: string
  period: string
  locale?: string
  /** 'import_autopay': connect auto-payment during the free promo month. */
  promo?: string
}

function isCheckoutBody(value: unknown): value is CheckoutBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.plan === 'string' &&
    typeof v.period === 'string' &&
    (v.locale === undefined || typeof v.locale === 'string') &&
    (v.promo === undefined || v.promo === 'import_autopay')
  )
}

/**
 * Starts an upgrade for either product: gallery storage tiers or site plans.
 * Records a pending payment row and returns the provider's checkout form.
 * Requires the selected payment provider's keys (MONOBANK_TOKEN in production,
 * or LIQPAY_* with PAYMENT_PROVIDER=liqpay) and SUPABASE_SERVICE_ROLE_KEY —
 * 503 until configured.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!isCheckoutBody(body) || !isBillingPeriod(body.period)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // The promo checkout always buys Базовий per month, whatever was sent.
  const isPromoAutopay = body.promo === 'import_autopay'
  const planId: string = isPromoAutopay ? IMPORT_PROMO.plan.id : body.plan
  const period: BillingPeriod = isPromoAutopay ? 'month' : body.period

  // The destination line is shown to the payer on the monobank/LiqPay page —
  // Ukrainian, branded «проЯв» (the big merchant name above it comes from the
  // acquiring profile and cannot be set via the API).
  const periodUk = body.period === 'year' ? 'оплата за рік' : 'оплата за місяць'
  // «1 ТБ», not «1024 ГБ», on the payment page — same rule as the billing page.
  const storageUk = (gb: number) => (gb >= 1024 ? `${gb / 1024} ТБ` : `${gb} ГБ`)
  const planNameUk: Record<string, string> = {
    basic: 'Базовий',
    plus: 'Плюс',
    pro: 'Максимальний',
    site_basic: 'Сайт Базовий',
    site_plus: 'Сайт Плюс',
  }

  // The import promo's free month (see lib/promo). While it runs, referral
  // credit is not redeemed — the promo and the referral bonus never land in
  // the same month; the credit simply waits for the next payment.
  const { data: promoGrant } = await supabase
    .from('promo_grants')
    .select('ends_at, autopay_at')
    .eq('user_id', user.id)
    .maybeSingle<PromoGrant>()
  const promoRunning = isPromoRunning(promoGrant)

  let amount: number
  let description: string
  let purpose: string | null = null
  if (isPromoAutopay) {
    // «Підключити автоплатіж»: the first Базовий month is paid now, and the
    // paid period starts when the free month ends (the webhook handles that).
    if (!promoGrant || !promoRunning || promoGrant.autopay_at) {
      return NextResponse.json({ error: 'promo_not_active' }, { status: 400 })
    }
    const plan = IMPORT_PROMO.plan
    amount = galleryPlanPriceUah(plan, 'month')
    const startsOn = new Date(promoGrant.ends_at).toLocaleDateString('uk-UA')
    description = `проЯв · тариф «${planNameUk[plan.id]}» (${storageUk(plan.storageGb)}), автоплатіж: перший оплачений місяць з ${startsOn}`
    purpose = 'promo_autopay'
  } else if (isGalleryPlanId(body.plan) && body.plan !== 'free') {
    const plan = GALLERY_PLANS[body.plan]
    amount = galleryPlanPriceUah(plan, body.period)
    description = `проЯв · тариф «${planNameUk[plan.id] ?? plan.id}» (${storageUk(plan.storageGb)}), ${periodUk}`
  } else if (isSitePlanId(body.plan) && body.plan !== 'site_trial') {
    const plan = SITE_PLANS[body.plan]
    amount = sitePlanPriceUah(plan, body.period)
    description = `проЯв · тариф «${planNameUk[plan.id] ?? plan.id}», ${periodUk}`

    // Бандл «Галерея + Сайт»: −15% на сайт при активній платній підписці
    // на галереї (applied automatically, no promo codes).
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, grace_until')
      .eq('user_id', user.id)
      .single()
    const paidGallery =
      profile &&
      isGalleryPlanId(profile.plan) &&
      profile.plan !== 'free' &&
      (!profile.grace_until || new Date(profile.grace_until).getTime() > Date.now())
    if (paidGallery) {
      amount = Math.round(amount * (1 - BUNDLE_SITE_DISCOUNT))
      description += ' (бандл −15%)'
    }
  } else {
    return NextResponse.json({ error: 'plan_needs_no_checkout' }, { status: 400 })
  }

  const payments = getPayments()
  const admin = createSupabaseAdminClient()
  if (!payments || !admin) {
    const missing = [
      ...(!payments ? missingPaymentEnv() : []),
      !admin ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean)
    console.error('billing checkout: not configured, missing:', missing.join(', '))
    return NextResponse.json({ error: 'billing_not_configured', missing }, { status: 503 })
  }

  // A provider that runs its own recurring schedule (LiqPay) would start
  // charging from today, which can't express «paid period starts later».
  if (purpose === 'promo_autopay' && payments.recurring) {
    return NextResponse.json({ error: 'promo_autopay_unsupported' }, { status: 400 })
  }

  const orderId = crypto.randomUUID()
  const locale = body.locale === 'en' ? 'en' : 'uk'

  // The pending row and the проЯв credit reserved against it are created in
  // one locked DB call (create_pending_payment, migration 0044), so two open
  // checkouts can never spend the same credit. The discount leaves at least
  // 1 ₴ to pay; the webhook consumes the applied credit once, on success.
  // During the import promo month credit is not redeemed — the promo and the
  // referral bonus never land in the same month.
  const { data: created, error } = await admin.rpc('create_pending_payment', {
    p_user: user.id,
    p_provider: payments.name,
    p_order_id: orderId,
    p_plan: planId,
    p_period: period,
    p_amount_uah: amount,
    p_purpose: purpose,
    p_subscription: null,
    p_apply_credit: !promoRunning,
  })
  const row = (created as { amount: number; credit_applied_kop: number }[] | null)?.[0]
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'payment_not_created' }, { status: 500 })
  }
  amount = row.amount
  if (row.credit_applied_kop > 0) {
    description += ` (кредит −${row.credit_applied_kop / 100} ₴)`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  try {
    const form = await payments.createCheckoutForm({
      orderId,
      amount,
      currency: 'UAH',
      description,
      period,
      resultUrl: `${appUrl}/${locale}/dashboard/billing`,
      serverUrl: `${appUrl}/api/billing/webhook`,
      language: locale,
      customerId: user.id,
    })
    return NextResponse.json(form)
  } catch (cause) {
    // Monobank creates the invoice via a server call that can fail. No invoice
    // exists, so the attempt is closed as failed rather than left pending forever.
    console.error('billing checkout: provider error', cause)
    await admin.from('payments').update({ status: 'failed' }).eq('order_id', orderId)
    return NextResponse.json({ error: 'provider_error' }, { status: 502 })
  }
}

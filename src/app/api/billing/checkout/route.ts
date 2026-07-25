import { NextResponse, type NextRequest } from 'next/server'
import { getPayments, missingPaymentEnv } from '@/lib/payments'
import {
  BUNDLE_SITE_DISCOUNT,
  GALLERY_PLANS,
  SITE_PLANS,
  galleryPlanPriceUah,
  isBillingPeriod,
  isGalleryPlanId,
  isSitePlanId,
  sitePlanPriceUah,
} from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface CheckoutBody {
  plan: string
  period: string
  locale?: string
}

function isCheckoutBody(value: unknown): value is CheckoutBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.plan === 'string' &&
    typeof v.period === 'string' &&
    (v.locale === undefined || typeof v.locale === 'string')
  )
}

/**
 * Starts an upgrade for either product: gallery storage tiers or site plans.
 * Records a pending payment row and returns the provider's checkout form.
 * Requires LIQPAY_* and SUPABASE_SERVICE_ROLE_KEY env — 503 until configured.
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

  let amount: number
  let description: string
  if (isGalleryPlanId(body.plan) && body.plan !== 'free') {
    const plan = GALLERY_PLANS[body.plan]
    amount = galleryPlanPriceUah(plan, body.period)
    description = `Gallery plan "${plan.id}" (${plan.storageGb} GB), billed per ${body.period}`
  } else if (isSitePlanId(body.plan) && body.plan !== 'site_trial') {
    const plan = SITE_PLANS[body.plan]
    amount = sitePlanPriceUah(plan, body.period)
    description = `Site plan "${plan.id}" (${plan.sites} site(s)), billed per ${body.period}`

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
      description += ' (bundle -15%)'
    }
  } else {
    return NextResponse.json({ error: 'plan_needs_no_checkout' }, { status: 400 })
  }

  // Redeem проЯв credit earned from referrals: it discounts the charge (leaving
  // at least 1 ₴ so there is no zero-amount checkout). The exact applied amount
  // is recorded so the webhook deducts it from the balance once, on success.
  let creditAppliedKop = 0
  {
    const { data: creditProfile } = await supabase
      .from('profiles')
      .select('credit_balance_kop')
      .eq('user_id', user.id)
      .single()
    const creditKop = (creditProfile?.credit_balance_kop as number | undefined) ?? 0
    const maxDiscountUah = Math.max(0, amount - 1)
    const discountUah = Math.min(Math.floor(creditKop / 100), maxDiscountUah)
    if (discountUah > 0) {
      creditAppliedKop = discountUah * 100
      amount -= discountUah
      description += ` (credit -${discountUah} ₴)`
    }
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

  const orderId = crypto.randomUUID()
  const locale = body.locale === 'en' ? 'en' : 'uk'

  const { error } = await admin.from('payments').insert({
    user_id: user.id,
    provider: payments.name,
    order_id: orderId,
    plan: body.plan,
    period: body.period,
    amount,
    currency: 'UAH',
    status: 'pending',
    credit_applied_kop: creditAppliedKop,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  try {
    const form = await payments.createCheckoutForm({
      orderId,
      amount,
      currency: 'UAH',
      description,
      period: body.period,
      resultUrl: `${appUrl}/${locale}/dashboard/billing`,
      serverUrl: `${appUrl}/api/billing/webhook`,
      language: locale,
      customerId: user.id,
    })
    return NextResponse.json(form)
  } catch (cause) {
    // Monobank creates the invoice via a server call that can fail.
    console.error('billing checkout: provider error', cause)
    return NextResponse.json({ error: 'provider_error' }, { status: 502 })
  }
}

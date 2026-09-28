import type { SupabaseClient } from '@supabase/supabase-js'
import {
  GALLERY_PLANS,
  GRACE_PERIOD_DAYS,
  effectiveGalleryPlan,
  galleryPlanPriceUah,
  isBillingPeriod,
  isGalleryPlanId,
  planStorageBytes,
  type GalleryPlanId,
} from '@/lib/plans'

/**
 * «Тариф і оплата» in the dashboard (/dashboard/billing#autopay): what the
 * photographer is on, until when, the auto-renewal state and the last
 * payments. The rules are pure (billingOverview) so the three auto-renewal
 * states are testable without a page; loadBillingOverview reads the rows
 * with the photographer's own client (RLS: own rows only).
 */

const DAY_MS = 24 * 3600 * 1000
export const PAYMENT_HISTORY_LIMIT = 12

export type AutopayState =
  /** Active gallery subscription: the saved card is charged on nextChargeAt. */
  | { kind: 'on'; nextChargeAt: string; amountUah: number }
  /** The last payment went through Google Pay / Apple Pay — no card to save. */
  | { kind: 'wallet'; wallet: 'Google Pay' | 'Apple Pay' }
  /** No auto-renewal (never on, canceled, failed, or on Free). */
  | { kind: 'off'; pastDue: boolean }

export interface PaymentRow {
  created_at: string
  updated_at?: string | null
  amount: number | string
  plan: string
  period: string
  status: string
  provider: string
  subscription_id: string | null
  autopay_consent?: boolean | null
  raw?: unknown
}

export interface SubscriptionRow {
  product: string
  plan: string
  period: string
  status: string
  next_charge_at: string
}

export interface ProfileRow {
  plan: string
  grace_until: string | null
  storage_used_bytes: number
  storage_limit_bytes: number
}

export type PaymentMethod =
  | { kind: 'card'; last4: string | null }
  | { kind: 'google' }
  | { kind: 'apple' }
  | { kind: 'autocharge' }
  | { kind: 'other'; name: string }

export interface HistoryItem {
  date: string
  amountUah: number
  plan: string
  period: string
  method: PaymentMethod
  refunded: boolean
}

export interface BillingOverview {
  planId: GalleryPlanId
  storageLimitBytes: number
  storageUsedBytes: number
  /** «Діє до» for a paid plan; null on Free. */
  validUntil: string | null
  isFree: boolean
  autopay: AutopayState
  partnerUntil: string | null
  history: HistoryItem[]
}

function paymentInfo(raw: unknown): { paymentMethod?: string; maskedPan?: string } {
  const info = (raw as { paymentInfo?: Record<string, unknown> } | null | undefined)?.paymentInfo
  return {
    paymentMethod: typeof info?.paymentMethod === 'string' ? info.paymentMethod : undefined,
    maskedPan: typeof info?.maskedPan === 'string' ? info.maskedPan : undefined,
  }
}

export function paymentMethodOf(row: Pick<PaymentRow, 'raw' | 'subscription_id' | 'provider'>): PaymentMethod {
  const { paymentMethod, maskedPan } = paymentInfo(row.raw)
  if (paymentMethod === 'google') return { kind: 'google' }
  if (paymentMethod === 'apple') return { kind: 'apple' }
  if (row.subscription_id || paymentMethod === 'wallet') return { kind: 'autocharge' }
  if (paymentMethod === 'pan' || paymentMethod === 'monobank' || maskedPan) {
    return { kind: 'card', last4: maskedPan ? maskedPan.slice(-4) : null }
  }
  if (row.provider === 'monobank' || row.provider === 'liqpay') return { kind: 'card', last4: null }
  return { kind: 'other', name: row.provider }
}

export function billingOverview(input: {
  profile: ProfileRow
  subscriptions: SubscriptionRow[]
  /** Newest first. */
  payments: PaymentRow[]
  partnerUntil: string | null
  now?: number
}): BillingOverview {
  const now = input.now ?? Date.now()
  const { profile } = input
  const effective = effectiveGalleryPlan(profile.plan, profile.grace_until)
  const planId = effective.id
  const isFree = planId === 'free'

  const gallerySub = input.subscriptions.find((s) => s.product === 'gallery') ?? null
  const galleryPaid = input.payments.filter(
    (p) => (p.status === 'paid') && isGalleryPlanId(p.plan) && p.plan !== 'free'
  )

  let autopay: AutopayState
  if (gallerySub && gallerySub.status === 'active' && !isFree) {
    const plan = isGalleryPlanId(gallerySub.plan) ? GALLERY_PLANS[gallerySub.plan] : effective
    const period = isBillingPeriod(gallerySub.period) ? gallerySub.period : 'month'
    autopay = { kind: 'on', nextChargeAt: gallerySub.next_charge_at, amountUah: galleryPlanPriceUah(plan, period) }
  } else {
    const last = galleryPaid[0]
    const method = last ? paymentMethodOf(last) : null
    if (!isFree && method && (method.kind === 'google' || method.kind === 'apple')) {
      autopay = { kind: 'wallet', wallet: method.kind === 'google' ? 'Google Pay' : 'Apple Pay' }
    } else {
      autopay = { kind: 'off', pastDue: gallerySub?.status === 'past_due' }
    }
  }

  // «Діє до»: the partner period's end; the next charge with auto-renewal;
  // otherwise the end of the paid period (grace_until carries 14 extra days).
  let validUntil: string | null = null
  if (!isFree) {
    if (input.partnerUntil) validUntil = input.partnerUntil
    else if (autopay.kind === 'on') validUntil = autopay.nextChargeAt
    else if (gallerySub && gallerySub.status === 'canceled') validUntil = gallerySub.next_charge_at
    else if (profile.grace_until) {
      const end = new Date(profile.grace_until).getTime() - GRACE_PERIOD_DAYS * DAY_MS
      validUntil = new Date(end > now ? end : new Date(profile.grace_until).getTime()).toISOString()
    }
  }

  const history: HistoryItem[] = input.payments
    .filter((p) => p.status === 'paid' || p.status === 'canceled')
    .filter((p) => p.status === 'paid' || paymentInfo(p.raw).paymentMethod !== undefined) // refunds of real payments only
    .slice(0, PAYMENT_HISTORY_LIMIT)
    .map((p) => ({
      date: p.created_at,
      amountUah: Number(p.amount),
      plan: p.plan,
      period: p.period,
      method: paymentMethodOf(p),
      refunded: p.status === 'canceled',
    }))

  return {
    planId,
    storageLimitBytes: Math.min(profile.storage_limit_bytes, planStorageBytes(effective)),
    storageUsedBytes: Number(profile.storage_used_bytes),
    validUntil,
    isFree,
    autopay,
    partnerUntil: input.partnerUntil,
    history,
  }
}

/** Reads everything with the photographer's own client (RLS: own rows). */
export async function loadBillingOverview(supabase: SupabaseClient, userId: string): Promise<BillingOverview | null> {
  const [{ data: profile }, { data: subs }, { data: payments }, { data: partnerUntil }] = await Promise.all([
    supabase
      .from('profiles')
      .select('plan, grace_until, storage_used_bytes, storage_limit_bytes')
      .eq('user_id', userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from('billing_subscriptions')
      .select('product, plan, period, status, next_charge_at')
      .eq('user_id', userId)
      .returns<SubscriptionRow[]>(),
    supabase
      .from('payments')
      .select('created_at, amount, plan, period, status, provider, subscription_id, autopay_consent, raw')
      .eq('user_id', userId)
      .in('status', ['paid', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(PAYMENT_HISTORY_LIMIT * 2)
      .returns<PaymentRow[]>(),
    supabase.rpc('my_partner_until'),
  ])
  if (!profile) return null
  return billingOverview({
    profile,
    subscriptions: subs ?? [],
    payments: payments ?? [],
    partnerUntil: typeof partnerUntil === 'string' ? partnerUntil : null,
  })
}

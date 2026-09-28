import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import {
  failedChargeEmail,
  receiptEmail,
  type EmailMessage,
} from '@/lib/lifecycle-emails'
import { GRACE_PERIOD_DAYS } from '@/lib/plans'
import { greetingName } from '@/lib/email-layout'
import type { NoticeKind } from '@/lib/retention'

/**
 * Delivery side of the lifecycle e-mails: who to write to, and the
 * lifecycle_notices journal (migration 0048) that keeps every notice to one
 * per lapse. All best-effort — a failed e-mail never breaks a payment.
 */

export interface Contact {
  email: string
  name: string | null
}

export async function contactOf(admin: SupabaseClient, userId: string): Promise<Contact | null> {
  const [{ data: email }, { data: profile }] = await Promise.all([
    admin.rpc('user_email', { p_user: userId }),
    admin.from('profiles').select('display_name').eq('user_id', userId).maybeSingle(),
  ])
  if (typeof email !== 'string' || !email) return null
  // Never «Привіт, dianahohol97!»: the signup default display_name is the
  // e-mail's local part, which is not a name (lib/email-layout).
  const name = greetingName(profile?.display_name as string | null | undefined, email)
  return { email, name }
}

/** Journal a notice; false when it was already there (someone else sent it). */
export async function recordNotice(
  admin: SupabaseClient,
  userId: string,
  cycle: string,
  kind: NoticeKind
): Promise<boolean> {
  const { data, error } = await admin
    .from('lifecycle_notices')
    .upsert({ user_id: userId, cycle, kind }, { onConflict: 'user_id,cycle,kind', ignoreDuplicates: true })
    .select('kind')
  if (error) throw new Error(`lifecycle_notices: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function send(contact: Contact, message: EmailMessage): Promise<boolean> {
  return sendEmail({ to: contact.email, ...message })
}

/**
 * «Оплата пройшла» after a successful payment (webhook or renewal cron).
 * Reads the payment and the resulting plan state itself.
 */
export async function sendReceipt(admin: SupabaseClient, paymentId: string): Promise<void> {
  const { data: payment } = await admin
    .from('payments')
    .select(
      'user_id, plan, period, amount, credit_applied_kop, provider, order_id, subscription_id, purpose, autopay_consent, raw, updated_at'
    )
    .eq('id', paymentId)
    .maybeSingle()
  if (!payment) return
  const contact = await contactOf(admin, payment.user_id as string)
  if (!contact) return

  const product = String(payment.plan).startsWith('site_') ? 'site' : 'gallery'
  const [{ data: profile }, { data: sub }, { data: promo }] = await Promise.all([
    admin.from('profiles').select('grace_until').eq('user_id', payment.user_id).maybeSingle(),
    admin
      .from('billing_subscriptions')
      .select('next_charge_at, status')
      .eq('user_id', payment.user_id)
      .eq('product', product)
      .maybeSingle(),
    admin.from('promo_grants').select('ends_at').eq('user_id', payment.user_id).maybeSingle(),
  ])

  const autopay = sub?.status === 'active' && sub.next_charge_at ? new Date(sub.next_charge_at) : null
  const periodStart =
    payment.purpose === 'promo_autopay' && promo?.ends_at ? new Date(promo.ends_at) : new Date()
  const periodEnd = autopay
    ? autopay
    : profile?.grace_until
      ? new Date(new Date(profile.grace_until).getTime() - GRACE_PERIOD_DAYS * 24 * 3600 * 1000)
      : (() => {
          const end = new Date(periodStart)
          if (payment.period === 'year') end.setFullYear(end.getFullYear() + 1)
          else end.setMonth(end.getMonth() + 1)
          return end
        })()
  const amountUah = Number(payment.amount)

  await send(
    contact,
    receiptEmail({
      name: contact.name,
      plan: payment.plan as string,
      period: payment.period === 'year' ? 'year' : 'month',
      periodStart,
      periodEnd,
      amountUah,
      creditUah: ((payment.credit_applied_kop as number | null) ?? 0) / 100,
      provider: payment.provider as string,
      orderId: payment.order_id as string,
      nextChargeAt: autopay,
      nextChargeUah: autopay ? amountUah + ((payment.credit_applied_kop as number | null) ?? 0) / 100 : null,
      paidAt: payment.updated_at ? new Date(payment.updated_at as string) : new Date(),
      autopayConsent: payment.autopay_consent === true,
      paymentMethod: paymentMethodOf(payment.raw),
    })
  ).catch((cause: unknown) => console.error('receipt e-mail failed', paymentId, cause))
}

/**
 * «Не вдалося списати» after a bounced auto-renewal. Journals the notice as
 * the lapse's first letter, so the retention cron does not also send
 * «тариф закінчився» for the same lapse.
 */
export async function sendFailedCharge(
  admin: SupabaseClient,
  input: { userId: string; plan: string; amountUah: number; graceUntil: string }
): Promise<void> {
  try {
    const fresh = await recordNotice(admin, input.userId, input.graceUntil, 'failed_charge')
    if (!fresh) return
    const contact = await contactOf(admin, input.userId)
    if (!contact) return
    await send(
      contact,
      failedChargeEmail({
        name: contact.name,
        plan: input.plan,
        amountUah: input.amountUah,
        graceUntil: new Date(input.graceUntil),
      })
    )
  } catch (cause) {
    console.error('failed-charge e-mail failed', input.userId, cause)
  }
}

/** The provider's payment method from the stored webhook payload (Monobank). */
function paymentMethodOf(raw: unknown): string | null {
  const info = (raw as { paymentInfo?: { paymentMethod?: unknown } } | null)?.paymentInfo
  return typeof info?.paymentMethod === 'string' ? info.paymentMethod : null
}

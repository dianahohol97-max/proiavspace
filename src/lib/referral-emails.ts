import type { SupabaseClient } from '@supabase/supabase-js'
import { adminEmails } from '@/lib/admin'
import { sendEmail } from '@/lib/email'
import { greetingName } from '@/lib/email-layout'
import { emailCopy, emailLocale, emailMoney } from '@/lib/emails'
import type { Locale } from '@/lib/i18n/config'
import { AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL } from '@/lib/referrals'

/**
 * Referral notifications via Brevo (best-effort: a failed send is logged and
 * never breaks the payment or the withdrawal). Texts approved 26.09.2026;
 * «ви», matching the referral page and the landing. Amounts are formatted
 * the way the dashboard shows them (12,90 ₴ / 250 ₴).
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'

export function formatUah(kop: number): string {
  const value = Math.abs(kop) / 100
  const text = value % 1 === 0 ? value.toFixed(0) : value.toFixed(2).replace('.', ',')
  return `${kop < 0 ? '−' : ''}${text} ₴`
}

export interface RewardEmailInput {
  to: string
  /** The referrer's language (profiles.locale); any of the 9. */
  locale: Locale
  /** Real name from the profile, or null (never the e-mail's local part). */
  name?: string | null
  amountKop: number
  isAmbassador: boolean
  /** The referred photographer's first payment (the referral just converted). */
  first: boolean
}

export function rewardEmail(input: RewardEmailInput): { subject: string; text: string; locale: Locale } {
  const locale = emailLocale(input.locale)
  const copy = emailCopy(locale)
  const letter = copy.referralReward({
    greeting: copy.hello(input.name ?? null),
    // uk keeps the approved «12,90 ₴»; the rest — Intl money in their language.
    sum: locale === 'uk' ? formatUah(input.amountKop) : emailMoney(input.amountKop / 100, locale),
    isAmbassador: input.isAmbassador,
    first: input.first,
    cap: AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL,
    minWithdrawal: emailMoney(200, locale),
    link: `${APP_URL()}/${locale}/dashboard/referrals`,
  })
  return { subject: letter.subject, text: letter.lines.join('\n'), locale }
}

/** The referrer's e-mail + locale, through the service role (no GoTrue call). */
async function referrerContact(
  admin: SupabaseClient,
  userId: string
): Promise<{ email: string; locale: Locale; name: string | null } | null> {
  const [{ data: email }, { data: profile }] = await Promise.all([
    admin.rpc('user_email', { p_user: userId }),
    admin.from('profiles').select('locale, display_name').eq('user_id', userId).maybeSingle(),
  ])
  if (typeof email !== 'string' || !email) return null
  return {
    email,
    locale: emailLocale(profile?.locale),
    name: greetingName(profile?.display_name as string | null | undefined, email),
  }
}

export async function sendRewardEmail(
  admin: SupabaseClient,
  input: { referrerId: string; amountKop: number; isAmbassador: boolean; first: boolean }
): Promise<boolean> {
  const contact = await referrerContact(admin, input.referrerId)
  if (!contact) return false
  return sendEmail({
    to: contact.email,
    ...rewardEmail({ to: contact.email, locale: contact.locale, name: contact.name, ...input }),
  })
}

/**
 * Payout details as shown in the e-mail: only the kind and the last 4
 * characters. The full details stay in the dashboard.
 */
export function maskPayoutDetails(details: string): string {
  const compact = details.replace(/\s+/g, '')
  const kind = /^UA\d{27}$/i.test(compact)
    ? 'IBAN'
    : /^\d{16,19}$/.test(compact)
      ? 'картка'
      : 'реквізити'
  const tail = compact.slice(-4)
  return `${kind}, ****${tail}`
}

export interface WithdrawalEmailInput {
  name: string
  email: string
  amountKop: number
  details: string
}

export function withdrawalEmail(input: WithdrawalEmailInput): { subject: string; text: string } {
  const sum = formatUah(input.amountKop)
  return {
    subject: `Заявка на виведення: ${sum} — ${input.name}`,
    text: [
      `Амбасадор ${input.name} (${input.email}) просить виплатити ${sum}.`,
      `Реквізити: ${maskPayoutDetails(input.details)}.`,
      '',
      `Обробити: ${APP_URL()}/uk/dashboard/stats`,
    ].join('\n'),
  }
}

export async function sendWithdrawalEmail(input: WithdrawalEmailInput): Promise<boolean> {
  const message = withdrawalEmail(input)
  const results = await Promise.all(adminEmails().map((to) => sendEmail({ to, ...message })))
  return results.some(Boolean)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { adminEmails } from '@/lib/admin'
import { sendEmail } from '@/lib/email'
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
  locale: 'uk' | 'en'
  amountKop: number
  isAmbassador: boolean
  /** The referred photographer's first payment (the referral just converted). */
  first: boolean
}

export function rewardEmail(input: RewardEmailInput): { subject: string; text: string } {
  const sum = formatUah(input.amountKop)
  const link = `${APP_URL()}/${input.locale}/dashboard/referrals`
  const cap = AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL

  if (input.locale === 'en') {
    const what = input.isAmbassador ? 'referral reward' : 'referral credit'
    return {
      subject: `+${sum} — your ${input.first ? `first ${what}` : what}`,
      text: [
        `Hi! A photographer who came through your link has just ${input.first ? 'taken a paid plan' : 'paid for their plan again'}.`,
        input.isAmbassador
          ? `You've earned ${sum} to withdraw — 10% of their payment. The same for each of their first ${cap} payments.`
          : `You've earned ${sum} in credit — 10% of their payment. And so with every payment they make.`,
        input.isAmbassador
          ? `Withdraw from 200 ₴ in your dashboard: ${link}`
          : `The credit is applied to your next invoice automatically. Balance and link: ${link}`,
        '',
        'Thank you for recommending us to colleagues.',
        '',
        '— proiav.space',
      ].join('\n'),
    }
  }

  const what = input.isAmbassador ? 'реферальна винагорода' : 'реферальний кредит'
  return {
    subject: input.first
      ? `+${sum} — ${input.isAmbassador ? 'ваша перша' : 'ваш перший'} ${what}`
      : `+${sum} — ${what}`,
    text: [
      `Привіт! Фотограф, який прийшов за вашим посиланням, щойно ${input.first ? 'оформив платний тариф' : 'оплатив свій тариф знову'}.`,
      input.isAmbassador
        ? `Вам нараховано ${sum} до виплати — 10% від його оплати. І так з кожної з перших ${cap} його оплат.`
        : `Вам нараховано ${sum} кредитом — 10% від його оплати. І так буде з кожної його наступної оплати.`,
      input.isAmbassador
        ? `Вивести можна від 200 ₴ у кабінеті: ${link}`
        : `Кредит спишеться автоматично з вашого наступного рахунку. Баланс і посилання — у кабінеті: ${link}`,
      '',
      'Дякуємо, що радите нас колегам.',
      '',
      '— проЯв',
    ].join('\n'),
  }
}

/** The referrer's e-mail + locale, through the service role (no GoTrue call). */
async function referrerContact(
  admin: SupabaseClient,
  userId: string
): Promise<{ email: string; locale: 'uk' | 'en' } | null> {
  const [{ data: email }, { data: profile }] = await Promise.all([
    admin.rpc('user_email', { p_user: userId }),
    admin.from('profiles').select('locale').eq('user_id', userId).maybeSingle(),
  ])
  if (typeof email !== 'string' || !email) return null
  return { email, locale: profile?.locale === 'en' ? 'en' : 'uk' }
}

export async function sendRewardEmail(
  admin: SupabaseClient,
  input: { referrerId: string; amountKop: number; isAmbassador: boolean; first: boolean }
): Promise<boolean> {
  const contact = await referrerContact(admin, input.referrerId)
  if (!contact) return false
  return sendEmail({
    to: contact.email,
    ...rewardEmail({ to: contact.email, locale: contact.locale, ...input }),
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

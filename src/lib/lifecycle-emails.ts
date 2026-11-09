import { GALLERY_PLANS, GRACE_PERIOD_DAYS, SITE_PLANS } from '@/lib/plans'
import { renderHtml, renderText, type EmailDoc } from '@/lib/email-layout'
import { emailCopy, emailDate, emailLocale, emailMoney, emailSize } from '@/lib/emails'
import type { DocLetter, TextLetter } from '@/lib/emails/types'
import type { Locale } from '@/lib/i18n/config'
import { FREE_GALLERY_DAYS, FREE_PURGE_AFTER_DAYS } from '@/lib/free-expiry'
import { RETENTION_DAYS } from '@/lib/retention'

/**
 * Billing and plan-lifecycle e-mails (audit EM-03 / LC-01). Texts approved
 * 26.09.2026 (docs/EMAILS_PR2_DRAFT.md), «ви» like the site. Plain text —
 * lib/email wraps it in the проЯв layout (lib/email-layout); the receipt and
 * the renewal notice are structured (EmailDoc → text + HTML).
 *
 * Every letter is in the photographer's language (profiles.locale, 0072):
 * pass `locale` (default uk). The words are in lib/emails/locales/*.ts; this
 * file decides what goes into a letter and formats the values for its
 * language.
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'
const billingUrl = (locale: Locale) => `${APP_URL()}/${locale}/dashboard/billing`
const dashboardUrl = (locale: Locale) => `${APP_URL()}/${locale}/dashboard`

export interface EmailMessage {
  subject: string
  text: string
  /** Own HTML part; otherwise lib/email wraps the text. */
  html?: string
  /** The letter's language (HTML lang, footer). */
  locale?: Locale
}

/** Every letter input takes the photographer's language; uk by default. */
interface Localized {
  locale?: string
}

function fromDoc(locale: Locale, name: string | null, letter: DocLetter): EmailMessage {
  const { subject, ...rest } = letter
  const doc: EmailDoc = { greeting: emailCopy(locale).hello(name), ...rest }
  return { subject, text: renderText(doc, locale), html: renderHtml(doc, subject, locale), locale }
}

function fromText(locale: Locale, letter: TextLetter): EmailMessage {
  return { subject: letter.subject, text: letter.lines.join('\n'), locale }
}

const PLAN_IDS = ['free', 'basic', 'plus', 'pro', 'site_basic', 'site_plus'] as const

/** «Базовий», «Basic»… — the plan's name in the letter's language. */
export function planName(plan: string, locale: string = 'uk'): string {
  const names = emailCopy(locale).planNames
  return (PLAN_IDS as readonly string[]).includes(plan) ? names[plan as (typeof PLAN_IDS)[number]] : plan
}

/** «100 ГБ», «1 ТБ» — gallery plans only. */
export function planVolume(plan: string, locale: string = 'uk'): string | null {
  const gallery = GALLERY_PLANS[plan as keyof typeof GALLERY_PLANS]
  if (!gallery) return null
  const units = emailCopy(locale).units
  return gallery.storageGb >= 1024 ? `${gallery.storageGb / 1024} ${units.tb}` : `${gallery.storageGb} ${units.gb}`
}

export function kyivDate(date: Date | string, locale: string = 'uk'): string {
  return emailDate(date, locale)
}

export function formatBytes(bytes: number, locale: string = 'uk'): string {
  return emailSize(bytes, locale)
}

/** Ukrainian plural: 1 галерея, 2 галереї, 5 галерей. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const FREE_GB = GALLERY_PLANS.free.storageGb
const days = (n: number) => n * 24 * 3600 * 1000

// ---------------------------------------------------------------------------
// 1. Receipt
// ---------------------------------------------------------------------------
export interface ReceiptInput extends Localized {
  name: string | null
  plan: string
  period: 'month' | 'year'
  /** When the payment went through (default: now). */
  paidAt?: Date
  periodStart: Date
  periodEnd: Date
  amountUah: number
  creditUah: number
  provider: string
  orderId: string
  /** Next auto-charge, when auto-renewal is on. */
  nextChargeAt: Date | null
  nextChargeUah: number | null
  /** The payer ticked «Автопродовження» (payments.autopay_consent). */
  autopayConsent?: boolean
  /** Provider's payment method: 'pan', 'google', 'apple', … */
  paymentMethod?: string | null
}

/** What the plan gives, for the receipt («Що входить»). */
export function planIncludes(plan: string, locale: string = 'uk'): string[] {
  const t = emailCopy(locale).includes
  const gallery = GALLERY_PLANS[plan as keyof typeof GALLERY_PLANS]
  if (gallery) {
    const f = gallery.features
    return [
      t.storage(planVolume(plan, locale) ?? ''),
      t.galleries,
      ...(f.video ? [t.video] : []),
      ...(f.brandingRemoval ? [t.noBranding] : []),
      ...(f.photographerLogo ? [t.logo] : []),
      ...(f.stats ? [t.stats] : []),
      ...(f.prioritySupport ? [t.support] : []),
      t.noExpiry,
    ]
  }
  const site = SITE_PLANS[plan as keyof typeof SITE_PLANS]
  if (site) {
    return [site.sites > 1 ? t.sites(site.sites) : t.site, ...(site.customDomain ? [t.domain] : [])]
  }
  return []
}

const providerName = (p: string) => (p === 'monobank' ? 'Monobank' : p === 'liqpay' ? 'LiqPay' : p)
const walletName = (m: string | null | undefined) =>
  m === 'google' ? 'Google Pay' : m === 'apple' ? 'Apple Pay' : null

export function receiptEmail(input: ReceiptInput): EmailMessage {
  const l = emailLocale(input.locale)
  const date = (d: Date) => kyivDate(d, l)
  return fromDoc(
    l,
    input.name,
    emailCopy(l).receipt({
      plan: planName(input.plan, l),
      volume: planVolume(input.plan, l),
      period: input.period,
      amount: emailMoney(input.amountUah, l),
      credit: input.creditUah > 0 ? emailMoney(input.creditUah, l) : null,
      paidAt: date(input.paidAt ?? new Date()),
      periodStart: date(input.periodStart),
      periodEnd: date(input.periodEnd),
      nextChargeAt: input.nextChargeAt ? date(input.nextChargeAt) : null,
      nextChargeAmount: input.nextChargeAt ? emailMoney(input.nextChargeUah ?? input.amountUah, l) : null,
      wallet: walletName(input.paymentMethod),
      autopayConsent: input.autopayConsent === true,
      graceDays: GRACE_PERIOD_DAYS,
      provider: providerName(input.provider),
      orderId: input.orderId,
      includes: planIncludes(input.plan, l),
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 1b. Auto-renewal in 3 days (sent by the renewal cron)
// ---------------------------------------------------------------------------
export interface RenewalNoticeInput extends Localized {
  name: string | null
  plan: string
  period: 'month' | 'year'
  amountUah: number
  chargeAt: Date
}

export const RENEWAL_NOTICE_DAYS = 3

export function renewalNoticeEmail(input: RenewalNoticeInput): EmailMessage {
  const l = emailLocale(input.locale)
  return fromDoc(
    l,
    input.name,
    emailCopy(l).renewalNotice({
      plan: planName(input.plan, l),
      volume: planVolume(input.plan, l),
      period: input.period,
      amount: emailMoney(input.amountUah, l),
      chargeAt: kyivDate(input.chargeAt, l),
      days: RENEWAL_NOTICE_DAYS,
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 2. Failed charge
// ---------------------------------------------------------------------------
export interface FailedChargeInput extends Localized {
  name: string | null
  plan: string
  amountUah: number
  graceUntil: Date
}

export function failedChargeEmail(input: FailedChargeInput): EmailMessage {
  const l = emailLocale(input.locale)
  const deletesAt = new Date(input.graceUntil.getTime() + days(RETENTION_DAYS))
  return fromText(
    l,
    emailCopy(l).failedCharge({
      greeting: emailCopy(l).hello(input.name),
      plan: planName(input.plan, l),
      volume: planVolume(input.plan, l),
      amount: emailMoney(input.amountUah, l),
      graceUntil: kyivDate(input.graceUntil, l),
      deletesAt: kyivDate(deletesAt, l),
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 3. Plan ended — grace starts
// ---------------------------------------------------------------------------
export interface GraceStartInput extends Localized {
  name: string | null
  plan: string
  /** The import promo month ended, not a paid period. */
  promo: boolean
  endedAt: Date
  closesAt: Date
}

export function graceStartEmail(input: GraceStartInput): EmailMessage {
  const l = emailLocale(input.locale)
  const deletesAt = new Date(input.closesAt.getTime() + days(RETENTION_DAYS))
  return fromText(
    l,
    emailCopy(l).graceStart({
      greeting: emailCopy(l).hello(input.name),
      plan: planName(input.plan, l),
      volume: planVolume(input.plan, l),
      promo: input.promo,
      endedAt: kyivDate(input.endedAt, l),
      closesAt: kyivDate(input.closesAt, l),
      deletesAt: kyivDate(deletesAt, l),
      graceDays: GRACE_PERIOD_DAYS,
      freeGb: FREE_GB,
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 4. Galleries closed to clients
// ---------------------------------------------------------------------------
export interface ClosedInput extends Localized {
  name: string | null
  plan: string
  galleryCount: number
  deletesAt: Date
}

export function closedEmail(input: ClosedInput): EmailMessage {
  const l = emailLocale(input.locale)
  return fromText(
    l,
    emailCopy(l).closed({
      greeting: emailCopy(l).hello(input.name),
      plan: planName(input.plan, l),
      galleryCount: input.galleryCount,
      deletesAt: kyivDate(input.deletesAt, l),
      freeGb: FREE_GB,
      billingUrl: billingUrl(l),
      dashboardUrl: dashboardUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 5. Deletion warnings — 30 / 7 / 1 day
// ---------------------------------------------------------------------------
export interface DeletionWarningInput extends Localized {
  name: string | null
  daysLeft: 30 | 7 | 1
  deletesAt: Date
  galleryCount: number
  fileCount: number
  usedBytes: number
}

export function deletionWarningEmail(input: DeletionWarningInput): EmailMessage {
  const l = emailLocale(input.locale)
  return fromText(
    l,
    emailCopy(l).deletionWarning({
      greeting: emailCopy(l).hello(input.name),
      daysLeft: input.daysLeft,
      deletesAt: kyivDate(input.deletesAt, l),
      galleryCount: input.galleryCount,
      fileCount: input.fileCount,
      size: formatBytes(input.usedBytes, l),
      freeGb: FREE_GB,
      billingUrl: billingUrl(l),
      dashboardUrl: dashboardUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 7. Import promo ends (was on «ти» and promised «файли не видаляються»)
// ---------------------------------------------------------------------------
export interface PromoEndingInput extends Localized {
  name: string | null
  endsAt: Date
  priceUah: number
  storageGb: number
}

export function promoEndingEmail(input: PromoEndingInput): EmailMessage {
  const l = emailLocale(input.locale)
  return fromText(
    l,
    emailCopy(l).promoEnding({
      greeting: emailCopy(l).hello(input.name),
      endsAt: kyivDate(input.endsAt, l),
      price: emailMoney(input.priceUah, l),
      storageGb: input.storageGb,
      graceDays: GRACE_PERIOD_DAYS,
      retentionDays: RETENTION_DAYS,
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 8. Free plan: a gallery closes after 30 days — 7 days / 1 day before
// ---------------------------------------------------------------------------
export interface FreeExpiryInput extends Localized {
  name: string | null
  daysLeft: 7 | 1
  galleries: { title: string; closesAt: Date }[]
}

export function freeExpiryWarningEmail(input: FreeExpiryInput): EmailMessage {
  const l = emailLocale(input.locale)
  const basic = GALLERY_PLANS.basic
  return fromText(
    l,
    emailCopy(l).freeExpiry({
      greeting: emailCopy(l).hello(input.name),
      daysLeft: input.daysLeft,
      galleries: input.galleries.map((g) => ({ title: g.title, closesAt: kyivDate(g.closesAt, l) })),
      freeDays: FREE_GALLERY_DAYS,
      purgeDays: FREE_PURGE_AFTER_DAYS,
      basicPrice: emailMoney(basic.priceUahMonth, l),
      basicGb: basic.storageGb,
      billingUrl: billingUrl(l),
    })
  )
}

// ---------------------------------------------------------------------------
// 9. Partner period ends in 7 days
// ---------------------------------------------------------------------------
export interface PartnerEndingInput extends Localized {
  name: string | null
  plan: string
  endsAt: Date
}

export function partnerEndingEmail(input: PartnerEndingInput): EmailMessage {
  const l = emailLocale(input.locale)
  const plan = GALLERY_PLANS[input.plan as keyof typeof GALLERY_PLANS] ?? GALLERY_PLANS.plus
  return fromText(
    l,
    emailCopy(l).partnerEnding({
      greeting: emailCopy(l).hello(input.name),
      plan: planName(plan.id, l),
      endsAt: kyivDate(input.endsAt, l),
      priceMonth: emailMoney(plan.priceUahMonth, l),
      priceYear: emailMoney(plan.priceUahYear, l),
      basicPrice: emailMoney(GALLERY_PLANS.basic.priceUahMonth, l),
      freeGb: GALLERY_PLANS.free.storageGb,
      freeDays: FREE_GALLERY_DAYS,
      billingUrl: billingUrl(l),
    })
  )
}

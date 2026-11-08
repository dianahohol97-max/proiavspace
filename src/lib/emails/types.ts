/**
 * The words of every проЯв e-mail, one object per language (./locales/*.ts).
 *
 * The letters' logic (who, when, which plan, which dates) lives in
 * lib/lifecycle-emails, lib/gallery/ready-email, lib/referral-emails and the
 * booking route; they format every value for the letter's language first
 * (dates, money, sizes — lib/emails/format) and hand them here, so a language
 * file is only sentences. Same shape in all 9 languages
 * (tests/audit-storage/email-i18n.test.ts).
 *
 * Plain letters return their lines (joined with \n, greeting and signature
 * included); structured ones (receipt, renewal notice, «Ваші фото готові»)
 * return an EmailDoc without the greeting.
 */
import type { EmailDoc } from '@/lib/email-layout'

/** A structured letter: subject + the document body (greeting is added). */
export type DocLetter = { subject: string } & Omit<EmailDoc, 'greeting'>
/** A plain-text letter: subject + its lines. */
export type TextLetter = { subject: string; lines: string[] }

export interface ReceiptVars {
  /** Localized plan name, no quotes («Базовий»). */
  plan: string
  /** «100 ГБ» / «1 TB», gallery plans only. */
  volume: string | null
  period: 'month' | 'year'
  /** Money, formatted («129 ₴»). */
  amount: string
  /** Referral credit used, formatted; null when none. */
  credit: string | null
  paidAt: string
  periodStart: string
  periodEnd: string
  /** Auto-renewal is on: next charge date and amount. */
  nextChargeAt: string | null
  nextChargeAmount: string | null
  /** «Google Pay» / «Apple Pay» when paid with a wallet. */
  wallet: string | null
  /** The payer ticked «Автопродовження». */
  autopayConsent: boolean
  graceDays: number
  /** «Monobank» / «LiqPay». */
  provider: string
  orderId: string
  /** «Що входить» items (from copy.includes). */
  includes: string[]
  billingUrl: string
}

export interface RenewalNoticeVars {
  plan: string
  volume: string | null
  period: 'month' | 'year'
  amount: string
  chargeAt: string
  /** Days before the charge (3). */
  days: number
  billingUrl: string
}

export interface FailedChargeVars {
  greeting: string
  plan: string
  volume: string | null
  amount: string
  graceUntil: string
  deletesAt: string
  billingUrl: string
}

export interface GraceStartVars {
  greeting: string
  plan: string
  volume: string | null
  /** The import promo month ended, not a paid period. */
  promo: boolean
  endedAt: string
  closesAt: string
  deletesAt: string
  graceDays: number
  freeGb: number
  billingUrl: string
}

export interface ClosedVars {
  greeting: string
  plan: string
  galleryCount: number
  deletesAt: string
  freeGb: number
  billingUrl: string
  dashboardUrl: string
}

export interface DeletionWarningVars {
  greeting: string
  daysLeft: 30 | 7 | 1
  deletesAt: string
  galleryCount: number
  fileCount: number
  /** «2,4 ГБ». */
  size: string
  freeGb: number
  billingUrl: string
  dashboardUrl: string
}

export interface PromoEndingVars {
  greeting: string
  endsAt: string
  /** «129 ₴». */
  price: string
  storageGb: number
  graceDays: number
  retentionDays: number
  billingUrl: string
}

export interface FreeExpiryVars {
  greeting: string
  daysLeft: 7 | 1
  galleries: { title: string; closesAt: string }[]
  freeDays: number
  purgeDays: number
  /** «Базовий» price per month, formatted. */
  basicPrice: string
  basicGb: number
  billingUrl: string
}

export interface PartnerEndingVars {
  greeting: string
  plan: string
  endsAt: string
  priceMonth: string
  priceYear: string
  basicPrice: string
  freeGb: number
  freeDays: number
  billingUrl: string
}

export interface ReadyVars {
  galleryTitle: string
  url: string
  photographerName: string | null
  hasPassword: boolean
}

export interface ReferralRewardVars {
  greeting: string
  /** «+12,90 ₴» without the plus. */
  sum: string
  isAmbassador: boolean
  first: boolean
  /** Ambassador: rewards per referral (cap). */
  cap: number
  /** Minimum withdrawal, formatted («200 ₴»). */
  minWithdrawal: string
  link: string
}

export interface BookingNotifyVars {
  /** «20.07.2026 · 14:00». */
  slot: string
  minutes: number
  price: string
  clientName: string
  clientPhone: string
  clientEmail: string
}

export interface EmailCopy {
  /** «Привіт, Олено!» / «Привіт!». */
  hello(name: string | null): string
  /** «Вітаємо!» — to a photographer's client (no name). */
  helloClient: string
  /** Last footer line label: «Питання й рахунок для ФОП». */
  footerQuestions: string
  planNames: {
    free: string
    basic: string
    plus: string
    pro: string
    site_basic: string
    site_plus: string
  }
  /** Size units: МБ / ГБ / ТБ, MB / GB / TB… */
  units: { mb: string; gb: string; tb: string }
  /** «Що входить» lines of the receipt. */
  includes: {
    storage(volume: string): string
    galleries: string
    video: string
    noBranding: string
    logo: string
    stats: string
    support: string
    noExpiry: string
    sites(n: number): string
    site: string
    domain: string
  }
  receipt(v: ReceiptVars): DocLetter
  renewalNotice(v: RenewalNoticeVars): DocLetter
  failedCharge(v: FailedChargeVars): TextLetter
  graceStart(v: GraceStartVars): TextLetter
  closed(v: ClosedVars): TextLetter
  deletionWarning(v: DeletionWarningVars): TextLetter
  promoEnding(v: PromoEndingVars): TextLetter
  freeExpiry(v: FreeExpiryVars): TextLetter
  partnerEnding(v: PartnerEndingVars): TextLetter
  /** «Ваші фото готові» — to the photographer's client. */
  ready(v: ReadyVars): DocLetter
  referralReward(v: ReferralRewardVars): TextLetter
  /** «Нове бронювання» — to the photographer. */
  bookingNotify(v: BookingNotifyVars): TextLetter
}

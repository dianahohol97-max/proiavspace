import { GALLERY_PLANS, GRACE_PERIOD_DAYS, SITE_PLANS } from '@/lib/plans'
import { hello, renderHtml, renderText, type EmailDoc } from '@/lib/email-layout'
import { FREE_GALLERY_DAYS, FREE_PURGE_AFTER_DAYS } from '@/lib/free-expiry'
import { RETENTION_DAYS } from '@/lib/retention'

/**
 * Billing and plan-lifecycle e-mails (audit EM-03 / LC-01). Texts approved
 * 26.09.2026 (docs/EMAILS_PR2_DRAFT.md), «ви» like the site. Plain text —
 * lib/email wraps it in the проЯв layout (lib/email-layout); the receipt and
 * the renewal notice are structured (EmailDoc → text + HTML). Ukrainian only for now: the approved set has
 * no English version yet.
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'
const billingUrl = () => `${APP_URL()}/uk/dashboard/billing`
const dashboardUrl = () => `${APP_URL()}/uk/dashboard`

export interface EmailMessage {
  subject: string
  text: string
  /** Own HTML part; otherwise lib/email wraps the text. */
  html?: string
}

function fromDoc(subject: string, doc: EmailDoc): EmailMessage {
  return { subject, text: renderText(doc), html: renderHtml(doc, subject) }
}

const PLAN_NAMES: Record<string, string> = {
  basic: 'Базовий',
  plus: 'Плюс',
  pro: 'Максимальний',
  site_basic: 'Сайт Базовий',
  site_plus: 'Сайт Плюс',
}

export function planName(plan: string): string {
  return PLAN_NAMES[plan] ?? plan
}

/** «100 ГБ», «1 ТБ» — gallery plans only. */
export function planVolume(plan: string): string | null {
  const gallery = GALLERY_PLANS[plan as keyof typeof GALLERY_PLANS]
  if (!gallery) return null
  return gallery.storageGb >= 1024 ? `${gallery.storageGb / 1024} ТБ` : `${gallery.storageGb} ГБ`
}

export function kyivDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1024) return `${(gb / 1024).toFixed(1).replace('.', ',')} ТБ`
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} ГБ`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} МБ`
}

function uah(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',')
}


/** «Вміститися в безкоштовні 3 ГБ» — the third way out, in letters 3–5. */
const FREE_GB = GALLERY_PLANS.free.storageGb
const fitIntoFree = (then: string) =>
  `Або видаліть зайве в кабінеті, щоб уміститися в безкоштовні ${FREE_GB} ГБ, — тоді нічого не зникне: ${then}`

/** Ukrainian plural: 1 галерея, 2 галереї, 5 галерей. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
const galleries = (n: number) => `${n} ${plural(n, 'галерея', 'галереї', 'галерей')}`
const files = (n: number) => `${n} ${plural(n, 'файл', 'файли', 'файлів')}`

// ---------------------------------------------------------------------------
// 1. Receipt
// ---------------------------------------------------------------------------
export interface ReceiptInput {
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
export function planIncludes(plan: string): string[] {
  const gallery = GALLERY_PLANS[plan as keyof typeof GALLERY_PLANS]
  if (gallery) {
    const f = gallery.features
    return [
      `${planVolume(plan)} сховища для галерей`,
      'Галереї для клієнтів з паролем, вибором фото й завантаженням архівом',
      ...(f.video ? ['Відео в галереях'] : []),
      ...(f.brandingRemoval ? ['Без позначки «проЯв» у галереях'] : []),
      ...(f.photographerLogo ? ['Ваш логотип у галереях'] : []),
      ...(f.stats ? ['Статистика переглядів і завантажень'] : []),
      ...(f.prioritySupport ? ['Пріоритетна підтримка'] : []),
      'Без строку життя галерей, поки діє тариф',
    ]
  }
  const site = SITE_PLANS[plan as keyof typeof SITE_PLANS]
  if (site) {
    return [
      site.sites > 1 ? `${site.sites} сайти-портфоліо` : 'Сайт-портфоліо',
      ...(site.customDomain ? ['Власний домен'] : []),
    ]
  }
  return []
}

const providerName = (p: string) => (p === 'monobank' ? 'Monobank' : p === 'liqpay' ? 'LiqPay' : p)
const walletName = (m: string | null | undefined) =>
  m === 'google' ? 'Google Pay' : m === 'apple' ? 'Apple Pay' : null

export function receiptEmail(input: ReceiptInput): EmailMessage {
  const provider = providerName(input.provider)
  const volume = planVolume(input.plan)
  const wallet = walletName(input.paymentMethod)
  const credit = input.creditUah > 0 ? ` (з них ${uah(input.creditUah)} ₴ — реферальний кредит)` : ''

  let renewal: string
  if (input.nextChargeAt) {
    renewal = `Автопродовження увімкнене: наступне списання ${kyivDate(input.nextChargeAt)}, ${uah(input.nextChargeUah ?? input.amountUah)} ₴. За 3 дні до нього надішлемо нагадування. Скасувати можна будь-коли в кабінеті — оплачений період при цьому діє до кінця.`
  } else if (input.autopayConsent && wallet) {
    renewal = `Автопродовження не підключилося: оплата через ${wallet} не зберігає картку. Тариф діє до ${kyivDate(input.periodEnd)}. Щоб наступного разу продовжувати автоматично — оплатіть карткою з позначкою «Автопродовження».`
  } else {
    renewal = `Автопродовження вимкнене: тариф діє до ${kyivDate(input.periodEnd)}, далі — ще ${GRACE_PERIOD_DAYS} днів повного доступу, а потім акаунт стає безкоштовним.`
  }

  const subject = `Квитанція: ${uah(input.amountUah)} ₴ — тариф «${planName(input.plan)}», проЯв`
  return fromDoc(subject, {
    greeting: hello(input.name),
    lead: ['Оплату отримано. Дякуємо, що з нами!'],
    rows: [
      ['Тариф', `«${planName(input.plan)}»${volume ? `, ${volume}` : ''}`],
      ['Сума', `${uah(input.amountUah)} ₴${credit}`],
      ['Дата оплати', kyivDate(input.paidAt ?? new Date())],
      ['Період', `${input.period === 'year' ? 'рік' : 'місяць'}, ${kyivDate(input.periodStart)} – ${kyivDate(input.periodEnd)}`],
      ['Діє до', kyivDate(input.periodEnd)],
      ['Спосіб оплати', wallet ? `${wallet} (${provider})` : `картка, ${provider}`],
      ['Замовлення', input.orderId],
    ],
    list: { title: 'Що входить', items: planIncludes(input.plan) },
    after: [renewal, `Банківську квитанцію ${provider} надсилає окремо.`],
    button: { label: 'Відкрити кабінет', url: billingUrl() },
  })
}

// ---------------------------------------------------------------------------
// 1b. Auto-renewal in 3 days (sent by the renewal cron)
// ---------------------------------------------------------------------------
export interface RenewalNoticeInput {
  name: string | null
  plan: string
  period: 'month' | 'year'
  amountUah: number
  chargeAt: Date
}

export const RENEWAL_NOTICE_DAYS = 3

export function renewalNoticeEmail(input: RenewalNoticeInput): EmailMessage {
  const volume = planVolume(input.plan)
  const subject = `Через ${RENEWAL_NOTICE_DAYS} дні — автопродовження тарифу «${planName(input.plan)}», ${uah(input.amountUah)} ₴`
  return fromDoc(subject, {
    greeting: hello(input.name),
    lead: [
      `${kyivDate(input.chargeAt)} спишемо ${uah(input.amountUah)} ₴ зі збереженої картки — автопродовження тарифу «${planName(input.plan)}»${volume ? ` (${volume})` : ''} на ${input.period === 'year' ? 'рік' : 'місяць'}.`,
    ],
    rows: [
      ['Тариф', `«${planName(input.plan)}»`],
      ['Сума', `${uah(input.amountUah)} ₴`],
      ['Дата списання', kyivDate(input.chargeAt)],
    ],
    after: [
      'Якщо на балансі є реферальний кредит, його врахуємо — спишеться менше.',
      'Не хочете продовжувати? Скасуйте автопродовження до дати списання: оплачений період діє до кінця, картку більше не списуємо.',
    ],
    button: { label: 'Скасувати автопродовження', url: `${billingUrl()}#autopay` },
    link: { label: 'Кабінет і тарифи', url: billingUrl() },
  })
}

// ---------------------------------------------------------------------------
// 2. Failed charge
// ---------------------------------------------------------------------------
export interface FailedChargeInput {
  name: string | null
  plan: string
  amountUah: number
  graceUntil: Date
}

export function failedChargeEmail(input: FailedChargeInput): EmailMessage {
  const volume = planVolume(input.plan)
  const deletesAt = new Date(input.graceUntil.getTime() + RETENTION_DAYS * 24 * 3600 * 1000)
  return {
    subject: `проЯв · не вдалося списати ${uah(input.amountUah)} ₴ за тариф «${planName(input.plan)}»`,
    text: [
      hello(input.name),
      '',
      `Сьогодні ми спробували списати ${uah(input.amountUah)} ₴ за тариф «${planName(input.plan)}», але банк відхилив платіж`,
      '(найчастіше — закінчився строк картки або не вистачило коштів).',
      '',
      `Нічого не зникає. До ${kyivDate(input.graceUntil)} усе працює як раніше:`,
      `галереї відкриті для клієнтів${volume ? `, ліміт ${volume}` : ''}.`,
      '',
      `Щоб тариф не перервався, оновіть картку до ${kyivDate(input.graceUntil)}:`,
      billingUrl(),
      '',
      'Якщо не оновити:',
      `– з ${kyivDate(input.graceUntil)} галереї стануть недоступними для клієнтів (ви їх бачите й можете завантажити);`,
      `– з ${kyivDate(deletesAt)} файли будуть видалені зі сховища.`,
      '',
      'Ми нагадаємо за 30, 7 і 1 день до видалення.',
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 3. Plan ended — grace starts
// ---------------------------------------------------------------------------
export interface GraceStartInput {
  name: string | null
  plan: string
  /** The import promo month ended, not a paid period. */
  promo: boolean
  endedAt: Date
  closesAt: Date
}

export function graceStartEmail(input: GraceStartInput): EmailMessage {
  const volume = planVolume(input.plan)
  const deletesAt = new Date(input.closesAt.getTime() + RETENTION_DAYS * 24 * 3600 * 1000)
  const what = input.promo
    ? 'Безкоштовний місяць «Базового» за імпорт'
    : `Оплачений період тарифу «${planName(input.plan)}»`
  return {
    subject: `проЯв · тариф «${planName(input.plan)}» закінчився — ${GRACE_PERIOD_DAYS} днів усе працює як раніше`,
    text: [
      hello(input.name),
      '',
      `${what} закінчився ${kyivDate(input.endedAt)}.`,
      '',
      `До ${kyivDate(input.closesAt)} нічого не змінюється: галереї відкриті для клієнтів,`,
      `${volume ? `ліміт ${volume}, ` : ''}відео на місці.`,
      '',
      'Далі, якщо тариф не продовжити:',
      `– ${kyivDate(input.closesAt)}: галереї закриваються для клієнтів. Ви й далі бачите все в кабінеті`,
      '  й можете завантажити будь-яку галерею архівом;',
      `– ${kyivDate(deletesAt)}: файли видаляються зі сховища назавжди.`,
      '',
      'Продовжити тариф — одна оплата, усе відкривається одразу:',
      billingUrl(),
      '',
      `Не плануєте платити? Завантажте потрібні галереї до ${kyivDate(deletesAt)} — це безкоштовно.`,
      fitIntoFree('акаунт стане безкоштовним, галереї лишаться відкритими для клієнтів.'),
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 4. Galleries closed to clients
// ---------------------------------------------------------------------------
export interface ClosedInput {
  name: string | null
  plan: string
  galleryCount: number
  deletesAt: Date
}

export function closedEmail(input: ClosedInput): EmailMessage {
  return {
    subject: `проЯв · галереї закриті для клієнтів, файли зберігаються до ${kyivDate(input.deletesAt)}`,
    text: [
      hello(input.name),
      '',
      `Сьогодні закінчився перехідний період після тарифу «${planName(input.plan)}». Ваші ${galleries(input.galleryCount)}`,
      'закриті для клієнтів: за посиланням вони бачать повідомлення «Галерея тимчасово недоступна» —',
      'своєю мовою, тією ж, якою відкривали галерею.',
      '',
      'Для вас нічого не зникло: усі галереї та файли є в кабінеті. Завантажити архів',
      'будь-якої галереї можна безкоштовно.',
      '',
      `Файли зберігаються до ${kyivDate(input.deletesAt)}. Після цієї дати вони будуть видалені зі`,
      'сховища, і відновити їх буде неможливо.',
      '',
      'Відкрити галереї знову — оплатити тариф; вони стануть доступними за тими самими',
      'посиланнями, паролі й вибрані клієнтами фото збережуться:',
      billingUrl(),
      '',
      fitIntoFree('решта файлів лишиться, акаунт стане безкоштовним, а галереї знову відкриються для клієнтів.'),
      dashboardUrl(),
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 5. Deletion warnings — 30 / 7 / 1 day
// ---------------------------------------------------------------------------
export interface DeletionWarningInput {
  name: string | null
  daysLeft: 30 | 7 | 1
  deletesAt: Date
  galleryCount: number
  fileCount: number
  usedBytes: number
}

export function deletionWarningEmail(input: DeletionWarningInput): EmailMessage {
  const date = kyivDate(input.deletesAt)
  const subject =
    input.daysLeft === 1
      ? 'проЯв · завтра файли будуть видалені — останнє нагадування'
      : `проЯв · через ${input.daysLeft} днів файли будуть видалені (${date})`
  const when = input.daysLeft === 1 ? 'Завтра' : `Через ${input.daysLeft} днів`
  return {
    subject,
    text: [
      hello(input.name),
      '',
      `${when}, ${date}, ми видалимо зі сховища файли`,
      `ваших галерей: ${galleries(input.galleryCount)}, ${files(input.fileCount)}, ${formatBytes(input.usedBytes)}.`,
      ...(input.daysLeft === 1 ? ['', 'Це останнє нагадування.'] : []),
      '',
      'Це остаточно — після видалення відновити файли неможливо.',
      '',
      'Три способи нічого не втратити:',
      '1. Оплатити тариф — галереї одразу відкриються для клієнтів, файли лишаться:',
      `   ${billingUrl()}`,
      `2. Завантажити галереї архівом до ${date} — безкоштовно, з кабінету:`,
      `   ${dashboardUrl()}`,
      `3. ${fitIntoFree('решта файлів лишиться, а галереї знову відкриються для клієнтів.').replace(/^Або в/, 'В')}`,
      `   ${dashboardUrl()}`,
      '',
      'Якщо ці файли вам більше не потрібні — нічого робити не треба.',
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 7. Import promo ends (was on «ти» and promised «файли не видаляються»)
// ---------------------------------------------------------------------------
export interface PromoEndingInput {
  name: string | null
  endsAt: Date
  priceUah: number
  storageGb: number
}

export function promoEndingEmail(input: PromoEndingInput): EmailMessage {
  const date = kyivDate(input.endsAt)
  return {
    subject: `проЯв · безкоштовний місяць «Базового» закінчується ${date}`,
    text: [
      hello(input.name),
      '',
      `Безкоштовний місяць тарифу «Базовий» за імпорт галереї закінчується ${date}.`,
      '',
      `Щоб лишитися на «Базовому» (${input.storageGb} ГБ, ${input.priceUah} ₴/міс), підключіть автоплатіж:`,
      `${input.priceUah} ₴ спишемо зараз, а оплачений місяць почнеться ${date}.`,
      billingUrl(),
      '',
      `Без автоплатежу після ${date} ще ${GRACE_PERIOD_DAYS} днів усе працює як раніше, потім галереї`,
      `закриваються для клієнтів, а через ${RETENTION_DAYS} днів файли видаляються зі сховища.`,
      'Ми нагадаємо заздалегідь.',
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 8. Free plan: a gallery closes after 30 days — 7 days / 1 day before
// ---------------------------------------------------------------------------
export interface FreeExpiryInput {
  name: string | null
  daysLeft: 7 | 1
  galleries: { title: string; closesAt: Date }[]
}

export function freeExpiryWarningEmail(input: FreeExpiryInput): EmailMessage {
  const basic = GALLERY_PLANS.basic
  const many = input.galleries.length > 1
  const when = input.daysLeft === 1 ? 'завтра' : `через ${input.daysLeft} днів`
  const subject = many
    ? `проЯв · ${galleries(input.galleries.length)} закриваються ${when}`
    : `проЯв · галерея «${input.galleries[0].title}» закривається ${when}`
  return {
    subject,
    text: [
      hello(input.name),
      '',
      many
        ? `На безкоштовному тарифі галерея живе ${FREE_GALLERY_DAYS} днів. ${when[0].toUpperCase()}${when.slice(1)} для клієнтів закриються:`
        : `На безкоштовному тарифі галерея живе ${FREE_GALLERY_DAYS} днів. ${when[0].toUpperCase()}${when.slice(1)} для клієнтів закриється:`,
      ...input.galleries.map((g) => `• «${g.title}» — ${kyivDate(g.closesAt)}`),
      '',
      `Після закриття клієнт побачить «Галерею закрито, зверніться до фотографа». Ви й далі бачите її в кабінеті, а через ${FREE_PURGE_AFTER_DAYS} днів після закриття файли видаляються.`,
      '',
      `Щоб галереї працювали без строку — перейдіть на «Базовий»: ${basic.priceUahMonth} ₴/міс, ${basic.storageGb} ГБ, відео. Строк знімається з усіх галерей одразу після оплати:`,
      billingUrl(),
      '',
      '— проЯв',
    ].join('\n'),
  }
}

// ---------------------------------------------------------------------------
// 9. Partner period ends in 7 days
// ---------------------------------------------------------------------------
export interface PartnerEndingInput {
  name: string | null
  plan: string
  endsAt: Date
}

export function partnerEndingEmail(input: PartnerEndingInput): EmailMessage {
  const plan = GALLERY_PLANS[input.plan as keyof typeof GALLERY_PLANS] ?? GALLERY_PLANS.plus
  return {
    subject: `проЯв · партнерський період закінчується ${kyivDate(input.endsAt)}`,
    text: [
      hello(input.name),
      '',
      `Дякуємо, що працюєте з нами! Ваш партнерський період на тарифі «${planName(plan.id)}» закінчується ${kyivDate(input.endsAt)}.`,
      '',
      `Щоб залишитися на «${planName(plan.id)}» без перерви — оформіть тариф з автоплатежем: ${plan.priceUahMonth} ₴/міс або ${plan.priceUahYear} ₴/рік (два місяці в подарунок). Можна обрати й інший тариф, від «Базового» за ${GALLERY_PLANS.basic.priceUahMonth} ₴/міс.`,
      billingUrl(),
      '',
      `Якщо нічого не робити, акаунт стане безкоштовним (${GALLERY_PLANS.free.storageGb} ГБ): наявні галереї будуть доступні клієнтам ще ${FREE_GALLERY_DAYS} днів, кожна нова — ${FREE_GALLERY_DAYS} днів від створення.`,
      '',
      '— проЯв',
    ].join('\n'),
  }
}

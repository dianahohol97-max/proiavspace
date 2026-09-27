import { GALLERY_PLANS, GRACE_PERIOD_DAYS } from '@/lib/plans'
import { RETENTION_DAYS } from '@/lib/retention'

/**
 * Billing and plan-lifecycle e-mails (audit EM-03 / LC-01). Texts approved
 * 26.09.2026 (docs/EMAILS_PR2_DRAFT.md), «ви» like the site. Plain text —
 * lib/email turns it into HTML. Ukrainian only for now: the approved set has
 * no English version yet.
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'
const billingUrl = () => `${APP_URL()}/uk/dashboard/billing`
const dashboardUrl = () => `${APP_URL()}/uk/dashboard`

export interface EmailMessage {
  subject: string
  text: string
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

const hello = (name: string | null) => (name ? `Привіт, ${name}!` : 'Привіт!')

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
  periodStart: Date
  periodEnd: Date
  amountUah: number
  creditUah: number
  provider: string
  orderId: string
  /** Next auto-charge, when auto-payment is on. */
  nextChargeAt: Date | null
  nextChargeUah: number | null
}

export function receiptEmail(input: ReceiptInput): EmailMessage {
  const provider = input.provider === 'monobank' ? 'Monobank' : input.provider === 'liqpay' ? 'LiqPay' : input.provider
  const volume = planVolume(input.plan)
  const credit = input.creditUah > 0 ? `, з них ${uah(input.creditUah)} ₴ покрито реферальним кредитом` : ''
  return {
    subject: `проЯв · оплата ${uah(input.amountUah)} ₴ — тариф «${planName(input.plan)}»`,
    text: [
      hello(input.name),
      '',
      'Оплата пройшла. Дякуємо, що з нами.',
      '',
      `Тариф: «${planName(input.plan)}»${volume ? ` — ${volume} сховища` : ''}`,
      `Період: ${input.period === 'year' ? 'рік' : 'місяць'}, ${kyivDate(input.periodStart)} – ${kyivDate(input.periodEnd)}`,
      `Сума: ${uah(input.amountUah)} ₴${credit}`,
      `Спосіб: картка ${provider}, замовлення № ${input.orderId}`,
      '',
      input.nextChargeAt
        ? `Автоплатіж підключено: наступне списання ${kyivDate(input.nextChargeAt)}, ${uah(input.nextChargeUah ?? input.amountUah)} ₴. Вимкнути можна в кабінеті будь-коли.`
        : `Автоплатіж не підключено: тариф діє до ${kyivDate(input.periodEnd)}, далі — ${GRACE_PERIOD_DAYS} днів на повному ліміті, а потім акаунт стає безкоштовним.`,
      '',
      `Кабінет і тарифи: ${billingUrl()}`,
      `Квитанцію банку надсилає ${provider} окремо. Якщо потрібен рахунок для ФОП — відповідайте на цей лист.`,
      '',
      '— проЯв',
    ].join('\n'),
  }
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
      'Два способи все зберегти:',
      '1. Оплатити тариф — галереї одразу відкриються для клієнтів, файли лишаться:',
      `   ${billingUrl()}`,
      `2. Завантажити галереї архівом до ${date} — безкоштовно, з кабінету:`,
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

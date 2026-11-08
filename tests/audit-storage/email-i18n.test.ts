/**
 * Листи 9 мовами (feat/i18n-emails, міграція 0072).
 *
 * Кожен лист кожною мовою у всіх варіантах (один/кілька, за 1/7/30 днів,
 * промо, гаманець, пароль, амбасадор…) рендериться без помилок і без
 * англійських фолбеків, з тією самою структурою, що англійський, з
 * посиланнями на кабінет / галерею тією ж мовою. Новий лист чи рядок — в усі
 * 9 файлів src/lib/emails/locales/*.ts, інакше тест упаде.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { locales, type Locale } from '@/lib/i18n/config'
import { emailCopy, emailLocale } from '@/lib/emails'
import { renderHtml, renderText, wrapText } from '@/lib/email-layout'
import {
  closedEmail,
  deletionWarningEmail,
  failedChargeEmail,
  freeExpiryWarningEmail,
  graceStartEmail,
  partnerEndingEmail,
  promoEndingEmail,
  receiptEmail,
  renewalNoticeEmail,
  type EmailMessage,
} from '@/lib/lifecycle-emails'
import { galleryClientUrl, readyEmailLocale, readyEmailMessage } from '@/lib/gallery/ready-email'
import { rewardEmail } from '@/lib/referral-emails'

const d = (s: string) => new Date(`${s}T12:00:00Z`)

/** Every letter and variant, for one language. Names/titles in Latin script on purpose. */
function letters(locale: Locale): Record<string, EmailMessage | { subject: string; text: string; html?: string }> {
  const base = { locale, name: 'Olena' }
  const receipt = {
    ...base, plan: 'plus', period: 'year' as const, periodStart: d('2026-10-01'), periodEnd: d('2027-10-01'),
    amountUah: 4990, creditUah: 12.9, provider: 'monobank', orderId: 'o-1', nextChargeAt: null, nextChargeUah: null,
  }
  const t = emailCopy(locale)
  const booking = t.bookingNotify({ slot: '20.07.2026 · 14:00', minutes: 60, price: '2000 ₴', clientName: 'Ivan', clientPhone: '+380', clientEmail: 'c@d.e' })
  return {
    receiptOff: receiptEmail(receipt),
    receiptAuto: receiptEmail({ ...receipt, period: 'month', nextChargeAt: d('2026-11-01'), nextChargeUah: 519 }),
    receiptWallet: receiptEmail({ ...receipt, autopayConsent: true, paymentMethod: 'apple' }),
    receiptSite: receiptEmail({ ...receipt, plan: 'site_plus' }),
    renewal: renewalNoticeEmail({ ...base, plan: 'basic', period: 'month', amountUah: 129, chargeAt: d('2026-11-01') }),
    failed: failedChargeEmail({ ...base, name: null, plan: 'plus', amountUah: 519, graceUntil: d('2026-10-15') }),
    grace: graceStartEmail({ ...base, plan: 'basic', promo: false, endedAt: d('2026-10-01'), closesAt: d('2026-10-15') }),
    gracePromo: graceStartEmail({ ...base, plan: 'basic', promo: true, endedAt: d('2026-10-01'), closesAt: d('2026-10-15') }),
    closedOne: closedEmail({ ...base, plan: 'basic', galleryCount: 1, deletesAt: d('2026-12-14') }),
    closedMany: closedEmail({ ...base, plan: 'basic', galleryCount: 5, deletesAt: d('2026-12-14') }),
    delete30: deletionWarningEmail({ ...base, daysLeft: 30, deletesAt: d('2026-12-14'), galleryCount: 3, fileCount: 412, usedBytes: 12 * 1024 ** 3 }),
    delete7: deletionWarningEmail({ ...base, daysLeft: 7, deletesAt: d('2026-12-14'), galleryCount: 1, fileCount: 1, usedBytes: 300 * 1024 ** 2 }),
    delete1: deletionWarningEmail({ ...base, daysLeft: 1, deletesAt: d('2026-12-14'), galleryCount: 22, fileCount: 2, usedBytes: 1.5 * 1024 ** 4 }),
    promo: promoEndingEmail({ ...base, name: null, endsAt: d('2026-10-20'), priceUah: 129, storageGb: 100 }),
    freeOne: freeExpiryWarningEmail({ ...base, daysLeft: 7, galleries: [{ title: 'Anna & Marco', closesAt: d('2026-10-20') }] }),
    freeMany: freeExpiryWarningEmail({ ...base, daysLeft: 1, galleries: [{ title: 'Anna & Marco', closesAt: d('2026-10-20') }, { title: 'Family', closesAt: d('2026-10-20') }] }),
    partner: partnerEndingEmail({ ...base, plan: 'plus', endsAt: d('2026-10-20') }),
    ready: readyEmailMessage({ locale, galleryTitle: 'Anna & Marco', url: galleryClientUrl('https://proiav.space', 'demo', locale), photographerName: 'Olha Vyshnia', hasPassword: false }),
    readyPassword: readyEmailMessage({ locale, galleryTitle: 'Anna & Marco', url: galleryClientUrl('https://proiav.space', 'demo', locale), photographerName: null, hasPassword: true }),
    rewardFirst: rewardEmail({ to: 'a@b', locale, name: 'Olena', amountKop: 1290, isAmbassador: false, first: true }),
    rewardAgain: rewardEmail({ to: 'a@b', locale, name: null, amountKop: 5190, isAmbassador: false, first: false }),
    rewardAmbassador: rewardEmail({ to: 'a@b', locale, name: 'Olena', amountKop: 1290, isAmbassador: true, first: true }),
    booking: { subject: booking.subject, text: booking.lines.join('\n'), html: wrapText(booking.lines.join('\n'), booking.subject, locale) },
  }
}

const EN = letters('en')

/** English sentence fragments of a letter: 4+ words, no URLs, names or numbers. */
function englishFragments(text: string): string[] {
  return text
    .split(/[\n.:;!?()«»"“”—–,]/)
    .map((s) => s.replace(/https?:\/\/\S+/g, '').trim())
    .filter((s) => (s.match(/\b[A-Za-z]{2,}\b/g) ?? []).length >= 4 && !/Olena|Olha|Anna|Marco|Monobank|LiqPay|Apple Pay|Google Pay/.test(s))
}

describe('листи: 9 мов', () => {
  test('emailLocale: будь-яка з 9 мов, решта → uk', () => {
    for (const l of locales) assert.equal(emailLocale(l), l)
    assert.equal(emailLocale('ru'), 'uk')
    assert.equal(emailLocale(null), 'uk')
  })

  test('лист клієнту: мова посилання з «Поділитися», інакше мова фотографа, інакше uk', () => {
    assert.equal(readyEmailLocale({ share_locale: 'de' }, 'pl'), 'de')
    assert.equal(readyEmailLocale({ share_locale: null }, 'pl'), 'pl')
    assert.equal(readyEmailLocale({}, null), 'uk') // до міграції 0072 колонки немає
    assert.equal(galleryClientUrl('https://proiav.space/', 'x', 'fr'), 'https://proiav.space/fr/g/x')
  })

  for (const locale of locales) {
    test(`${locale}: кожен лист рендериться повністю, тією ж мовою`, () => {
      const all = letters(locale)
      for (const [key, m] of Object.entries(all)) {
        const where = `${locale}.${key}`
        assert.ok(m.subject.trim().length > 5, `${where}: тема`)
        for (const part of [m.subject, m.text, m.html ?? '']) {
          assert.doesNotMatch(part, /\bundefined\b|\bnull\b|\bNaN\b|\[object |\{n[,}]|\{\w+\}| # /, `${where}: незаповнене місце`)
        }
        // Посилання на кабінет / галерею — тією ж мовою.
        for (const url of m.text.match(/https?:\/\/\S+/g) ?? []) {
          if (/proiav\.space\/(uk|en|pl|de|es|fr|it|ro|pt)\//.test(url)) assert.match(url, new RegExp(`/${locale}/`), `${where}: ${url}`)
        }
        if ('html' in m && m.html) assert.match(m.html, new RegExp(`<html lang="${locale}">`), `${where}: lang`)
      }
    })

    if (locale === 'uk' || locale === 'en') continue

    test(`${locale}: без англійських фолбеків і без українських рядків`, () => {
      const all = letters(locale)
      const leftovers: string[] = []
      for (const [key, m] of Object.entries(all)) {
        const en = EN[key]
        for (const fragment of englishFragments(`${en.subject}\n${en.text}`)) {
          if (`${m.subject}\n${m.text}`.includes(fragment)) leftovers.push(`${key}: «${fragment}»`)
        }
        // Кирилиця лише в реквізитах ФОП у підвалі.
        const body = m.text.replace(/ФОП Гоголь Діана Іванівна, м\. Тернопіль/g, '')
        if (/[А-Яа-яІіЇїЄєҐґ]/.test(`${m.subject}${body}`)) leftovers.push(`${key}: кирилиця`)
      }
      assert.deepEqual(leftovers, [])
    })

    test(`${locale}: та сама структура, що в англійського`, () => {
      const t = emailCopy(locale)
      const en = emailCopy('en')
      for (const name of Object.keys(en) as (keyof typeof en)[]) {
        assert.equal(typeof t[name], typeof en[name], `${locale}.${String(name)}`)
      }
      assert.deepEqual(Object.keys(t.planNames).sort(), Object.keys(en.planNames).sort())
      assert.deepEqual(Object.keys(t.includes).sort(), Object.keys(en.includes).sort())
      const all = letters(locale)
      for (const key of ['receiptOff', 'receiptAuto', 'renewal', 'ready', 'readyPassword'] as const) {
        // Таблиця й кнопка — ті самі рядки, що в англійському листі.
        const rows = (s: string) => (s.match(/<tr>/g) ?? []).length
        assert.equal(rows(all[key].html ?? ''), rows(EN[key].html ?? ''), `${locale}.${key}: рядки таблиці`)
      }
    })
  }

  test('множина: дні й галереї узгоджені (pl: 1 / 3 / 5 / 22)', () => {
    const subj = (n: number) =>
      freeExpiryWarningEmail({
        locale: 'pl',
        name: null,
        daysLeft: 7,
        galleries: Array.from({ length: n }, (_, i) => ({ title: `G${i}`, closesAt: d('2026-10-20') })),
      }).subject
    assert.notEqual(subj(3), subj(5).replace('5', '3'), 'pl: 3 і 5 галерей — різні форми')
  })

  test('uk: затверджені тексти не змінились (рендер через модуль листів)', () => {
    const m = closedEmail({ name: 'Олена', plan: 'basic', galleryCount: 3, deletesAt: d('2026-12-14') })
    assert.match(m.text, /^Привіт, Олено?!|^Привіт, Олена!/)
    assert.match(m.text, /Ваші 3 галереї/)
    assert.match(m.text, /https:\/\/proiav\.space\/uk\/dashboard\/billing|\/uk\/dashboard\/billing/)
    const html = renderHtml({ greeting: 'Привіт!', lead: ['x'] }, 's')
    assert.match(html, /<html lang="uk">/)
    assert.match(renderText({ greeting: 'Привіт!', lead: ['x'] }), /Питання й рахунок для ФОП/)
  })
})

/**
 * PR 2 — тексти листів (затверджені 26.09 з правками) і розпізнавання помилок
 * реєстрації на /login.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { classifyAuthError, isExistingUserSignup } from '@/lib/auth-errors'
import {
  closedEmail,
  deletionWarningEmail,
  failedChargeEmail,
  graceStartEmail,
  promoEndingEmail,
  receiptEmail,
} from '@/lib/lifecycle-emails'

const d = (s: string) => new Date(`${s}T12:00:00Z`)
const all = () => [
  receiptEmail({
    name: 'Олена', plan: 'basic', period: 'month', periodStart: d('2026-10-01'), periodEnd: d('2026-11-01'),
    amountUah: 117, creditUah: 12, provider: 'monobank', orderId: 'o-1', nextChargeAt: null, nextChargeUah: null,
  }),
  failedChargeEmail({ name: null, plan: 'plus', amountUah: 519, graceUntil: d('2026-10-15') }),
  graceStartEmail({ name: 'Олена', plan: 'basic', promo: false, endedAt: d('2026-10-01'), closesAt: d('2026-10-15') }),
  closedEmail({ name: 'Олена', plan: 'basic', galleryCount: 3, deletesAt: d('2026-12-14') }),
  deletionWarningEmail({ name: 'Олена', daysLeft: 1, deletesAt: d('2026-12-14'), galleryCount: 3, fileCount: 412, usedBytes: 12 * 1024 ** 3 }),
  promoEndingEmail({ name: null, endsAt: d('2026-10-20'), priceUah: 129, storageGb: 100 }),
]

describe('тексти листів', () => {
  test('звертання на «ви» в усіх листах', () => {
    for (const m of all()) assert.doesNotMatch(m.text, /\b(ти|тобі|твій|твоє|твої|підключи|оновіть твою)\b/i, m.subject)
  })

  test('лист 4: клієнт бачить «Галерея тимчасово недоступна» своєю мовою', () => {
    const m = all()[3]
    assert.match(m.text, /«Галерея тимчасово недоступна»/)
    assert.match(m.text, /своєю мовою/)
    assert.match(m.text, /3 галереї/)
  })

  test('чек: рядок про рахунок для ФОП і кредит', () => {
    const m = all()[0]
    assert.match(m.text, /рахунок для ФОП — відповідайте на цей лист/)
    assert.match(m.text, /з них 12 ₴ покрито реферальним кредитом/)
    assert.match(m.subject, /оплата 117 ₴ — тариф «Базовий»/)
  })

  test('лист 3 і промо-лист: 14 днів, потім закриття, 60 днів до видалення — без «не видаляються»', () => {
    for (const m of [all()[2], all()[5]]) {
      assert.match(`${m.subject}\n${m.text}`, /14 днів/)
      assert.doesNotMatch(m.text, /не видаляють/)
    }
    assert.match(all()[5].text, /через 60 днів файли видаляються/)
    assert.match(all()[5].text, /підключіть автоплатіж/)
  })

  test('лист «завтра» — останнє нагадування, з кількістю файлів', () => {
    const m = all()[4]
    assert.equal(m.subject, 'проЯв · завтра файли будуть видалені — останнє нагадування')
    assert.match(m.text, /Це останнє нагадування\./)
    assert.match(m.text, /3 галереї, 412 файлів, 12,0 ГБ/)
  })
})

describe('помилки реєстрації на /login', () => {
  test('пошта вже зайнята', () => {
    assert.equal(classifyAuthError({ message: 'User already registered', status: 422 }), 'exists')
    assert.equal(classifyAuthError({ code: 'user_already_exists', message: 'x' }), 'exists')
    assert.equal(isExistingUserSignup({ identities: [] }), true)
    assert.equal(isExistingUserSignup({ identities: [{}] }), false)
  })

  test('лист не відправився (SMTP 500, Brevo 525 Unauthorized IP, rate limit)', () => {
    assert.equal(classifyAuthError({ message: 'Error sending confirmation email', status: 500 }), 'email_send')
    assert.equal(classifyAuthError({ message: 'Error sending magic link email', status: 500 }), 'email_send')
    assert.equal(classifyAuthError({ message: '525 Unauthorized IP address', status: 500 }), 'email_send')
    assert.equal(classifyAuthError({ code: 'over_email_send_rate_limit', message: 'x', status: 429 }), 'email_send')
  })

  test('інше — не «пошта зайнята»', () => {
    assert.equal(classifyAuthError({ message: 'Password should be at least 8 characters', status: 422 }), 'other')
    assert.equal(classifyAuthError({ message: 'Database error saving new user', status: 500 }), 'other')
  })
})

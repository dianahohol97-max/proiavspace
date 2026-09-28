/**
 * «Тариф і оплата» (/dashboard/billing#autopay): the rules (billingOverview)
 * and the rendered section in its three auto-renewal states — on / off /
 * not available for Google-Apple Pay — without a database. The data side
 * against the local stack is tests/referrals/billing-cabinet.test.ts.
 */
import assert from 'node:assert/strict'
import { before, describe, mock, test } from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { billingOverview, type PaymentRow } from '@/lib/billing/cabinet'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'

const now = Date.parse('2026-09-29T10:00:00Z')
const GB = 1024 ** 3
const basicProfile = { plan: 'basic', grace_until: null, storage_used_bytes: 2.5 * GB, storage_limit_bytes: 100 * GB }
const paid = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  created_at: '2026-09-28T16:35:00Z',
  amount: '129.00',
  plan: 'basic',
  period: 'month',
  status: 'paid',
  provider: 'monobank',
  subscription_id: null,
  raw: { paymentInfo: { paymentMethod: 'pan', maskedPan: '444403******1902' } },
  ...over,
})

describe('стан автопродовження (billingOverview)', () => {
  test('увімкнене: активна підписка → наступне списання й сума, «діє до» = дата списання', () => {
    const o = billingOverview({
      profile: basicProfile,
      subscriptions: [{ product: 'gallery', plan: 'basic', period: 'month', status: 'active', next_charge_at: '2026-10-28T16:35:00Z' }],
      payments: [paid()],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(o.autopay, { kind: 'on', nextChargeAt: '2026-10-28T16:35:00Z', amountUah: 129 })
    assert.equal(o.validUntil, '2026-10-28T16:35:00Z')
    assert.equal(o.planId, 'basic')
    assert.equal(o.storageLimitBytes, 100 * GB)
  })

  test('вимкнене: оплата карткою без підписки → «вимкнене», діє до = кінець оплаченого місяця (grace_until − 14 днів)', () => {
    const o = billingOverview({
      profile: { ...basicProfile, grace_until: '2026-11-11T16:35:00Z' },
      subscriptions: [],
      payments: [paid()],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(o.autopay, { kind: 'off', pastDue: false })
    assert.equal(o.validUntil, '2026-10-28T16:35:00.000Z')
  })

  test('недоступне: остання оплата через Google Pay → «оплатіть карткою»', () => {
    const o = billingOverview({
      profile: { ...basicProfile, grace_until: '2026-11-11T16:35:00Z' },
      subscriptions: [],
      payments: [paid({ raw: { paymentInfo: { paymentMethod: 'google', maskedPan: '5168****1111' } } })],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(o.autopay, { kind: 'wallet', wallet: 'Google Pay' })
    const apple = billingOverview({
      profile: basicProfile,
      subscriptions: [],
      payments: [paid({ raw: { paymentInfo: { paymentMethod: 'apple' } } })],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(apple.autopay, { kind: 'wallet', wallet: 'Apple Pay' })
  })

  test('скасована або прострочена підписка → вимкнене (прострочена — з поясненням)', () => {
    const canceled = billingOverview({
      profile: { ...basicProfile, grace_until: '2026-11-11T16:35:00Z' },
      subscriptions: [{ product: 'gallery', plan: 'basic', period: 'month', status: 'canceled', next_charge_at: '2026-10-28T16:35:00Z' }],
      payments: [paid()],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(canceled.autopay, { kind: 'off', pastDue: false })
    assert.equal(canceled.validUntil, '2026-10-28T16:35:00Z')
    const pastDue = billingOverview({
      profile: { ...basicProfile, grace_until: '2026-10-10T00:00:00Z' },
      subscriptions: [{ product: 'gallery', plan: 'basic', period: 'month', status: 'past_due', next_charge_at: '2026-09-27T00:00:00Z' }],
      payments: [],
      partnerUntil: null,
      now,
    })
    assert.deepEqual(pastDue.autopay, { kind: 'off', pastDue: true })
  })

  test('Free: 3 ГБ, «діє до» нема, вимкнене навіть після старої оплати Google Pay', () => {
    const o = billingOverview({
      profile: { plan: 'free', grace_until: null, storage_used_bytes: 0, storage_limit_bytes: 3 * GB },
      subscriptions: [],
      payments: [paid({ raw: { paymentInfo: { paymentMethod: 'google' } } })],
      partnerUntil: null,
      now,
    })
    assert.equal(o.isFree, true)
    assert.equal(o.validUntil, null)
    assert.equal(o.storageLimitBytes, 3 * GB)
    assert.equal(o.autopay.kind, 'off')
  })

  test('партнер: діє до кінця партнерського періоду', () => {
    const o = billingOverview({
      profile: { plan: 'plus', grace_until: '2026-12-29T00:00:00Z', storage_used_bytes: 0, storage_limit_bytes: 500 * GB },
      subscriptions: [],
      payments: [],
      partnerUntil: '2026-12-29T00:00:00Z',
      now,
    })
    assert.equal(o.validUntil, '2026-12-29T00:00:00Z')
    assert.equal(o.partnerUntil, '2026-12-29T00:00:00Z')
  })

  test('історія: останні 12, спосіб (картка ••••, Google Pay, автосписання), повернення', () => {
    const rows = Array.from({ length: 15 }, (_, i) => paid({ created_at: `2026-0${(i % 9) + 1}-01T00:00:00Z` }))
    rows[0] = paid({ raw: { paymentInfo: { paymentMethod: 'google' } } })
    rows[1] = paid({ subscription_id: 'sub-1', raw: { paymentInfo: { paymentMethod: 'wallet' } } })
    rows[2] = paid({ status: 'canceled', raw: { status: 'reversed', paymentInfo: { paymentMethod: 'pan', maskedPan: '4444****9999' } } })
    const o = billingOverview({ profile: basicProfile, subscriptions: [], payments: rows, partnerUntil: null, now })
    assert.equal(o.history.length, 12)
    assert.deepEqual(o.history[0].method, { kind: 'google' })
    assert.deepEqual(o.history[1].method, { kind: 'autocharge' })
    assert.deepEqual(o.history[2], { ...o.history[2], refunded: true, method: { kind: 'card', last4: '9999' } })
    assert.deepEqual(o.history[3].method, { kind: 'card', last4: '1902' })
  })
})

describe('розділ «Тариф і оплата» (рендер)', () => {
  let render: (locale: 'uk' | 'en', overview: ReturnType<typeof billingOverview>) => string
  before(async () => {
    mock.module('next/navigation', { namedExports: { useRouter: () => ({ refresh() {} }) } })
    // tsx compiles the component's JSX in classic mode (React.createElement).
    ;(globalThis as { React?: typeof React }).React = React
    const { BillingOverview } = await import('@/components/BillingOverview')
    render = (locale, overview) => {
      const d = locale === 'uk' ? uk : en
      const b = d.billing
      return renderToStaticMarkup(
        createElement(BillingOverview, {
          overview,
          locale,
          planNames: { free: b.planFree, basic: b.planBasic, plus: b.planPlus, pro: b.planPro },
          labels: {
            title: b.overviewTitle, plan: b.overviewPlan, used: b.overviewUsed, validUntil: b.overviewValidUntil,
            freeLifetime: b.overviewFreeLifetime, autopayTitle: b.overviewAutopayTitle, autopayOn: b.overviewAutopayOn,
            autopayOff: b.overviewAutopayOff, autopayPastDue: b.overviewAutopayPastDue, autopayWallet: b.overviewAutopayWallet,
            cancel: b.overviewCancel, cancelConfirm: b.overviewCancelConfirm, cancelError: b.overviewCancelError,
            enable: b.overviewEnable, payByCard: b.overviewPayByCard, changePlan: b.overviewChangePlan,
            partnerUntil: d.dashboard.partnerUntil, historyTitle: b.overviewHistoryTitle, historyEmpty: b.overviewHistoryEmpty,
            historyDate: b.overviewHistoryDate, historyAmount: b.overviewHistoryAmount, historyPlan: b.overviewHistoryPlan,
            historyMethod: b.overviewHistoryMethod, methodCard: b.overviewMethodCard, methodAutocharge: b.overviewMethodAutocharge,
            refunded: b.overviewRefunded, periodMonth: b.overviewPeriodMonth, periodYear: b.overviewPeriodYear,
          },
        })
      )
    }
  })
  const base = { profile: basicProfile, partnerUntil: null, now }

  test('увімкнене: «наступне списання 28.10.2026, 129 ₴» і кнопка «Скасувати автопродовження»; якір #autopay', () => {
    const html = render('uk', billingOverview({
      ...base,
      subscriptions: [{ product: 'gallery', plan: 'basic', period: 'month', status: 'active', next_charge_at: '2026-10-28T16:35:00Z' }],
      payments: [paid()],
    }))
    assert.match(html, /<section id="autopay"/)
    assert.match(html, /data-autopay-state="on"/)
    assert.match(html, /Увімкнене: наступне списання 28\.10\.2026, 129 ₴/)
    assert.match(html, /<button[^>]*>Скасувати автопродовження<\/button>/)
    assert.match(html, /Тариф: «Базовий» · 100 ГБ/)
    assert.match(html, /Використано 2,5 ГБ з 100 ГБ/)
    assert.match(html, /Діє до 28\.10\.2026/)
    assert.match(html, /href="#plans"[^>]*>Змінити тариф/)
    assert.match(html, /Картка •••• 1902/)
  })

  test('вимкнене: «Вимкнене» і «Увімкнути автопродовження» → тарифи з галочкою', () => {
    const html = render('uk', billingOverview({ ...base, profile: { ...basicProfile, grace_until: '2026-11-11T16:35:00Z' }, subscriptions: [], payments: [paid()] }))
    assert.match(html, /data-autopay-state="off"/)
    assert.match(html, />Вимкнене</)
    assert.match(html, /href="#plans"[^>]*>Увімкнути автопродовження/)
    assert.doesNotMatch(html, /Скасувати автопродовження/)
  })

  test('недоступне: «…через Google Pay — оплатіть карткою, щоб увімкнути» і кнопка «Оплатити карткою»', () => {
    const html = render('uk', billingOverview({
      ...base,
      subscriptions: [],
      payments: [paid({ raw: { paymentInfo: { paymentMethod: 'google' } } })],
    }))
    assert.match(html, /data-autopay-state="wallet"/)
    assert.match(html, /Недоступне для оплати через Google Pay — оплатіть карткою, щоб увімкнути/)
    assert.match(html, /href="#plans"[^>]*>Оплатити карткою/)
  })

  test('Free і партнер: «Free — галереї живуть 30 днів», бейдж «Партнер до»; англійською теж', () => {
    const free = render('uk', billingOverview({ ...base, profile: { plan: 'free', grace_until: null, storage_used_bytes: 0, storage_limit_bytes: 3 * GB }, subscriptions: [], payments: [] }))
    assert.match(free, /Free — галереї живуть 30 днів/)
    assert.match(free, /Платежів ще не було/)
    const partner = render('en', billingOverview({
      ...base,
      profile: { plan: 'plus', grace_until: '2026-12-29T00:00:00Z', storage_used_bytes: 0, storage_limit_bytes: 500 * GB },
      subscriptions: [],
      payments: [],
      partnerUntil: '2026-12-29T00:00:00Z',
    }))
    assert.match(partner, /Partner until 29\/12\/2026/)
    assert.match(partner, /Plan &amp; billing/)
    assert.match(partner, /Turn on auto-renewal/)
  })

  test('пункт меню кабінету: «Тариф і оплата» / «Plan & billing»', () => {
    assert.equal(uk.dashboard.billingLink, 'Тариф і оплата')
    assert.equal(en.dashboard.billingLink, 'Plan & billing')
  })
})

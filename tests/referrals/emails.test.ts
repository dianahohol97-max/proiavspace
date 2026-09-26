/**
 * Referral e-mails (BUG-08) through a mocked Brevo client: the referrer's
 * «+X ₴» notification and the admin's withdrawal-request notification.
 */
import assert from 'node:assert/strict'
import { before, beforeEach, describe, test } from 'node:test'
import {
  codeOf,
  dbAvailable,
  deliverWebhook,
  installMocks,
  outbox,
  pendingPayment,
  pg,
  q,
  session,
  signUp,
} from './harness'

const skip = !dbAvailable && 'run via tests/referrals/run.sh'

// Imported lazily: the Brevo mock must be installed before lib/email loads.
const texts = () => import('@/lib/referral-emails')

describe('texts', () => {
  before(async () => {
    if (!skip) await installMocks()
  })

  test('amounts: kopecks → 12,90 ₴ / 250 ₴', async () => {
    const { formatUah } = await texts()
    assert.equal(formatUah(1290), '12,90 ₴')
    assert.equal(formatUah(25000), '250 ₴')
  })

  test('first credit e-mail (uk)', async () => {
    const { rewardEmail } = await texts()
    process.env.NEXT_PUBLIC_APP_URL = 'https://proiav.space'
    const m = rewardEmail({ to: 'a@b', locale: 'uk', amountKop: 1290, isAmbassador: false, first: true })
    assert.equal(m.subject, '+12,90 ₴ — ваш перший реферальний кредит')
    assert.match(m.text, /щойно оформив платний тариф/)
    assert.match(m.text, /Вам нараховано 12,90 ₴ кредитом — 10% від його оплати/)
    assert.match(m.text, /https:\/\/proiav\.space\/uk\/dashboard\/referrals/)
    assert.match(m.text, /Дякуємо, що радите нас колегам/)
    assert.doesNotMatch(m.text, /тобі|твій|твоє/)
  })

  test('repeat credit e-mail and ambassador e-mail', async () => {
    const { rewardEmail } = await texts()
    const again = rewardEmail({ to: 'a@b', locale: 'uk', amountKop: 5190, isAmbassador: false, first: false })
    assert.equal(again.subject, '+51,90 ₴ — реферальний кредит')
    const amb = rewardEmail({ to: 'a@b', locale: 'uk', amountKop: 1290, isAmbassador: true, first: true })
    assert.equal(amb.subject, '+12,90 ₴ — ваша перша реферальна винагорода')
    assert.match(amb.text, /до виплати — 10% від його оплати\. І так з кожної з перших 12 його оплат/)
    assert.match(amb.text, /Вивести можна від 200 ₴ у кабінеті/)
  })

  test('withdrawal e-mail hides the payout details', async () => {
    const { maskPayoutDetails, withdrawalEmail } = await texts()
    assert.equal(maskPayoutDetails('5375 4141 1234 5678'), 'картка, ****5678')
    assert.equal(maskPayoutDetails('UA21 3223 1300 0002 6007 2335 6600 1'), 'IBAN, ****6001')
    assert.equal(maskPayoutDetails('PayPal olena@x.com'), 'реквізити, ****.com')
    const m = withdrawalEmail({ name: 'Олена К.', email: 'olena@x.com', amountKop: 25000, details: '5375414112345678' })
    assert.equal(m.subject, 'Заявка на виведення: 250 ₴ — Олена К.')
    assert.match(m.text, /Амбасадор Олена К\. \(olena@x\.com\) просить виплатити 250 ₴\./)
    assert.match(m.text, /Реквізити: картка, \*\*\*\*5678\./)
    assert.doesNotMatch(m.text, /5375414112345678/)
    assert.match(m.text, /\/uk\/dashboard\/stats/)
  })
})

describe('sending (mocked Brevo)', { skip }, () => {
  before(async () => {
    if (!skip) await installMocks()
  })
  beforeEach(() => {
    outbox.length = 0
    session.userId = null
  })

  test('first payment → one e-mail to the referrer; repeat payment → the repeat text; re-delivery → nothing', async () => {
    const referrer = signUp({ email: 'ref@test.local' })
    const invitee = signUp({ ref: codeOf(referrer) })
    const first = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: first.orderId, status: 'paid' })
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].to, 'ref@test.local')
    assert.equal(outbox[0].subject, '+12,90 ₴ — ваш перший реферальний кредит')

    await deliverWebhook({ orderId: first.orderId, status: 'paid' })
    assert.equal(outbox.length, 1)

    const second = pendingPayment({ userId: invitee, amount: 519, plan: 'plus' })
    await deliverWebhook({ orderId: second.orderId, status: 'paid' })
    assert.equal(outbox.length, 2)
    assert.equal(outbox[1].subject, '+51,90 ₴ — реферальний кредит')
  })

  test('ambassador gets the cash wording; English profile gets English', async () => {
    const amb = signUp({ email: 'amb@test.local' })
    pg(`update public.profiles set is_ambassador = true, locale = 'en' where user_id = ${q(amb)}`)
    const invitee = signUp({ ref: codeOf(amb) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].subject, '+12,90 ₴ — your first referral reward')
  })

  test('no e-mail when nothing was accrued (self-referral / no referrer / failed payment)', async () => {
    const referrer = signUp({ email: 'me@test.local' })
    const twin = signUp({ ref: codeOf(referrer), email: 'ME+x@test.local' })
    const pay = pendingPayment({ userId: twin, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    const alone = signUp()
    const pay2 = pendingPayment({ userId: alone, amount: 129 })
    await deliverWebhook({ orderId: pay2.orderId, status: 'paid' })
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay3 = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay3.orderId, status: 'failed' })
    assert.equal(outbox.length, 0)
  })

  test('withdrawal request → admin e-mail with masked details', async () => {
    const amb = signUp({ email: 'olena@test.local' })
    pg(
      `update public.profiles set is_ambassador = true, cash_balance_kop = 25000, display_name = 'Олена К.' where user_id = ${q(amb)}`
    )
    session.userId = amb
    const { requestWithdrawal } = await import('@/lib/actions/referrals')
    const form = new FormData()
    form.set('details', '5375 4141 1234 5678')
    let redirectedTo = ''
    try {
      await requestWithdrawal('uk', form)
    } catch (cause) {
      // next/navigation redirect() signals by throwing.
      redirectedTo = String((cause as { digest?: string }).digest ?? '')
    }
    assert.match(redirectedTo, /w=ok/)
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0].to, 'admin@proiav.test')
    assert.equal(outbox[0].subject, 'Заявка на виведення: 250 ₴ — Олена К.')
    assert.match(outbox[0].text, /olena@test\.local/)
    assert.match(outbox[0].text, /картка, \*\*\*\*5678/)
    assert.doesNotMatch(outbox[0].text, /1234 5678|5375414112345678/)
  })
})

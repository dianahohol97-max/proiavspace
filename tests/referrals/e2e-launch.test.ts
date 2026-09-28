/**
 * Launch week, task 4: the referral story end to end, one photographer pair
 * through the real handlers (middleware cookie → sign-up → checkout → Monobank
 * webhook → cabinet → renewal a month later → refund), plus self-referral.
 */
import assert from 'node:assert/strict'
import { before, beforeEach, describe, test } from 'node:test'
import {
  codeOf,
  dbAvailable,
  deliverWebhook,
  earnings,
  installMocks,
  outbox,
  pg,
  profile,
  provider,
  q,
  referralStatus,
  session,
  signUp,
  startProxy,
  userClient,
} from './harness'

const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'
let url = ''
before(async () => {
  if (skip) return
  await installMocks()
  url = await startProxy()
})
beforeEach(() => {
  provider.checkouts.length = 0
  provider.charges.length = 0
  provider.chargeResult = 'paid'
  provider.recurring = false
  outbox.length = 0
})

async function checkout(userId: string, plan = 'basic', period = 'month') {
  session.userId = userId
  const { POST } = await import('@/app/api/billing/checkout/route')
  const res = await POST(
    new Request('https://proiav.test/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan, period, locale: 'uk' }) }) as never
  )
  assert.equal(res.status, 200)
  return provider.checkouts.at(-1)!
}
async function renewCron() {
  const { GET } = await import('@/app/api/billing/renew/route')
  const res = await GET(new Request('https://proiav.test/api/billing/renew', { headers: { authorization: 'Bearer cron-test' } }) as never)
  return res.json()
}
async function cabinet(userId: string) {
  const { data } = await userClient(url, userId).rpc('get_referral_stats')
  return (data as Record<string, number>[])[0]
}

describe('реферали: A запрошує Б — повний шлях', { skip }, () => {
  const aEmail = `a-${Math.random().toString(36).slice(2, 8)}@test.local`
  const bEmail = `b-${Math.random().toString(36).slice(2, 8)}@test.local`
  let a = ''
  let b = ''
  let firstOrder = ''

  test('реф-посилання: /uk/login?ref=<код А> → cookie на 30 днів', async () => {
    a = signUp({ email: aEmail })
    const { captureRefParam } = await import('@/lib/referrals')
    const { NextRequest, NextResponse } = await import('next/server')
    const req = new NextRequest(`https://proiav.test/uk/login?ref=${codeOf(a)}`)
    const res = NextResponse.next()
    captureRefParam(req, res)
    const cookie = res.cookies.get('proiav_ref')
    assert.equal(cookie?.value, codeOf(a))
    assert.equal(cookie?.maxAge, 30 * 24 * 3600)
  })

  test('Б реєструється з кодом А → referred_by = А, referral pending; в кабінеті А «запрошено 1»', async () => {
    b = signUp({ email: bEmail, ref: codeOf(a) })
    assert.equal(profile(b).referred_by, a)
    assert.equal(referralStatus(b), 'pending')
    const stats = await cabinet(a)
    assert.equal(Number(stats.invited), 1)
    assert.equal(Number(stats.converted), 0)
  })

  test('Б оплачує Базовий 129 ₴ (вебхук Monobank, картку збережено) → А отримує 12,90 ₴ кредиту і лист', async () => {
    const invoice = await checkout(b)
    assert.equal(invoice.amount, 129)
    firstOrder = invoice.orderId
    assert.equal(await deliverWebhook({ orderId: invoice.orderId, status: 'paid', cardToken: 'card-b' }), 200)
    assert.equal(profile(b).plan, 'basic')
    assert.equal(profile(a).credit_balance_kop, 1290)
    assert.equal(referralStatus(b), 'converted')
    assert.ok(outbox.some((m) => m.to === aEmail && /12,90/.test(m.text)))
    assert.ok(outbox.some((m) => m.to === bEmail), 'receipt to Б')
    const stats = await cabinet(a)
    assert.equal(Number(stats.converted), 1)
  })

  test('кабінет А: видно лише свій рядок нарахувань; Б нічого не бачить про А', async () => {
    const { data: mine } = await userClient(url, a).from('referral_earnings').select('amount_kop')
    assert.deepEqual((mine ?? []).map((r) => r.amount_kop), [1290])
    const { data: theirs } = await userClient(url, b).from('referral_earnings').select('amount_kop')
    assert.equal((theirs ?? []).length, 0)
  })

  test('через місяць — автосписання крон-ом → А ще +12,90 ₴ (24,90 разом), лист «ще нараховано»', async () => {
    pg(`update public.billing_subscriptions set next_charge_at = now() - interval '1 minute' where user_id = ${q(b)}`)
    await renewCron()
    assert.equal(provider.charges.length, 1)
    assert.equal(provider.charges[0].amount, 129)
    assert.equal(profile(a).credit_balance_kop, 2580)
    assert.equal(earnings(a).length, 2)
    assert.equal(referralStatus(b), 'converted')
  })

  test('refund першої оплати → 12,90 ₴ знято з А, автоплатіж Б вимкнено (картку не списуємо знову), далі 14 днів grace', async () => {
    assert.equal(await deliverWebhook({ orderId: firstOrder, status: 'canceled' }), 200)
    assert.equal(profile(a).credit_balance_kop, 1290)
    assert.deepEqual(
      earnings(a).map((e) => e.amount_kop).sort((x, y) => x - y),
      [-1290, 1290, 1290]
    )
    // Refunded money must not be followed by another charge of the same card.
    assert.equal(pg(`select status from public.billing_subscriptions where user_id = ${q(b)}`), 'canceled')
    pg(`update public.billing_subscriptions set next_charge_at = now() - interval '1 minute' where user_id = ${q(b)}`)
    provider.charges.length = 0
    await renewCron()
    assert.equal(provider.charges.length, 0)
    const graceDays = Number(pg(`select round(extract(epoch from grace_until - now()) / 86400) from public.profiles where user_id = ${q(b)}`))
    assert.equal(graceDays, 14)
  })

  test('«canceled» по неоплаченому рахунку не чіпає тариф і автоплатіж того, хто платить', async () => {
    const payer = signUp()
    const first = await checkout(payer)
    await deliverWebhook({ orderId: first.orderId, status: 'paid', cardToken: 'card-p' })
    const upgrade = await checkout(payer, 'plus')
    assert.equal(await deliverWebhook({ orderId: upgrade.orderId, status: 'canceled' }), 200)
    assert.equal(pg(`select coalesce(grace_until::text, '-') from public.profiles where user_id = ${q(payer)}`), '-')
    assert.equal(pg(`select status from public.billing_subscriptions where user_id = ${q(payer)}`), 'active')
  })

  test('самореферал: власний код при реєстрації з іншої пошти-аліаса → звʼязку нема, винагороди нема', async () => {
    const self = signUp({ email: `self+main@test.local` })
    const alias = signUp({ email: `self+alias@test.local`, ref: codeOf(self) })
    assert.equal(profile(alias).referred_by, null)
    const invoice = await checkout(alias)
    await deliverWebhook({ orderId: invoice.orderId, status: 'paid' })
    assert.equal(profile(self).credit_balance_kop, 0)
  })

  test('самореферал через ту саму картку (інший акаунт, та сама карта) → нічого', async () => {
    const owner = signUp()
    const second = signUp({ ref: codeOf(owner) })
    // The owner pays with card X first …
    const own = await checkout(owner)
    await deliverWebhook({ orderId: own.orderId, status: 'paid', cardToken: 'card-same' })
    // … and the «invitee» with the very same card.
    const inv = await checkout(second)
    await deliverWebhook({ orderId: inv.orderId, status: 'paid', cardToken: 'card-same' })
    assert.equal(profile(owner).credit_balance_kop, 0)
  })
})

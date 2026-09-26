/**
 * Referral system — money flow through the real Next.js route handlers
 * (checkout → Monobank webhook → renewal cron) against the local Supabase
 * stack. Only the payment provider is faked.
 *
 * Bug numbers in test names refer to tests/referrals/REPORT.md.
 */
import assert from 'node:assert/strict'
import { before, beforeEach, describe, test } from 'node:test'
import {
  codeOf,
  dbAvailable,
  deliverWebhook,
  earnings,
  installMocks,
  pendingPayment,
  pg,
  profile,
  provider,
  q,
  referralStatus,
  session,
  signUp,
} from './harness'

const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'

before(async () => {
  if (!skip) await installMocks()
})
beforeEach(() => {
  provider.checkouts.length = 0
  provider.charges.length = 0
  provider.chargeResult = 'paid'
  provider.lookupResult = 'unknown'
  session.userId = null
})

async function checkout(userId: string, plan = 'basic', period = 'month') {
  session.userId = userId
  const { POST } = await import('@/app/api/billing/checkout/route')
  const res = await POST(
    new Request('https://proiav.test/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, period, locale: 'uk' }),
    }) as never
  )
  const last = provider.checkouts.at(-1)
  return { status: res.status, body: await res.json(), last }
}

async function runRenewCron() {
  const { GET } = await import('@/app/api/billing/renew/route')
  const res = await GET(
    new Request('https://proiav.test/api/billing/renew', {
      headers: { authorization: 'Bearer cron-test' },
    }) as never
  )
  return res.json()
}

function dueSubscription(userId: string, plan = 'basic', period = 'month'): string {
  return pg(
    `insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at, status)
     values (${q(userId)}, 'gallery', ${q(plan)}, ${q(period)}, 'monobank', 'tok_test', now() - interval '1 minute', 'active')
     returning id`
  )
}

describe('webhook: reward on the invitee’s payment', { skip }, () => {
  test('invitee pays Базовий 129 ₴ → referrer gets 12.90 ₴ credit, referral converted', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    assert.equal(await deliverWebhook({ orderId: pay.orderId, status: 'paid' }), 200)

    assert.equal(profile(invitee).plan, 'basic')
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.deepEqual(earnings(referrer).map((e) => e.amount_kop), [1290])
    assert.equal(referralStatus(invitee), 'converted')
  })

  test('the same webhook re-delivered (sequential and concurrent) → rewarded once', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await Promise.all([
      deliverWebhook({ orderId: pay.orderId, status: 'paid' }),
      deliverWebhook({ orderId: pay.orderId, status: 'paid' }),
      deliverWebhook({ orderId: pay.orderId, status: 'paid' }),
    ])
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.equal(earnings(referrer).length, 1)
  })

  test('a late "processing" event after success does not reopen the payment', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    await deliverWebhook({ orderId: pay.orderId, status: 'pending' })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(earnings(referrer).length, 1)
  })

  test('each NEW payment of the invitee is rewarded (10% of every payment)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    for (const amount of [129, 519]) {
      const pay = pendingPayment({ userId: invitee, amount, plan: amount === 129 ? 'basic' : 'plus' })
      await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    }
    assert.equal(profile(referrer).credit_balance_kop, 1290 + 5190)
    assert.equal(earnings(referrer).length, 2)
    assert.equal(referralStatus(invitee), 'converted')
  })

  test('failed / expired payment → nothing accrued, referral stays pending', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'failed' })
    assert.equal(earnings(referrer).length, 0)
    assert.equal(referralStatus(invitee), 'pending')
  })

  test('invitee stays on Free (never pays) → nothing accrued', () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    assert.equal(profile(invitee).plan, 'free')
    assert.equal(earnings(referrer).length, 0)
    assert.equal(referralStatus(invitee), 'pending')
  })

  test('payer without a referrer → no reward anywhere', async () => {
    const payer = signUp()
    const pay = pendingPayment({ userId: payer, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(pg(`select count(*) from public.referral_earnings where referred_id = ${q(payer)}`), '0')
  })

  test('ambassador referrer earns cash', async () => {
    const referrer = signUp()
    pg(`update public.profiles set is_ambassador = true where user_id = ${q(referrer)}`)
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 5190, plan: 'plus', period: 'year' })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(profile(referrer).cash_balance_kop, 51900)
    assert.equal(profile(referrer).credit_balance_kop, 0)
  })

  test('site plan payments are rewarded too', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 99, plan: 'site_basic' })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    assert.equal(profile(referrer).credit_balance_kop, 990)
  })

  test('refund (Monobank "reversed") claws the reward back (BUG-04)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    await deliverWebhook({ orderId: pay.orderId, status: 'canceled' })
    assert.equal(profile(referrer).credit_balance_kop, 0)
    assert.deepEqual(earnings(referrer).map((e) => e.amount_kop).sort(), [-1290, 1290])
    // A second refund event changes nothing.
    await deliverWebhook({ orderId: pay.orderId, status: 'canceled' })
    assert.equal(profile(referrer).credit_balance_kop, 0)
  })

  test('refund returns the credit the payer spent on that payment', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    const { last } = await checkout(u)
    await deliverWebhook({ orderId: last!.orderId, status: 'paid' })
    assert.equal(profile(u).credit_balance_kop, 0)
    await deliverWebhook({ orderId: last!.orderId, status: 'canceled' })
    assert.equal(profile(u).credit_balance_kop, 5000)
  })

  test('self-referral via the same saved card earns nothing (BUG-09)', async () => {
    const referrer = signUp()
    // The referrer paid earlier with a card Monobank tokenised as tok_me.
    const own = pendingPayment({ userId: referrer, amount: 129 })
    await deliverWebhook({ orderId: own.orderId, status: 'paid', cardToken: 'tok_me' })
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    await deliverWebhook({ orderId: pay.orderId, status: 'paid', cardToken: 'tok_me' })
    assert.equal(profile(referrer).credit_balance_kop, 0)
    assert.equal(earnings(referrer).length, 0)
    assert.equal(
      pg(`select referral_processed_at is not null from public.payments where id = ${q(pay.id)}`),
      't'
    )
  })

  test('ambassador cash is capped per referral, credit is not', async () => {
    const amb = signUp()
    pg(`update public.profiles set is_ambassador = true where user_id = ${q(amb)}`)
    const invitee = signUp({ ref: codeOf(amb) })
    const { AMBASSADOR_MAX_PAYMENTS_PER_REFERRAL: cap } = await import('@/lib/referrals')
    for (let i = 0; i < cap + 2; i++) {
      const pay = pendingPayment({ userId: invitee, amount: 129 })
      await deliverWebhook({ orderId: pay.orderId, status: 'paid' })
    }
    assert.equal(profile(amb).cash_balance_kop, cap * 1290)
  })
})

describe('checkout: spending the credit', { skip }, () => {
  test('credit 50 ₴ on Базовий 129 ₴ → invoice 79 ₴, applied amount recorded', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    const { status, last } = await checkout(u)
    assert.equal(status, 200)
    assert.equal(last?.amount, 79)
    assert.match(last?.description ?? '', /кредит −50 ₴/)
    assert.equal(
      pg(`select credit_applied_kop from public.payments where order_id = ${q(last!.orderId)}`),
      '5000'
    )
    // Balance is only consumed once the payment succeeds.
    assert.equal(profile(u).credit_balance_kop, 5000)
    await deliverWebhook({ orderId: last!.orderId, status: 'paid' })
    assert.equal(profile(u).credit_balance_kop, 0)
  })

  test('credit larger than the price → invoice 1 ₴, rest stays on balance', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 20000 where user_id = ${q(u)}`)
    const { last } = await checkout(u)
    assert.equal(last?.amount, 1)
    await deliverWebhook({ orderId: last!.orderId, status: 'paid' })
    assert.equal(profile(u).credit_balance_kop, 20000 - 12800)
  })

  test('kopecks below 1 ₴ are kept, not lost', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 1290 where user_id = ${q(u)}`)
    const { last } = await checkout(u)
    assert.equal(last?.amount, 117)
    await deliverWebhook({ orderId: last!.orderId, status: 'paid' })
    assert.equal(profile(u).credit_balance_kop, 90)
  })

  test('abandoned checkout does not burn the credit', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    const { last } = await checkout(u)
    await deliverWebhook({ orderId: last!.orderId, status: 'failed' })
    assert.equal(profile(u).credit_balance_kop, 5000)
  })

  test('while the import promo month runs, credit is not spent', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    pg(`insert into public.promo_grants (user_id, ends_at) values (${q(u)}, now() + interval '10 days')`)
    const { last } = await checkout(u)
    assert.equal(last?.amount, 129)
  })

  test('the invitee spending credit lowers the referrer’s 10% (reward is on the amount actually paid)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(invitee)}`)
    const { last } = await checkout(invitee)
    await deliverWebhook({ orderId: last!.orderId, status: 'paid' })
    assert.equal(profile(referrer).credit_balance_kop, 790)
  })

  test('two checkouts opened in parallel cannot spend the same credit twice (BUG-05)', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    await Promise.all([checkout(u), checkout(u, 'basic', 'month')])
    const amounts = provider.checkouts.map((c) => c.amount).sort((a, b) => a - b)
    assert.deepEqual(amounts, [79, 129])
    for (const c of provider.checkouts) await deliverWebhook({ orderId: c.orderId, status: 'paid' })
    assert.equal(profile(u).credit_balance_kop, 0)
  })

  test('a failed checkout frees the credit for the next one', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    const a = await checkout(u)
    const b = await checkout(u)
    assert.equal(b.last?.amount, 129)
    await deliverWebhook({ orderId: a.last!.orderId, status: 'failed' })
    const c = await checkout(u)
    assert.equal(c.last?.amount, 79)
  })
})

describe('renewal cron (saved card, Monobank)', { skip }, () => {
  test('synchronous successful renewal of an invitee rewards the referrer (BUG-01)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    pg(`update public.profiles set plan = 'basic' where user_id = ${q(invitee)}`)
    dueSubscription(invitee)
    provider.chargeResult = 'paid'
    await runRenewCron()
    assert.equal(provider.charges.length, 1)
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    // Monobank then also sends the webhook for the same order: no double reward.
    await deliverWebhook({ orderId: provider.charges[0].orderId, status: 'paid' })
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.equal(earnings(referrer).length, 1)
  })

  test('renewal settled through the statement lookup rewards the referrer', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const subId = dueSubscription(invitee)
    // An earlier attempt is still pending (no webhook arrived).
    pendingPayment({ userId: invitee, amount: 129, subscriptionId: subId })
    provider.lookupResult = 'paid'
    await runRenewCron()
    assert.equal(provider.charges.length, 0)
    assert.equal(profile(referrer).credit_balance_kop, 1290)
  })

  test('the repair pass rewards a paid payment whose accrual never ran (BUG-12)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const pay = pendingPayment({ userId: invitee, amount: 129 })
    pg(`update public.payments set status = 'paid' where id = ${q(pay.id)}`)
    const result = await runRenewCron()
    assert.ok(result.referralRepairs >= 1)
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.equal(referralStatus(invitee), 'converted')
    await runRenewCron()
    assert.equal(earnings(referrer).length, 1)
  })

  test('asynchronous renewal (pending → webhook) rewards the referrer', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    dueSubscription(invitee)
    provider.chargeResult = 'pending'
    await runRenewCron()
    await deliverWebhook({ orderId: provider.charges[0].orderId, status: 'paid' })
    assert.equal(profile(referrer).credit_balance_kop, 1290)
  })

  test('renewal spends the referrer’s own credit (BUG-02)', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 5000 where user_id = ${q(u)}`)
    dueSubscription(u)
    await runRenewCron()
    assert.equal(provider.charges[0]?.amount, 79)
    assert.equal(profile(u).credit_balance_kop, 0)
    assert.equal(
      pg(`select amount || '/' || credit_applied_kop from public.payments where order_id = ${q(provider.charges[0].orderId)}`),
      '79.00/5000'
    )
  })

  test('renewal of a Free-plan subscription is never charged', async () => {
    const u = signUp()
    dueSubscription(u, 'free')
    await runRenewCron()
    assert.equal(provider.charges.length, 0)
  })
})

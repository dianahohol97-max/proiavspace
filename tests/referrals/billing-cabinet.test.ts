/**
 * «Тариф і оплата»: loadBillingOverview with the photographer's own client
 * (RLS) against the local stack — the three auto-renewal states from real
 * rows, the payment history, and nobody else's payments.
 */
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { dbAvailable, installMocks, pendingPayment, pg, q, signUp, startProxy, userClient } from './harness'

const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'
let url = ''
before(async () => {
  if (skip) return
  await installMocks()
  url = await startProxy()
})

async function overviewOf(userId: string) {
  const { loadBillingOverview } = await import('@/lib/billing/cabinet')
  const o = await loadBillingOverview(userClient(url, userId), userId)
  assert.ok(o)
  return o
}

/** A settled Monobank payment with a stored webhook payload. */
function paidPayment(userId: string, method: string, opts: { subscriptionId?: string; daysAgo?: number } = {}) {
  const { id } = pendingPayment({ userId, amount: 129, subscriptionId: opts.subscriptionId })
  pg(`update public.payments
        set status = 'paid',
            created_at = now() - interval '${opts.daysAgo ?? 0} days',
            raw = ${q(JSON.stringify({ status: 'success', paymentInfo: { paymentMethod: method, maskedPan: '444403******1902' } }))}::jsonb
      where id = ${q(id)}`)
  return id
}

describe('«Тариф і оплата» з бази (RLS)', { skip }, () => {
  test('увімкнене: активна підписка Базовий → next_charge_at і 129 ₴', async () => {
    const u = signUp()
    pg(`update public.profiles set plan = 'basic', storage_limit_bytes = 107374182400, grace_until = null where user_id = ${q(u)}`)
    const sub = pg(`insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at, status)
                    values (${q(u)}, 'gallery', 'basic', 'month', 'monobank', 'tok', now() + interval '20 days', 'active') returning id`)
    paidPayment(u, 'pan', { daysAgo: 10 })
    paidPayment(u, 'wallet', { subscriptionId: sub })
    const o = await overviewOf(u)
    assert.equal(o.autopay.kind, 'on')
    assert.equal(o.autopay.kind === 'on' && o.autopay.amountUah, 129)
    assert.equal(o.planId, 'basic')
    assert.equal(o.history.length, 2)
    assert.deepEqual(o.history[0].method, { kind: 'autocharge' })
    assert.deepEqual(o.history[1].method, { kind: 'card', last4: '1902' })
  })

  test('вимкнене: оплата карткою без підписки → off, «діє до» ≈ через місяць', async () => {
    const u = signUp()
    pg(`update public.profiles set plan = 'basic', storage_limit_bytes = 107374182400,
          grace_until = now() + interval '1 month' + interval '14 days' where user_id = ${q(u)}`)
    paidPayment(u, 'pan')
    const o = await overviewOf(u)
    assert.deepEqual(o.autopay, { kind: 'off', pastDue: false })
    const days = (new Date(o.validUntil!).getTime() - Date.now()) / 86400000
    assert.ok(days > 27 && days < 32, String(days))
  })

  test('недоступне: оплата через Google Pay без підписки → wallet', async () => {
    const u = signUp()
    pg(`update public.profiles set plan = 'basic', storage_limit_bytes = 107374182400,
          grace_until = now() + interval '44 days' where user_id = ${q(u)}`)
    paidPayment(u, 'google')
    const o = await overviewOf(u)
    assert.deepEqual(o.autopay, { kind: 'wallet', wallet: 'Google Pay' })
  })

  test('Free без платежів; чужі платежі не видно', async () => {
    const other = signUp()
    paidPayment(other, 'pan')
    const u = signUp()
    const o = await overviewOf(u)
    assert.equal(o.isFree, true)
    assert.equal(o.history.length, 0)
    assert.equal(o.autopay.kind, 'off')
    assert.equal(o.storageLimitBytes, 3221225472)
  })
})

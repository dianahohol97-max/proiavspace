/**
 * Referral system — database layer: the signup trigger (?ref= capture),
 * reward accrual / credit consumption functions, dashboard stats and the
 * RLS / grant boundaries, all exercised through PostgREST with real JWTs.
 *
 * Bug numbers in test names refer to tests/referrals/REPORT.md.
 */
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import {
  anonClient,
  codeOf,
  dbAvailable,
  earnings,
  pg,
  profile,
  q,
  referralStatus,
  serviceKey,
  signUp,
  startProxy,
  userClient,
} from './harness'
import { createClient } from '@supabase/supabase-js'

const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'

let url = ''
before(async () => {
  if (!skip) url = await startProxy()
})

describe('code generation', { skip }, () => {
  test('every new profile gets a unique 8-char lowercase hex code', () => {
    const a = signUp()
    const b = signUp()
    assert.match(codeOf(a), /^[0-9a-f]{8}$/)
    assert.notEqual(codeOf(a), codeOf(b))
  })

  test('the code cannot be changed by its owner through the API', async () => {
    const a = signUp()
    const before = codeOf(a)
    const { error } = await userClient(url, a)
      .from('profiles')
      .update({ referral_code: 'vanity01' })
      .eq('user_id', a)
    assert.ok(error, 'update of referral_code must be refused')
    assert.equal(codeOf(a), before)
  })
})

describe('signup capture (handle_new_user)', { skip }, () => {
  test('valid ?ref= → referred_by set and a pending referral row', () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    assert.equal(profile(invitee).referred_by, referrer)
    assert.equal(referralStatus(invitee), 'pending')
  })

  test('no ref → no link', () => {
    const invitee = signUp()
    assert.equal(profile(invitee).referred_by, null)
    assert.equal(referralStatus(invitee), 'none')
  })

  test('unknown / empty / garbage ref → signup still succeeds, no link', () => {
    for (const ref of ['zzzzzzzz', '', "'; drop table profiles; --", 'x'.repeat(5000)]) {
      const invitee = signUp({ ref })
      assert.equal(profile(invitee).referred_by, null, `ref=${ref.slice(0, 20)}`)
      assert.equal(referralStatus(invitee), 'none')
    }
  })

  test('code typed in UPPERCASE still links (BUG-06)', () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer).toUpperCase() })
    assert.equal(profile(invitee).referred_by, referrer)
  })

  test('code with surrounding spaces still links (BUG-06)', () => {
    const referrer = signUp()
    const invitee = signUp({ ref: ` ${codeOf(referrer)} ` })
    assert.equal(profile(invitee).referred_by, referrer)
  })

  test('a user can only ever have one referrer', () => {
    const r1 = signUp()
    const invitee = signUp({ ref: codeOf(r1) })
    const count = pg(`select count(*) from public.referrals where referred_id = ${q(invitee)}`)
    assert.equal(count, '1')
  })

  test('changing auth metadata after signup does not change the referrer', () => {
    const r1 = signUp()
    const r2 = signUp()
    const invitee = signUp({ ref: codeOf(r1) })
    pg(
      `update auth.users set raw_user_meta_data = jsonb_build_object('ref', ${q(codeOf(r2))}) where id = ${q(invitee)}`
    )
    assert.equal(profile(invitee).referred_by, r1)
  })

  test('self-referral by e-mail (case / +alias) links nothing (BUG-09)', () => {
    const referrer = signUp({ email: 'Diana.H@Example.com' })
    const invitee = signUp({ ref: codeOf(referrer), email: 'diana.h+second@example.com' })
    assert.equal(profile(invitee).referred_by, null)
    assert.equal(referralStatus(invitee), 'none')
  })

  test('user cannot set or change referred_by through the API', async () => {
    const r1 = signUp()
    const attacker = signUp()
    const { error } = await userClient(url, attacker)
      .from('profiles')
      .update({ referred_by: r1 })
      .eq('user_id', attacker)
    assert.ok(error)
    assert.equal(profile(attacker).referred_by, null)
  })
})

describe('claim_referral (cookie-based signup: Google / magic link)', { skip }, () => {
  test('fresh account without referrer → linked once', async () => {
    const referrer = signUp()
    const me = signUp()
    const client = userClient(url, me)
    const first = await client.rpc('claim_referral', { p_code: codeOf(referrer).toUpperCase() })
    assert.equal(first.error, null)
    assert.equal(first.data, true)
    assert.equal(profile(me).referred_by, referrer)
    assert.equal(referralStatus(me), 'pending')
    const again = await client.rpc('claim_referral', { p_code: codeOf(signUp()) })
    assert.equal(again.data, false)
    assert.equal(profile(me).referred_by, referrer)
  })

  test('account already linked at signup keeps its referrer', async () => {
    const r1 = signUp()
    const r2 = signUp()
    const me = signUp({ ref: codeOf(r1) })
    const { data } = await userClient(url, me).rpc('claim_referral', { p_code: codeOf(r2) })
    assert.equal(data, false)
    assert.equal(profile(me).referred_by, r1)
  })

  test('own code, unknown code, old account → no link', async () => {
    const me = signUp()
    assert.equal((await userClient(url, me).rpc('claim_referral', { p_code: codeOf(me) })).data, false)
    assert.equal((await userClient(url, me).rpc('claim_referral', { p_code: 'nope' })).data, false)
    const old = signUp({ createdAgo: '2 days' })
    assert.equal(
      (await userClient(url, old).rpc('claim_referral', { p_code: codeOf(signUp()) })).data,
      false
    )
    assert.equal(profile(old).referred_by, null)
  })

  test('anon cannot call it', async () => {
    const { error } = await anonClient(url).rpc('claim_referral', { p_code: 'abcdef12' })
    assert.ok(error)
  })
})

describe('accrue_referral_reward / consume_credit (service role)', { skip }, () => {
  const svc = () =>
    createClient(url, serviceKey(), { auth: { persistSession: false } })

  test('regular referrer → credit, logged once per payment', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const paymentId = pg(`select gen_random_uuid()`)
    for (let i = 0; i < 3; i++) {
      const { error } = await svc().rpc('accrue_referral_reward', {
        p_referrer: referrer,
        p_referred: invitee,
        p_payment: paymentId,
        p_amount: 1290,
      })
      assert.equal(error, null)
    }
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.equal(profile(referrer).cash_balance_kop, 0)
    assert.equal(earnings(referrer).length, 1)
    assert.equal(earnings(referrer)[0].kind, 'credit')
  })

  test('concurrent duplicate accruals for one payment → one reward', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const paymentId = pg(`select gen_random_uuid()`)
    await Promise.all(
      Array.from({ length: 8 }, () =>
        svc().rpc('accrue_referral_reward', {
          p_referrer: referrer,
          p_referred: invitee,
          p_payment: paymentId,
          p_amount: 1290,
        })
      )
    )
    assert.equal(profile(referrer).credit_balance_kop, 1290)
    assert.equal(earnings(referrer).length, 1)
  })

  test('ambassador referrer → cash, not credit', async () => {
    const referrer = signUp()
    pg(`update public.profiles set is_ambassador = true where user_id = ${q(referrer)}`)
    const invitee = signUp({ ref: codeOf(referrer) })
    await svc().rpc('accrue_referral_reward', {
      p_referrer: referrer,
      p_referred: invitee,
      p_payment: pg(`select gen_random_uuid()`),
      p_amount: 5190,
    })
    assert.equal(profile(referrer).cash_balance_kop, 5190)
    assert.equal(profile(referrer).credit_balance_kop, 0)
    assert.equal(earnings(referrer)[0].kind, 'cash')
  })

  test('ambassador cash stops after the Nth payment of one referral (cap)', async () => {
    const referrer = signUp()
    pg(`update public.profiles set is_ambassador = true where user_id = ${q(referrer)}`)
    const invitee = signUp({ ref: codeOf(referrer) })
    const results: number[] = []
    for (let i = 0; i < 4; i++) {
      const { data } = await svc().rpc('accrue_referral_reward', {
        p_referrer: referrer, p_referred: invitee, p_payment: pg(`select gen_random_uuid()`),
        p_amount: 1290, p_card_token: null, p_max_payments: 3,
      })
      results.push(data as number)
    }
    assert.deepEqual(results, [1290, 1290, 1290, 0])
    assert.equal(profile(referrer).cash_balance_kop, 3 * 1290)
  })

  test('the cap does not apply to credit (regular referrer)', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    for (let i = 0; i < 4; i++) {
      await svc().rpc('accrue_referral_reward', {
        p_referrer: referrer, p_referred: invitee, p_payment: pg(`select gen_random_uuid()`),
        p_amount: 1290, p_card_token: null, p_max_payments: 3,
      })
    }
    assert.equal(profile(referrer).credit_balance_kop, 4 * 1290)
  })

  test('self-referral by shared card token earns nothing (BUG-09)', async () => {
    const referrer = signUp()
    pg(
      `insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at)
       values (${q(referrer)}, 'gallery', 'basic', 'month', 'monobank', 'tok_shared', now() + interval '20 days')`
    )
    const invitee = signUp({ ref: codeOf(referrer) })
    const { data } = await svc().rpc('accrue_referral_reward', {
      p_referrer: referrer, p_referred: invitee, p_payment: pg(`select gen_random_uuid()`),
      p_amount: 1290, p_card_token: 'tok_shared', p_max_payments: null,
    })
    assert.equal(data, 0)
    assert.equal(profile(referrer).credit_balance_kop, 0)
  })

  test('reverse_referral_reward: negative row, balance may go below zero, idempotent (BUG-04)', async () => {
    const referrer = signUp()
    pg(`update public.profiles set is_ambassador = true where user_id = ${q(referrer)}`)
    const invitee = signUp({ ref: codeOf(referrer) })
    const paymentId = pg(`select gen_random_uuid()`)
    await svc().rpc('accrue_referral_reward', {
      p_referrer: referrer, p_referred: invitee, p_payment: paymentId,
      p_amount: 5190, p_card_token: null, p_max_payments: 12,
    })
    // The ambassador already withdrew everything.
    pg(`update public.profiles set cash_balance_kop = 0 where user_id = ${q(referrer)}`)
    const first = await svc().rpc('reverse_referral_reward', { p_payment: paymentId })
    const second = await svc().rpc('reverse_referral_reward', { p_payment: paymentId })
    assert.equal(first.data, 5190)
    assert.equal(second.data, 0)
    assert.equal(profile(referrer).cash_balance_kop, -5190)
    assert.deepEqual(earnings(referrer).map((e) => e.amount_kop).sort(), [-5190, 5190])
    // The next accrual pays the debt off.
    await svc().rpc('accrue_referral_reward', {
      p_referrer: referrer, p_referred: invitee, p_payment: pg(`select gen_random_uuid()`),
      p_amount: 1290, p_card_token: null, p_max_payments: 12,
    })
    assert.equal(profile(referrer).cash_balance_kop, -5190 + 1290)
  })

  test('consume_credit never goes negative', async () => {
    const u = signUp()
    pg(`update public.profiles set credit_balance_kop = 500 where user_id = ${q(u)}`)
    await svc().rpc('consume_credit', { p_user: u, p_amount: 1200 })
    assert.equal(profile(u).credit_balance_kop, 0)
  })
})

describe('dashboard stats (get_referral_stats)', { skip }, () => {
  test('counts invited / converted / credit for the caller only', async () => {
    const referrer = signUp()
    const other = signUp()
    const i1 = signUp({ ref: codeOf(referrer) })
    signUp({ ref: codeOf(referrer) })
    signUp({ ref: codeOf(other) })
    pg(`update public.referrals set status = 'converted' where referred_id = ${q(i1)}`)
    pg(`update public.profiles set credit_balance_kop = 1290 where user_id = ${q(referrer)}`)

    const { data, error } = await userClient(url, referrer).rpc('get_referral_stats')
    assert.equal(error, null)
    assert.deepEqual(data, [
      { invited: 2, converted: 1, credit_kop: 1290, cash_kop: 0, is_ambassador: false },
    ])
  })

  test('unconfirmed signups are not counted as invited (BUG-11)', async () => {
    const referrer = signUp()
    signUp({ ref: codeOf(referrer), confirmed: false })
    signUp({ ref: codeOf(referrer) })
    const { data } = await userClient(url, referrer).rpc('get_referral_stats')
    assert.equal((data as { invited: number }[])[0].invited, 1)
  })

  test('anon cannot call it', async () => {
    const { error } = await anonClient(url).rpc('get_referral_stats')
    assert.ok(error)
  })
})

describe('RLS / privilege boundaries', { skip }, () => {
  test("cannot read another photographer's referral code", async () => {
    const victim = signUp()
    const attacker = signUp()
    const { data } = await userClient(url, attacker)
      .from('profiles')
      .select('referral_code')
      .eq('user_id', victim)
    assert.deepEqual(data, [])
    const { data: anonData } = await anonClient(url).from('profiles').select('referral_code')
    assert.deepEqual(anonData ?? [], [])
  })

  test('referrals table is invisible and not writable from the API', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    const client = userClient(url, referrer)
    const { data } = await client.from('referrals').select('*')
    assert.deepEqual(data, [])
    const { error: ins } = await client
      .from('referrals')
      .insert({ referrer_id: referrer, referred_id: signUp() })
    assert.ok(ins)
    const { error: upd, data: updData } = await client
      .from('referrals')
      .update({ status: 'converted' })
      .eq('referred_id', invitee)
      .select()
    assert.ok(upd || (updData ?? []).length === 0)
    assert.equal(referralStatus(invitee), 'pending')
  })

  test('cannot top up own balance or become ambassador', async () => {
    const u = signUp()
    const client = userClient(url, u)
    for (const patch of [
      { credit_balance_kop: 999999 },
      { cash_balance_kop: 999999 },
      { is_ambassador: true },
      { referral_code: 'aaaaaaaa' },
    ]) {
      const { error } = await client.from('profiles').update(patch).eq('user_id', u)
      assert.ok(error, JSON.stringify(patch))
    }
    const p = profile(u)
    assert.equal(p.credit_balance_kop, 0)
    assert.equal(p.cash_balance_kop, 0)
  })

  test('cannot call the service-only money functions', async () => {
    const u = signUp()
    const client = userClient(url, u)
    const calls = [
      client.rpc('accrue_referral_reward', {
        p_referrer: u, p_referred: u, p_payment: null, p_amount: 100000,
      }),
      client.rpc('consume_credit', { p_user: u, p_amount: -100000 }),
      client.rpc('refund_cash', { p_user: u, p_amount: 100000 }),
      client.rpc('refund_credit', { p_user: u, p_amount: 100000 }),
      client.rpc('reverse_referral_reward', { p_payment: null }),
      client.rpc('create_pending_payment', {
        p_user: u, p_provider: 'monobank', p_order_id: 'x', p_plan: 'pro', p_period: 'year',
        p_amount_uah: 1, p_purpose: null, p_subscription: null, p_apply_credit: false,
      }),
      client.rpc('is_self_referral', { p_referrer: u, p_referred: u, p_card_token: null }),
    ]
    for (const { error } of await Promise.all(calls)) assert.ok(error)
    assert.equal(profile(u).credit_balance_kop, 0)
    assert.equal(profile(u).cash_balance_kop, 0)
  })

  test('cannot insert a fake paid payment or earnings row', async () => {
    const u = signUp()
    const client = userClient(url, u)
    const { error: p } = await client.from('payments').insert({
      user_id: u, provider: 'monobank', order_id: 'x', plan: 'pro', period: 'year',
      amount: 1, currency: 'UAH', status: 'paid',
    })
    assert.ok(p)
    const { error: e } = await client.from('referral_earnings').insert({
      referrer_id: u, referred_id: u, amount_kop: 100000, kind: 'cash',
    })
    assert.ok(e)
  })

  test('referral_earnings: only own rows are visible', async () => {
    const referrer = signUp()
    const invitee = signUp({ ref: codeOf(referrer) })
    pg(
      `insert into public.referral_earnings (referrer_id, referred_id, amount_kop, kind)
       values (${q(referrer)}, ${q(invitee)}, 100, 'credit')`
    )
    const { data: own } = await userClient(url, referrer).from('referral_earnings').select('amount_kop')
    assert.equal(own?.length, 1)
    const { data: others } = await userClient(url, invitee).from('referral_earnings').select('*')
    assert.deepEqual(others, [])
  })
})

describe('ambassador withdrawal (request_withdrawal)', { skip }, () => {
  test('regular photographer is refused', async () => {
    const u = signUp()
    const { error } = await userClient(url, u).rpc('request_withdrawal', { p_details: 'x' })
    assert.match(error?.message ?? '', /not_ambassador/)
  })

  test('below 200 ₴ is refused, balance untouched', async () => {
    const u = signUp()
    pg(`update public.profiles set is_ambassador = true, cash_balance_kop = 19999 where user_id = ${q(u)}`)
    const { error } = await userClient(url, u).rpc('request_withdrawal', { p_details: 'x' })
    assert.match(error?.message ?? '', /below_minimum/)
    assert.equal(profile(u).cash_balance_kop, 19999)
  })

  test('≥ 200 ₴ moves the whole balance into one request; a second call is refused', async () => {
    const u = signUp()
    pg(`update public.profiles set is_ambassador = true, cash_balance_kop = 25000 where user_id = ${q(u)}`)
    const client = userClient(url, u)
    const [a, b] = await Promise.all([
      client.rpc('request_withdrawal', { p_details: 'UA00' }),
      client.rpc('request_withdrawal', { p_details: 'UA00' }),
    ])
    assert.equal([a, b].filter((r) => !r.error).length, 1)
    assert.equal(profile(u).cash_balance_kop, 0)
    assert.equal(pg(`select sum(amount_kop) from public.withdrawals where user_id = ${q(u)}`), '25000')
  })
})

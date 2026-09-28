/**
 * Auto-renewal consent (29.09.2026, migration 0052) through the real handlers
 * on the local stack: checkout → payments.autopay_consent / customerId,
 * webhook → subscription only with consent (a token without it is deleted),
 * the renewal cron's «через 3 дні спишемо» letter, and the receipt (greeting,
 * details, wallet payments). Monobank and Brevo are faked (harness).
 */
import assert from 'node:assert/strict'
import { before, beforeEach, describe, test } from 'node:test'
import {
  dbAvailable,
  installMocks,
  mailer,
  outbox,
  pendingPayment,
  pg,
  provider,
  q,
  session,
  signUp,
} from './harness'

const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'

before(async () => {
  if (!skip) await installMocks()
})
beforeEach(() => {
  provider.checkouts.length = 0
  provider.deletedTokens.length = 0
  provider.charges.length = 0
  provider.chargeResult = 'paid'
  provider.recurring = false
  outbox.length = 0
  mailer.down = false
})

async function checkout(userId: string, body: Record<string, unknown>) {
  session.userId = userId
  const { POST } = await import('@/app/api/billing/checkout/route')
  const res = await POST(
    new Request('https://proiav.test/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'basic', period: 'month', locale: 'uk', ...body }),
    }) as never
  )
  return { status: res.status, last: provider.checkouts.at(-1) }
}

/** A provider webhook with a chosen raw payload (payment method etc.). */
async function webhook(event: { orderId: string; status: 'paid' | 'failed' | 'canceled'; cardToken?: string; raw?: unknown }) {
  const { POST } = await import('@/app/api/billing/webhook/route')
  const res = await POST(
    new Request('https://proiav.test/api/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({ raw: { test: true }, ...event }),
    }) as never
  )
  return res.status
}

async function renewCron() {
  const { GET } = await import('@/app/api/billing/renew/route')
  const res = await GET(new Request('https://proiav.test/api/billing/renew', { headers: { authorization: 'Bearer cron-test' } }) as never)
  return (await res.json()) as Record<string, unknown>
}

const consent = (orderId: string) => pg(`select autopay_consent from public.payments where order_id = ${q(orderId)}`)
const subOf = (userId: string) =>
  pg(`select coalesce((select status || '|' || card_token from public.billing_subscriptions where user_id = ${q(userId)}), 'none')`)

describe('згода на автопродовження: checkout і вебхук', { skip }, () => {
  test('чекбокс увімкнено → згода в payments, картку просимо зберегти (customerId)', async () => {
    const u = signUp()
    const { status, last } = await checkout(u, { autopay: true })
    assert.equal(status, 200)
    assert.equal(last?.customerId, u)
    assert.equal(last?.autopay, true)
    assert.equal(consent(last!.orderId), 't')
  })

  test('чекбокс знято → згоди нема, customerId не передається (Monobank не отримає saveCardData)', async () => {
    const u = signUp()
    const { last } = await checkout(u, { autopay: false })
    assert.equal(last?.customerId, undefined)
    assert.equal(last?.autopay, false)
    assert.equal(consent(last!.orderId), 'f')
  })

  test('старий клієнт без поля autopay → згоди нема', async () => {
    const u = signUp()
    const { last } = await checkout(u, {})
    assert.equal(last?.customerId, undefined)
    assert.equal(consent(last!.orderId), 'f')
  })

  test('промо «Підключити автоплатіж» — це і є згода', async () => {
    const u = signUp()
    const importId = pg(`insert into public.gallery_imports (owner_id, zip_name, status, imported_count)
                         values (${q(u)}, 'a.zip', 'completed', 1) returning id`)
    pg(`insert into public.promo_grants (user_id, import_id, ends_at) values (${q(u)}, ${q(importId)}, now() + interval '20 days')`)
    pg(`update public.profiles set plan = 'basic', grace_until = now() + interval '34 days' where user_id = ${q(u)}`)
    const { status, last } = await checkout(u, { promo: 'import_autopay' })
    assert.equal(status, 200)
    assert.equal(last?.customerId, u)
    assert.equal(consent(last!.orderId), 't')
  })

  test('оплата зі згодою + токен → підписка з автосписанням', async () => {
    const u = signUp()
    const { last } = await checkout(u, { autopay: true })
    assert.equal(await webhook({ orderId: last!.orderId, status: 'paid', cardToken: 'tok-yes' }), 200)
    assert.equal(subOf(u), 'active|tok-yes')
    assert.equal(pg(`select coalesce(grace_until::text, '-') from public.profiles where user_id = ${q(u)}`), '-')
    assert.deepEqual(provider.deletedTokens, [])
  })

  test('токен без згоди (рахунок до 0052) → підписки нема, токен видалено в Monobank, тариф — оплачений місяць', async () => {
    const u = signUp()
    const { orderId } = pendingPayment({ userId: u, amount: 129 })
    assert.equal(await webhook({ orderId, status: 'paid', cardToken: 'tok-no' }), 200)
    assert.equal(subOf(u), 'none')
    assert.deepEqual(provider.deletedTokens, ['tok-no'])
    const days = Number(pg(`select round(extract(epoch from grace_until - now()) / 86400) from public.profiles where user_id = ${q(u)}`))
    assert.ok(days >= 42 && days <= 45, String(days)) // a month + 14 days of grace
    assert.equal(pg(`select plan from public.profiles where user_id = ${q(u)}`), 'basic')
  })

  test('згода є, але оплата через Google Pay (токена нема) → без підписки, у квитанції пояснення', async () => {
    const u = signUp()
    const { last } = await checkout(u, { autopay: true })
    await webhook({ orderId: last!.orderId, status: 'paid', raw: { paymentInfo: { paymentMethod: 'google' } } })
    assert.equal(subOf(u), 'none')
    const receipt = outbox.find((m) => m.subject.startsWith('Квитанція:'))
    assert.ok(receipt)
    assert.match(receipt.text, /Автопродовження не підключилося: оплата через Google Pay не зберігає картку/)
    assert.match(receipt.text, /Спосіб оплати: Google Pay \(Monobank\)/)
  })
})

describe('квитанція і звертання', { skip }, () => {
  test('імʼя за замовчуванням = частина пошти до @ → «Привіт!», ніколи «Привіт, <login>!»', async () => {
    const u = signUp({ email: 'dianatest97@test.local' })
    assert.equal(pg(`select display_name from public.profiles where user_id = ${q(u)}`), 'dianatest97')
    const { last } = await checkout(u, { autopay: true })
    await webhook({ orderId: last!.orderId, status: 'paid', cardToken: 'tok-r' })
    const receipt = outbox.find((m) => m.to === 'dianatest97@test.local' && m.subject.startsWith('Квитанція:'))!
    assert.ok(receipt.text.startsWith('Привіт!\n'))
    assert.doesNotMatch(receipt.text, /dianatest97(?!@)/)
  })

  test('справжнє імʼя з профілю → «Привіт, Олено!»; квитанція: тариф, сума, дата, діє до, що входить, кабінет, реквізити', async () => {
    const u = signUp()
    pg(`update public.profiles set display_name = 'Олено' where user_id = ${q(u)}`)
    const { last } = await checkout(u, { autopay: true })
    await webhook({ orderId: last!.orderId, status: 'paid', cardToken: 'tok-o' })
    const r = outbox.find((m) => m.subject.startsWith('Квитанція:'))!
    assert.equal(r.subject, 'Квитанція: 129 ₴ — тариф «Базовий», проЯв')
    assert.ok(r.text.startsWith('Привіт, Олено!\n'))
    for (const re of [
      /Тариф: «Базовий», 100 ГБ/,
      /Сума: 129 ₴/,
      /Дата оплати: \d{2}\.\d{2}\.\d{4}/,
      /Діє до: \d{2}\.\d{2}\.\d{4}/,
      /Що входить:\n• 100 ГБ сховища/,
      /• Відео в галереях/,
      /Автопродовження увімкнене: наступне списання/,
      /Відкрити кабінет: https:\/\/proiav\.test\/uk\/dashboard\/billing/,
      /ФОП Гоголь Діана Іванівна/,
      /hello@proiav\.space/,
    ]) {
      assert.match(r.text, re)
    }
  })
})

describe('лист за 3 дні до автосписання', { skip }, () => {
  function sub(userId: string, inDays: number, status = 'active') {
    return pg(`insert into public.billing_subscriptions (user_id, product, plan, period, provider, card_token, next_charge_at, status)
               values (${q(userId)}, 'gallery', 'basic', 'month', 'monobank', 'tok', now() + interval '${inDays} days', ${q(status)})
               returning id`)
  }
  const email = (u: string) => pg(`select email from auth.users where id = ${q(u)}`)

  test('за 2,5 дні → один лист із сумою, датою і кнопкою «Скасувати»; повторний запуск — без листа', async () => {
    const u = signUp()
    sub(u, 2.5)
    const res = await renewCron()
    assert.ok((res.renewalNotices as number) >= 1)
    const mine = outbox.filter((m) => m.to === email(u))
    assert.equal(mine.length, 1)
    assert.match(mine[0].subject, /^Через 3 дні — автопродовження тарифу «Базовий», 129 ₴$/)
    assert.match(mine[0].text, /спишемо 129 ₴ зі збереженої картки/)
    assert.match(mine[0].text, /Скасувати автопродовження: https:\/\/proiav\.test\/uk\/dashboard\/billing#autopay/)
    outbox.length = 0
    await renewCron()
    assert.equal(outbox.filter((m) => m.to === email(u)).length, 0)
  })

  test('списання за 5 днів або скасована підписка — листа нема', async () => {
    const far = signUp()
    sub(far, 5)
    const canceled = signUp()
    sub(canceled, 2, 'canceled')
    await renewCron()
    assert.equal(outbox.filter((m) => m.to === email(far) || m.to === email(canceled)).length, 0)
  })

  test('Brevo лежить → журнал не пишеться, наступного дня лист іде', async () => {
    const u = signUp()
    const id = sub(u, 2)
    mailer.down = true
    await renewCron()
    assert.equal(pg(`select count(*) from public.renewal_notices where subscription_id = ${q(id)}`), '0')
    mailer.down = false
    await renewCron()
    assert.equal(outbox.filter((m) => m.to === email(u)).length, 1)
  })
})

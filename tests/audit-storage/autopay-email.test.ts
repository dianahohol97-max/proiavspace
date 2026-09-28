/**
 * Auto-renewal consent and the e-mails (29.09.2026) — no database: what goes
 * to Brevo and to the payment providers, the greeting, the receipt / renewal
 * texts, the offer. The end-to-end part is tests/referrals/autopay-consent.test.ts.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, test } from 'node:test'
import { greetingName, hello, renderHtml, supportEmail } from '@/lib/email-layout'
import { sendEmailDetailed } from '@/lib/email'
import { receiptEmail, renewalNoticeEmail } from '@/lib/lifecycle-emails'
import { rewardEmail } from '@/lib/referral-emails'
import { LiqPayProvider } from '@/lib/payments/LiqPayProvider'
import { MonobankProvider } from '@/lib/payments/MonobankProvider'
import { getLegalCopy } from '@/lib/legal/copy'

const root = path.resolve(__dirname, '../..')
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.BREVO_API_KEY
  delete process.env.EMAIL_FROM
})

function captureFetch(response: unknown = { ok: true }) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response(JSON.stringify(response), { status: 200 })
  }) as never
  return calls
}

describe('звертання', () => {
  test('імʼя з профілю — так; частина пошти до @ (з +тегом чи без) або адреса — ні', () => {
    assert.equal(greetingName('Олена', 'olena.k@gmail.com'), 'Олена')
    assert.equal(greetingName('dianahohol97', 'dianahohol97@gmail.com'), null)
    assert.equal(greetingName('DianaHohol97', 'dianahohol97@gmail.com'), null)
    assert.equal(greetingName('anna', 'anna+proiav@gmail.com'), null)
    assert.equal(greetingName('a@b.c', 'x@y.z'), null)
    assert.equal(greetingName('  ', 'x@y.z'), null)
    assert.equal(hello(null), 'Привіт!')
    assert.equal(hello('Олено'), 'Привіт, Олено!')
  })

  test('реферальний лист: «Привіт, <імʼя>!» або «Привіт!», далі текст', () => {
    const named = rewardEmail({ to: 'x@y.z', locale: 'uk', name: 'Марта', amountKop: 1290, isAmbassador: false, first: true })
    assert.ok(named.text.startsWith('Привіт, Марта!\n\nФотограф, який прийшов'))
    const anon = rewardEmail({ to: 'x@y.z', locale: 'uk', amountKop: 1290, isAmbassador: false, first: true })
    assert.ok(anon.text.startsWith('Привіт!\n\n'))
    const en = rewardEmail({ to: 'x@y.z', locale: 'en', name: null, amountKop: 1290, isAmbassador: false, first: true })
    assert.ok(en.text.startsWith('Hi!\n\n'))
  })

  test('у жодному листі проЯв звертання не будується з пошти', () => {
    const sources = ['src/lib/lifecycle-emails.ts', 'src/lib/lifecycle-notify.ts', 'src/lib/referral-emails.ts', 'src/app/api/billing/renew/route.ts']
    for (const file of sources) {
      const code = readFileSync(path.join(root, file), 'utf8')
      assert.doesNotMatch(code, /split\(['"]@['"]\)/, file)
    }
  })
})

describe('Brevo: що йде в API', () => {
  test('є і текстова, і HTML-частина; HTML — повний документ з реквізитами; Reply-To — підтримка', async () => {
    process.env.BREVO_API_KEY = 'k'
    process.env.EMAIL_FROM = 'проЯв <hello@proiav.space>'
    const calls = captureFetch({ messageId: '1' })
    const r = await sendEmailDetailed({ to: 'a@b.c', subject: 'Тема', text: 'Привіт!\n\nРядок https://proiav.space/uk' })
    assert.equal(r.ok, true)
    const body = calls[0].body as { textContent: string; htmlContent: string; replyTo: { email: string }; sender: { name: string; email: string } }
    assert.equal(body.textContent, 'Привіт!\n\nРядок https://proiav.space/uk')
    assert.match(body.htmlContent, /^<!doctype html><html lang="uk">/)
    assert.match(body.htmlContent, /<title>Тема<\/title>/)
    assert.match(body.htmlContent, /<a href="https:\/\/proiav\.space\/uk"/)
    assert.match(body.htmlContent, /ФОП Гоголь Діана Іванівна/)
    assert.deepEqual(body.replyTo, { email: supportEmail() })
    assert.deepEqual(body.sender, { name: 'проЯв', email: 'hello@proiav.space' })
  })

  test('лист зі своїм HTML (квитанція) відправляє саме його', async () => {
    process.env.BREVO_API_KEY = 'k'
    process.env.EMAIL_FROM = 'hello@proiav.space'
    const calls = captureFetch()
    const m = renewalNoticeEmail({ name: null, plan: 'basic', period: 'month', amountUah: 129, chargeAt: new Date('2026-10-28T06:00:00Z') })
    await sendEmailDetailed({ to: 'a@b.c', ...m })
    assert.equal(calls[0].body.htmlContent, m.html)
    assert.equal(calls[0].body.textContent, m.text)
  })
})

describe('платіжні провайдери: картку зберігаємо лише зі згодою', () => {
  const base = {
    orderId: 'o1', amount: 129, currency: 'UAH' as const, description: 'd', period: 'month' as const,
    resultUrl: 'https://proiav.space/uk/dashboard/billing', serverUrl: 'https://proiav.space/api/billing/webhook', language: 'uk' as const,
  }

  test('Monobank: без customerId — жодного saveCardData', async () => {
    const calls = captureFetch({ pageUrl: 'https://pay.mbnk.biz/x' })
    await new MonobankProvider('t').createCheckoutForm(base)
    assert.equal('saveCardData' in calls[0].body, false)
  })

  test('Monobank: зі згодою — saveCardData з walletId = user_id', async () => {
    const calls = captureFetch({ pageUrl: 'https://pay.mbnk.biz/x' })
    await new MonobankProvider('t').createCheckoutForm({ ...base, customerId: 'user-1', autopay: true })
    assert.deepEqual(calls[0].body.saveCardData, { saveCard: true, walletId: 'user-1' })
  })

  test('LiqPay: без згоди — разова оплата, зі згодою — підписка', async () => {
    const decode = (f: { fields: Record<string, string> }) => JSON.parse(Buffer.from(f.fields.data, 'base64').toString())
    const lp = new LiqPayProvider('pub', 'priv')
    assert.equal(decode(await lp.createCheckoutForm(base)).action, 'pay')
    const sub = decode(await lp.createCheckoutForm({ ...base, autopay: true }))
    assert.equal(sub.action, 'subscribe')
    assert.equal(sub.subscribe_periodicity, 'month')
  })
})

describe('сторінка тарифів', () => {
  const ui = readFileSync(path.join(root, 'src/components/BillingPlans.tsx'), 'utf8')
  const uk = readFileSync(path.join(root, 'src/lib/i18n/dictionaries/uk.ts'), 'utf8')

  test('чекбокс «Автопродовження» біля кнопки, увімкнений за замовчуванням, його значення йде в checkout', () => {
    assert.match(ui, /type="checkbox"/)
    assert.match(ui, /checked=\{!autopayOff\[card\.id\]\}/)
    assert.match(ui, /useState<Record<string, boolean>>\(\{\}\)/) // nothing off → all on
    assert.match(ui, /autopay: !autopayOff\[planId\]/)
    assert.match(uk, /autopayLabel: 'Автопродовження: \{price\} ₴ \{every\}, можна скасувати будь-коли в кабінеті'/)
    assert.match(uk, /Автопродовження недоступне для Google Pay \/ Apple Pay/)
  })
})

describe('тексти: квитанція, «через 3 дні», оферта', () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`)

  test('квитанція: тариф, сума, дата оплати, діє до, що входить, кабінет, реквізити; HTML з кнопкою', () => {
    const m = receiptEmail({
      name: null, plan: 'plus', period: 'year', paidAt: d('2026-09-28'), periodStart: d('2026-09-28'), periodEnd: d('2027-09-28'),
      amountUah: 5190, creditUah: 0, provider: 'monobank', orderId: 'o-9', nextChargeAt: d('2027-09-28'), nextChargeUah: 5190,
    })
    assert.equal(m.subject, 'Квитанція: 5190 ₴ — тариф «Плюс», проЯв')
    for (const re of [/^Привіт!\n/, /Тариф: «Плюс», 500 ГБ/, /Дата оплати: 28\.09\.2026/, /Діє до: 28\.09\.2027/, /• Статистика переглядів/, /За 3 дні до нього надішлемо нагадування/, /ФОП Гоголь Діана Іванівна/]) {
      assert.match(m.text, re)
    }
    assert.match(m.html!, /Відкрити кабінет<\/a>/)
    assert.match(m.html!, /<td[^>]*>Діє до<\/td>/)
  })

  test('«через 3 дні»: сума, дата, кнопка «Скасувати автопродовження» → кабінет', () => {
    const m = renewalNoticeEmail({ name: 'Олено', plan: 'basic', period: 'month', amountUah: 129, chargeAt: d('2026-10-28') })
    assert.match(m.text, /^Привіт, Олено!/)
    assert.match(m.text, /28\.10\.2026 спишемо 129 ₴/)
    assert.match(m.html!, /href="https:\/\/proiav\.space\/uk\/dashboard\/billing#autopay"[^>]*>Скасувати автопродовження<\/a>/)
  })

  test('оферта описує позначку, суму й періодичність, лист за 3 дні, скасування, Google/Apple Pay', () => {
    const text = getLegalCopy('uk').oferta.sections.flatMap((s) => s.paragraphs).join('\n')
    assert.match(text, /позначкою «Автопродовження» біля кнопки оплати/)
    assert.match(text, /За 3 дні до кожного автоматичного списання/)
    assert.match(text, /Скасувати автопродовження можна будь-коли в кабінеті/)
    assert.match(text, /Google Pay або Apple Pay не зберігає картку/)
    const en = getLegalCopy('en').oferta.sections.flatMap((s) => s.paragraphs).join('\n')
    assert.match(en, /Three days before every automatic charge/)
  })

  test('пошта підтримки всюди hello@proiav.space: листи, оферта, політика конфіденційності (uk/en)', () => {
    assert.equal(supportEmail(), 'hello@proiav.space')
    for (const locale of ['uk', 'en']) {
      const copy = getLegalCopy(locale)
      const all = [copy.oferta, copy.privacy].flatMap((doc) => doc.sections.flatMap((s) => s.paragraphs)).join('\n')
      assert.match(all, /hello@proiav\.space/)
      assert.doesNotMatch(all, /gmail\.com/)
    }
  })

  test('HTML-шаблон екранує текст', () => {
    const html = renderHtml({ greeting: 'Привіт!', lead: ['<script>x</script>'] }, 'T')
    assert.doesNotMatch(html, /<script>/)
  })
})

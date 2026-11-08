import { expect, test, type Page } from '@playwright/test'
import { E2E_USER, resetDb, signIn } from './support/session'

/**
 * Підтримка: «Допомога» в кабінеті (десктоп — бокове меню, телефон — меню ☰)
 * і публічна /contact. Відправлення перехоплене в браузері (листи й база не
 * потрібні): перевіряємо, що саме форма надсилає, і що фотограф бачить
 * підтвердження. Справжній маршрут /api/support — окремо, запитами.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function fakeSupportApi(page: Page) {
  const sent: Record<string, unknown>[] = []
  await page.route('**/api/support/uploads', async (route) => {
    const body = route.request().postDataJSON() as { files: { type: string }[] }
    await route.fulfill({
      json: {
        uploads: body.files.map((_, i) => ({
          key: `support/${E2E_USER.id}/aaaaaaaa-bbbb-4ccc-8ddd-00000000000${i}.png`,
          url: `/__e2e-support-put/${i}`,
        })),
      },
    })
  })
  await page.route('**/__e2e-support-put/**', (route) => route.fulfill({ status: 200, body: '' }))
  await page.route('**/api/support', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    sent.push(body)
    await route.fulfill({ json: { ok: true, email: (body.email as string | undefined) ?? E2E_USER.email } })
  })
  return sent
}

test.describe('кабінет: «Допомога»', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(info.project.name === 'android', 'кабінет перевіряємо на десктопі й iPhone')
    await resetDb('full')
    await signIn(context, baseURL!)
  })

  test('відкрити, написати зі скриншотом, надіслати й побачити підтвердження', async ({ page }, info) => {
    const sent = await fakeSupportApi(page)
    await page.goto('/uk/dashboard/settings')

    if (info.project.name === 'iphone') {
      await page.getByRole('button', { name: 'Мої галереї' }).click()
    }
    await page.getByTestId('support-open').filter({ visible: true }).click()

    const panel = page.getByTestId('support-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('support-mailto')).toHaveAttribute('href', 'mailto:hello@proiav.space')
    await expect(panel.getByTestId('support-mailto')).toHaveText('Написати на пошту')

    // Без тексту — зрозуміла підказка, нічого не пішло.
    await panel.getByTestId('support-submit').click()
    await expect(panel.getByTestId('support-error')).toContainText('Напишіть хоч кілька слів')
    expect(sent).toHaveLength(0)

    // Що саме ми передаємо — видно до відправки.
    await panel.getByText('Показати, що саме').click()
    const ctx = panel.getByTestId('support-context')
    await expect(ctx).toContainText(E2E_USER.email)
    await expect(ctx).toContainText(E2E_USER.id)
    await expect(ctx).toContainText('/uk/dashboard/settings')

    await panel.getByText('Оплата і тариф').click()
    await panel.getByTestId('support-message').fill('Не бачу оплату за листопад.')
    await panel.getByTestId('support-files').setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: PNG })
    await expect(panel.getByText('screen.png')).toBeVisible()
    await panel.getByTestId('support-submit').click()

    await expect(panel.getByTestId('support-thanks')).toContainText(`Дякуємо! Відповімо на ${E2E_USER.email} протягом доби.`)
    expect(sent).toHaveLength(1)
    const body = sent[0] as { topic: string; message: string; attachments: string[]; context: Record<string, string>; email?: string }
    expect(body.topic).toBe('billing')
    expect(body.message).toBe('Не бачу оплату за листопад.')
    expect(body.email).toBeUndefined()
    expect(body.attachments).toEqual([`support/${E2E_USER.id}/aaaaaaaa-bbbb-4ccc-8ddd-000000000000.png`])
    expect(body.context.url).toContain('/uk/dashboard/settings')
    expect(body.context.language).toBe('uk')
    expect(body.context.viewport).toMatch(/^\d+×\d+$/)

    await panel.getByRole('button', { name: 'Закрити', exact: true }).last().click()
    await expect(panel).toBeHidden()
  })

  test('не той файл — підказка, без завантаження', async ({ page }, info) => {
    await fakeSupportApi(page)
    await page.goto('/uk/dashboard')
    if (info.project.name === 'iphone') await page.getByRole('button', { name: 'Мої галереї' }).click()
    await page.getByTestId('support-open').filter({ visible: true }).click()
    await page
      .getByTestId('support-files')
      .setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
    await expect(page.getByTestId('support-error')).toContainText('лише png, jpg або webp')
  })
})

test.describe('публічна сторінка «Контакти»', () => {
  test('форма з email; підтвердження після відправки; ліміт — зрозуміле повідомлення', async ({ page }) => {
    const sent = await fakeSupportApi(page)
    await page.goto('/uk/contact')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Напишіть нам')

    await page.getByTestId('support-message').fill('Чи можна оплатити рахунком для ФОП?')
    await page.getByTestId('support-submit').click()
    await expect(page.getByTestId('support-error')).toContainText('email')

    await page.getByLabel('Ваш email').fill('guest@example.com')
    await page.getByTestId('support-submit').click()
    await expect(page.getByTestId('support-thanks')).toContainText('Відповімо на guest@example.com')
    expect(sent[0]).toMatchObject({ email: 'guest@example.com', website: '', topic: 'question' })

    // Ліміт на IP.
    await page.unroute('**/api/support')
    await page.route('**/api/support', (route) => route.fulfill({ status: 429, json: { error: 'rate_limited' } }))
    await page.getByRole('button', { name: 'Написати ще' }).click()
    await page.getByLabel('Ваш email').fill('guest@example.com')
    await page.getByTestId('support-message').fill('Ще одне питання')
    await page.getByTestId('support-submit').click()
    await expect(page.getByTestId('support-error')).toContainText('Забагато звернень за годину')
  })

  test('honeypot прихований від людей', async ({ page }) => {
    await page.goto('/uk/contact')
    const honeypot = page.locator('input[name="website"]')
    // Off screen (not display:none — some bots skip hidden fields) and out of
    // the accessibility tree and the tab order.
    const box = await honeypot.boundingBox()
    expect(box!.x + box!.width).toBeLessThan(0)
    await expect(honeypot).toHaveAttribute('tabindex', '-1')
    await expect(page.locator('[aria-hidden="true"]:has(input[name="website"])')).toHaveCount(1)
  })

  test('посилання «Підтримка» в підвалі лендингу й сторінки тарифів', async ({ page }) => {
    for (const path of ['/uk', '/uk/tsiny']) {
      await page.goto(path)
      await expect(page.locator('footer a[href="/uk/contact"]')).toBeVisible()
    }
  })
})

test.describe('маршрут /api/support на справжньому сервері', () => {
  test('порожній текст → 400, honeypot → 200 без доставки', async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'одного разу досить')
    const empty = await request.post('/api/support', { data: { topic: 'bug', message: ' ', email: 'g@example.com' } })
    expect(empty.status()).toBe(400)
    expect(await empty.json()).toEqual({ error: 'empty_message' })

    const bot = await request.post('/api/support', {
      data: { topic: 'bug', message: 'buy now', email: 'bot@example.com', website: 'http://spam' },
    })
    expect(bot.status()).toBe(200)
    expect(await bot.json()).toEqual({ ok: true })
  })
})

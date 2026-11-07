import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { dbState, E2E_USER, insertRow, resetDb, signIn } from './support/session'

/**
 * Кабінет фотографа, головний шлях: Створити → Завантажити → Оформити →
 * Поділитися — на справжніх сторінках /dashboard проти фейкового Supabase
 * (tests/e2e/support/fake-supabase.mjs). Сховище в браузері підмінене:
 * presign/PUT/complete перехоплюються, а «complete» додає рядок фото у
 * фейкову базу, як це зробив би сервер.
 */
const SHOTS = process.env.DASHBOARD_SHOTS_DIR ?? join('test-results', 'dashboard')

test.beforeEach(async ({ context, baseURL }, info) => {
  test.skip(info.project.name === 'android', 'кабінет перевіряємо на десктопі й iPhone')
  await signIn(context, baseURL!)
})

async function noHorizontalOverflow(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

async function shot(page: Page, name: string, project: string, fullPage = true) {
  mkdirSync(SHOTS, { recursive: true })
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: join(SHOTS, `${name}-${project}.png`), fullPage })
}

/** Storage in the browser: presign → same-origin PUT → complete inserts the asset row. */
async function fakeStorage(page: Page) {
  let n = 0
  await page.route('**/api/uploads/presign', async (route) => {
    const body = route.request().postDataJSON() as { galleryId: string; fileName: string; variant?: string }
    const kind = body.variant ? `v/${String((n++ % 15) + 1).padStart(2, '0')}-${n}-${body.variant}.jpg` : `o/${n++}-${body.fileName}`
    const key = `u/${E2E_USER.id}/g/${body.galleryId}/${kind}`
    await route.fulfill({ json: { uploadUrl: `/__e2e-put/${encodeURIComponent(key)}`, key } })
  })
  await page.route('**/__e2e-put/**', (route) => route.fulfill({ status: 200, body: '' }))
  await page.route('**/api/uploads/complete', async (route) => {
    const body = route.request().postDataJSON() as {
      galleryId: string
      key: string
      contentType: string
      sizeBytes: number
      variants: Record<string, string>
    }
    const state = await dbState()
    const position = state.assets.filter((a) => a.gallery_id === body.galleryId).length
    const row = await insertRow('assets', {
      gallery_id: body.galleryId,
      owner_id: E2E_USER.id,
      r2_key: body.key,
      kind: 'photo',
      content_type: body.contentType,
      size_bytes: body.sizeBytes,
      variants: body.variants,
      position,
      hidden_from_client: false,
    })
    await route.fulfill({ json: { assetId: row.id } })
  })
}

test.describe('кабінет: головний шлях', () => {
  test('новий фотограф: порожній стан → форма → фото → дизайн → поділитися', async ({ page }, info) => {
    await resetDb('empty')
    await fakeStorage(page)

    // 1. Порожній список: зрозуміла підказка з трьома кроками.
    await page.goto('/uk/dashboard')
    const empty = page.getByTestId('empty-state')
    await expect(empty).toContainText('Створіть першу галерею')
    await expect(empty.locator('ol li')).toHaveCount(3)
    await noHorizontalOverflow(page)
    await shot(page, '01-empty', info.project.name)
    await empty.getByTestId('new-gallery').click()

    // 2. Коротка форма: лише назва й дата; порожня назва → зрозуміла помилка.
    const form = page.getByTestId('new-gallery-form')
    await expect(form.locator('input, textarea, select')).toHaveCount(2)
    await form.getByRole('button', { name: /Створити й додати фото/ }).click()
    await expect(form.getByRole('alert')).toHaveText('Вкажіть назву галереї — її побачить клієнт.')
    await form.getByLabel('Назва галереї').fill('Олена і Тарас · заручини')
    await form.locator('#event_date').fill('2026-10-18')
    await noHorizontalOverflow(page)
    await shot(page, '02-new', info.project.name)
    await form.getByRole('button', { name: /Створити й додати фото/ }).click()

    // 3. Одразу вкладка «Фото» з підказкою і рамкою завантаження.
    await page.waitForURL(/\/dashboard\/galleries\/[^/?]+\?tab=photos&created=1/)
    await expect(page.getByTestId('hint-created')).toBeVisible()
    await expect(page.getByRole('tab', { name: /Фото/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('publish-status')).toHaveText('Чернетка')
    const created = (await dbState()).galleries.find((g) => g.title === 'Олена і Тарас · заручини')
    expect(created?.event_date).toBe('2026-10-18')

    await page.locator('input[type=file]').setInputFiles([
      join('public', 'showcase', '03.jpg'),
      join('public', 'showcase', '07.jpg'),
    ])
    await expect(page.getByTestId('upload-progress')).toHaveText('Завантажено 2 з 2', { timeout: 30_000 })
    await expect(page.getByTestId('photo-grid').locator('> div')).toHaveCount(2, { timeout: 30_000 })

    // 4. Після першої дії — підказка «що далі», без туторіалу.
    const next = page.getByTestId('hint-uploaded')
    await expect(next).toBeVisible()
    await noHorizontalOverflow(page)
    await shot(page, '03-photos', info.project.name)
    await next.getByRole('button', { name: 'Оформити' }).click()
    await expect(page.getByRole('tab', { name: 'Дизайн' })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=design/)
    const details = page.getByTestId('details-form')
    await details.getByLabel('Опис для клієнта (необовʼязково)').fill('Львів, Високий замок')
    await details.getByRole('button', { name: 'Зберегти' }).click()
    await expect(details.getByRole('status')).toHaveText('Збережено ✓')
    expect((await dbState()).galleries.find((g) => g.id === created?.id)?.description).toBe('Львів, Високий замок')

    // 5. «Поділитися» видно нагорі завжди; чернетку пропонує опублікувати.
    await page.mouse.wheel(0, 2000)
    await expect(page.getByTestId('share-open')).toBeInViewport()
    await page.getByTestId('share-open').click()
    const dialog = page.getByTestId('share-dialog')
    await expect(dialog.getByTestId('share-draft')).toBeVisible()
    await dialog.getByRole('button', { name: 'Опублікувати' }).click()
    await expect(dialog.getByRole('status')).toHaveText('Опубліковано ✓ Посилання вже працює.')
    expect((await dbState()).galleries.find((g) => g.id === created?.id)?.is_published).toBe(true)

    const url = dialog.locator('#share-url')
    await expect(url).toHaveValue(new RegExp(`/uk/g/${created?.slug}$`))
    await expect(dialog.locator('#share-message')).toHaveValue(/^Вітаю! Ваша галерея «Олена і Тарас · заручини» готова:/)
    await expect(dialog.getByTestId('share-qr').locator('svg path')).toHaveCount(1)
    await expect(dialog.getByTestId('share-password')).toHaveCount(0)
    await dialog.getByTestId('share-copy').click()
    await expect(dialog.getByTestId('share-copy')).toHaveText('Скопійовано ✓')

    // Мова посилання → і посилання, і готовий текст мовою клієнта.
    await dialog.getByLabel('Мова галереї для клієнта').selectOption('pl')
    await expect(url).toHaveValue(/\/pl\/g\//)
    await expect(dialog.locator('#share-message')).toHaveValue(/^Dzień dobry! Twoja galeria „Олена і Тарас · заручини” jest gotowa:/)
    const telegram = await dialog.locator('[data-channel=telegram]').getAttribute('href')
    expect(telegram).toContain('https://t.me/share/url?url=')
    expect(decodeURIComponent(telegram!)).toContain('/pl/g/')
    expect(await dialog.locator('[data-channel=whatsapp]').getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(await dialog.locator('[data-channel=viber]').getAttribute('href')).toMatch(/^viber:\/\/forward\?text=/)
    expect(await dialog.locator('[data-channel=email]').getAttribute('href')).toMatch(/^mailto:\?subject=Twoja%20galeria/)
    await noHorizontalOverflow(page)
    await shot(page, '04-share', info.project.name, false)
    await dialog.getByRole('button', { name: 'Закрити' }).first().click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('publish-status')).toHaveText('Опубліковано')

    // 6. Назад у список: галерея там, з фото й швидкими діями.
    await page.getByRole('link', { name: /Усі галереї/ }).click()
    const card = page.getByTestId('gallery-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Олена і Тарас · заручини')
    await expect(card).toContainText('2 фотографій')
    await expect(card.getByTestId('card-copy')).toBeVisible()
  })

  test('пароль: у вікні нагадування, а в тексті клієнту — що пароль прийде окремо', async ({ page }) => {
    await resetDb('full')
    await page.goto('/uk/dashboard/galleries/11111111-1111-4111-8111-111111111111?share=1')
    const dialog = page.getByTestId('share-dialog')
    await expect(dialog.getByTestId('share-password')).toContainText('надішліть його клієнту окремим повідомленням')
    await expect(dialog.locator('#share-message')).toHaveValue(/Галерея захищена паролем — надішлю його окремим повідомленням\.$/)
    await dialog.getByLabel('Мова галереї для клієнта').selectOption('de')
    await expect(dialog.locator('#share-message')).toHaveValue(/passwortgeschützt/)
  })

  test('галерея в обробці: текст клієнту каже, що фото зʼявляться за тим самим посиланням', async ({ page }) => {
    await resetDb('full')
    await page.goto('/uk/dashboard/galleries/22222222-2222-4222-8222-222222222222?share=1')
    await expect(page.getByTestId('share-dialog').locator('#share-message')).toHaveValue(/Зараз фото в обробці/)
  })
})

test.describe('кабінет: список галерей', () => {
  test('пошук, сортування, швидкі дії на картці', async ({ page }, info) => {
    await resetDb('full')
    await page.goto('/uk/dashboard')
    const cards = page.getByTestId('gallery-card')
    await expect(cards).toHaveCount(4)
    await noHorizontalOverflow(page)
    await shot(page, '05-list', info.project.name)

    await page.getByTestId('gallery-search').fill('карпат')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Сімейна прогулянка в Карпатах')
    await page.getByTestId('gallery-search').fill('нема такої')
    await expect(page.getByRole('status')).toContainText('Нічого не знайшлося')
    await page.getByTestId('gallery-search').fill('')

    await page.getByTestId('gallery-sort').selectOption('title')
    await expect(cards.first()).toContainText('Аня · портрет у студії')
    await page.getByTestId('gallery-sort').selectOption('shoot')
    await expect(cards.first()).toContainText('Аня · портрет у студії')
    await expect(cards.last()).toContainText('Хрещення Софійки')

    // Статус зйомки прямо з картки.
    const sofia = cards.filter({ hasText: 'Хрещення Софійки' })
    await sofia.getByTestId('card-delivery').selectOption('editing')
    await expect
      .poll(async () => (await dbState()).galleries.find((g) => g.title === 'Хрещення Софійки')?.delivery_status)
      .toBe('editing')

    // Опублікована — копіювати посилання; чернетка — «Поділитися» відкриває вікно.
    await sofia.getByTestId('card-copy').click()
    await expect(sofia.getByTestId('card-copy')).toHaveText('Скопійовано ✓')
    await cards.filter({ hasText: 'Аня' }).getByTestId('card-upload').click()
    await page.waitForURL(/tab=photos/)
    await expect(page.getByTestId('upload-drop')).toBeVisible()
  })

  test('меню: фотограф не бачить «Блог», «Хаб», «Контент», «Сторіс», «Threads»', async ({ page }, info) => {
    await resetDb('full')
    await page.goto('/uk/dashboard')
    // On a phone the menu sits behind ☰.
    if (info.project.name === 'iphone') await page.getByRole('button', { name: 'Мої галереї' }).click()
    const menu = page.locator('nav:visible')
    await expect(menu.getByRole('link', { name: 'Сайт', exact: true })).toBeVisible()
    for (const name of ['Блог', 'Хаб', 'Контент', 'Сторіс', 'Threads', 'Статистика']) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
    const response = await page.goto('/uk/dashboard/blog')
    expect(response?.status()).toBe(404)
  })
})

test.describe('кабінет: вкладки галереї', () => {
  test('Фото · Дизайн · Доступ · Клієнт; нагорі назва, статус і «Поділитися»', async ({ page }, info) => {
    await resetDb('full')
    await page.goto('/uk/dashboard/galleries/11111111-1111-4111-8111-111111111111')
    const header = page.getByTestId('gallery-header')
    await expect(header.locator('h1')).toHaveText('Марта і Богдан · весілля')
    await expect(header.getByTestId('publish-status')).toHaveText('Опубліковано')
    await expect(page.getByRole('tab')).toHaveText([/Фото\s*12/, 'Дизайн', 'Доступ', /Клієнт\s*5/])
    await noHorizontalOverflow(page)
    await shot(page, '06-gallery-photos', info.project.name, false)

    await page.getByRole('tab', { name: 'Доступ' }).click()
    const access = page.getByTestId('access-form')
    await expect(page.locator('[data-panel=photos]')).toBeHidden()
    await access.getByLabel(/Пароль галереї/).fill('marta2026')
    await access.getByRole('button', { name: 'Зберегти' }).click()
    await expect(access.getByRole('status')).toHaveText('Збережено ✓')
    await expect(access.getByLabel(/Пароль галереї/)).toHaveValue('')
    await noHorizontalOverflow(page)
    await shot(page, '07-gallery-access', info.project.name)

    await page.getByRole('tab', { name: /Клієнт/ }).click()
    await expect(page.getByTestId('client-picks')).toContainText('В обраному клієнтів: 5')
    await noHorizontalOverflow(page)
    await shot(page, '08-gallery-client', info.project.name)

    await page.reload()
    await expect(page.getByRole('tab', { name: /Клієнт/ })).toHaveAttribute('aria-selected', 'true')
  })
})

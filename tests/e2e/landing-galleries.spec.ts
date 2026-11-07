import { expect, test, type Page } from '@playwright/test'

/**
 * Landing: the «new in galleries» cards (AI culling, shoot status, reliable
 * upload) with real interface screenshots, no sites/booking on the page, and
 * the «Як це працює» help next to the features (on the database-free pages
 * that mirror the dashboard).
 */

async function noHorizontalOverflow(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

for (const locale of ['uk', 'en'] as const) {
  test(`лендинг /${locale}: три нові можливості зі скріншотами, без сайтів і бронювання`, async ({ page }) => {
    await page.goto(`/${locale}`)
    const shots = page.locator('#products img')
    await expect(shots).toHaveCount(3)
    for (const [index, name] of ['culling', 'status', 'upload'].entries()) {
      const img = shots.nth(index)
      await expect(img).toHaveAttribute('src', `/landing/${name}-${locale}.webp`)
      await expect(img).toHaveAttribute('loading', 'lazy')
      expect((await img.getAttribute('alt'))?.length ?? 0).toBeGreaterThan(20)
      await img.scrollIntoViewIfNeeded()
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(960)
    }
    const text = await page.locator('main').innerText()
    const titles =
      locale === 'uk'
        ? ['AI-відбір', 'Статус зйомки', 'Надійне завантаження']
        : ['AI culling', 'Shoot status', 'Reliable upload']
    for (const title of titles) expect(text).toContain(title)
    const banned = locale === 'uk' ? /бронюв|заброн|слот|сайт для фотограф|сайти/i : /booking|double-book|slot|photographer site/i
    expect(text).not.toMatch(banned)
    await noHorizontalOverflow(page)
  })
}

test('/en: у макеті героя немає слотів із цінами', async ({ page }) => {
  await page.goto('/en')
  await expect(page.locator('header')).not.toContainText('₴')
})

test('llms.txt: без бронювання, з відбором і статусом', async ({ request }) => {
  const body = await (await request.get('/llms.txt')).text()
  expect(body).not.toMatch(/бронюв/i)
  expect(body).toContain('AI-відбір')
  expect(body).toContain('Статус зйомки')
})

test.describe('довідка «Як це працює»', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'звичайний <details> — досить десктопа')
  })

  test('відбір кадрів: згорнута, відкривається, каже, що нічого не ховається само', async ({ page }) => {
    await page.goto('/uk/gallery-demo/culling?n=4')
    const help = page.getByTestId('help-culling')
    await expect(help).toBeVisible()
    await expect(help.locator('li').first()).toBeHidden()
    await help.locator('summary').click()
    await expect(help).toContainText('фото нікуди не надсилаються')
    await expect(help).toContainText('Сховати від клієнта')
  })

  test('статус для клієнта: поруч із перемикачем, англійською теж', async ({ page }) => {
    await page.goto('/uk/e2e/delivery/control')
    const help = page.getByTestId('help-delivery')
    await help.locator('summary').click()
    await expect(help).toContainText('Зйомка → Обробка → Готово')
    await page.goto('/en/e2e/delivery/control')
    await expect(page.getByTestId('help-delivery').locator('summary')).toHaveText('How the client sees the status')
  })
})

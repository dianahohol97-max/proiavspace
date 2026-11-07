import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'

/** «Розворот», through the test-only route /uk/e2e/themes/rozvorot. */
const URL = '/uk/e2e/themes/rozvorot'

cardSuite('rozvorot')

test.describe('тема «Розворот»: своє', () => {
  test('наведення на рядок напрямку змінює фото першого екрана (без JS)', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'наведення — десктоп')
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.goto(URL)
    const layer = page.locator('header [data-k="1"]').first()
    await expect.poll(() => layer.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.1)
    await page.locator('header a[data-k="1"]').hover()
    await expect.poll(() => layer.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9)
    await context.close()
  })

  test('розвороти по два кадри і рукописна цитата', async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('#portfolio blockquote')).toBeVisible()
    const pairs = await page.locator('#portfolio [class*=Spread_spread__]').evaluateAll((els) => els.map((el) => el.querySelectorAll('figure').length))
    expect(pairs.length).toBeGreaterThanOrEqual(3)
    expect(pairs.slice(0, -1).every((n) => n === 2)).toBe(true)
  })
})

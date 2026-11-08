import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Індекс», through the test-only route /uk/e2e/themes/indeks. */
const URL = '/uk/e2e/themes/indeks'

cardSuite('indeks')

test.describe('тема «Індекс»: своє', () => {
  test('індекс проєктів: номери, назви й кількість кадрів', async ({ page }) => {
    await page.goto(URL)
    const rows = page.locator('#portfolio ol a')
    expect(await rows.count()).toBeGreaterThanOrEqual(2)
    await expect(rows.first()).toContainText('01')
    await expect(rows.first()).toContainText(/\d+ кадрів/)
  })

  test('наведення на проєкт показує й перебирає його кадри', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'наведення — десктоп')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(URL)
    const row = page.locator('#portfolio ol a').first()
    await row.scrollIntoViewIfNeeded()
    await row.hover()
    const preview = row.locator('[class*=Index_preview__]')
    await expect.poll(() => preview.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9)
    const shown = () =>
      preview.locator('[class*=Index_previewImg__]').evaluateAll((els) => els.findIndex((el) => Number(getComputedStyle(el).opacity) > 0.5))
    const seen = new Set<number>()
    for (let i = 0; i < 12; i++) {
      seen.add(await shown())
      await page.waitForTimeout(150)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  test('імʼя на всю ширину в один рядок', async ({ page }) => {
    await page.goto(URL)
    await page.waitForTimeout(1500) // the tracking-in entrance
    const h1 = page.locator('header h1')
    const [w, cw, h, lh] = await h1.evaluate((el) => [el.scrollWidth, el.clientWidth, el.clientHeight, parseFloat(getComputedStyle(el).fontSize)])
    expect(w).toBeLessThanOrEqual(cw + 1)
    expect(h).toBeLessThan(lh * 1.5)
  })
})

import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Старт», through the test-only route /uk/e2e/themes/start. */
const URL = '/uk/e2e/themes/start'

cardSuite('start')

test.describe('тема «Старт»: своє', () => {
  test('десять кадрів — сітка без дірок, усі 4:5', async ({ page }) => {
    await page.goto(URL)
    const ratios = await page.locator('#portfolio figure [class*=Start_workImg__]').evaluateAll((els) =>
      els.map((el) => Math.round((el.clientWidth / el.clientHeight) * 100) / 100)
    )
    expect(ratios.length).toBeGreaterThanOrEqual(6)
    for (const r of ratios) expect(r).toBeCloseTo(0.8, 1)
  })

  test('маркер під прізвищем і кнопка запису на телефоні (липка)', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'липка кнопка — телефон')
    await page.goto(URL)
    const marker = page.locator('h1 [class*=Start_marker__]')
    await expect(marker).toBeVisible()
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    const dock = page.locator('[class*=Start_dockBtn__]')
    const box = await dock.boundingBox()
    const vh = page.viewportSize()!.height
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh)
    expect(box!.y).toBeGreaterThan(vh - 140)
  })
})

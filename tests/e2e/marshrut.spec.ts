import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Маршрут», through the test-only route /uk/e2e/themes/marshrut. */
const URL = '/uk/e2e/themes/marshrut'

cardSuite('marshrut')

test.describe('тема «Маршрут»: своє', () => {
  test('мапа на першому екрані: точки маршруту з датами й лінія між ними', async ({ page }) => {
    await page.goto(URL)
    const labels = await page.locator('header svg text').allTextContents()
    expect(labels).toContain('Карпати')
    expect(labels).toContain('12–14')
    await expect(page.locator('header svg path')).toHaveCount(1)
  })

  test('«Де я буду найближчим часом» — квитки біля форми, перший — поточний', async ({ page }) => {
    await page.goto(URL)
    const tickets = page.locator('#contact ol li')
    expect(await tickets.count()).toBeGreaterThanOrEqual(3)
    await expect(tickets.first()).toContainText('Карпати')
    await expect(page.locator('#contact')).toContainText('Де я буду')
  })

  test('без горизонтального переповнення через мапу на 375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(URL)
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(sw).toBeLessThanOrEqual(iw)
  })
})

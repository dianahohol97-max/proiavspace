import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Контакт», through the test-only route /uk/e2e/themes/kontakt. */
const URL = '/uk/e2e/themes/kontakt'

cardSuite('kontakt')

test.describe('тема «Контакт»: своє', () => {
  test('контрольний аркуш: кадри з кодами краю, найкращий кадр кожного напрямку обведено', async ({ page }) => {
    await page.goto(URL)
    const frames = page.locator('#contact-sheet > li')
    expect(await frames.count()).toBeGreaterThanOrEqual(8)
    await expect(frames.first()).toContainText('1A')
    const circles = await page.locator('#contact-sheet svg path').count()
    expect(circles).toBeGreaterThanOrEqual(2)
  })

  test('олівець домальовує коло під час прокрутки', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    await page.goto(URL)
    const path = page.locator('#contact-sheet svg path').first()
    const offset = () => path.evaluate((el) => Number(getComputedStyle(el).strokeDashoffset.replace('px', '')))
    expect(await offset()).toBeGreaterThan(0.5)
    await path.evaluate((el) => el.closest('li')!.scrollIntoView({ block: 'center' }))
    await expect.poll(offset).toBeLessThan(0.2)
  })
})

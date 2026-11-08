import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Ніжність», through the test-only route /uk/e2e/themes/nizhnist. */
const URL = '/uk/e2e/themes/nizhnist'

cardSuite('nizhnist', { gifts: true })

test.describe('тема «Ніжність»: своє', () => {
  test('«рік малюка»: кадри за віком по порядку, з підписами', async ({ page }) => {
    await page.goto(URL)
    const ages = await page.locator('#portfolio [class*=Tender_stepAge__]').allInnerTexts()
    expect(ages.length).toBeGreaterThanOrEqual(3)
    expect(ages[0]).toMatch(/міс|тиж|новонар/)
    expect(ages[ages.length - 1]).toMatch(/рік|р\./)
  })

  test('блок «Безпека на зйомці» біля цін', async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('#pricing aside')).toContainText('Безпека')
  })

  test('без горизонтального прокручування сторінки через стрічку на телефоні', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'телефон')
    await page.goto(URL)
    const ribbon = page.locator('#portfolio ol')
    const [sw, cw] = await ribbon.evaluate((el) => [el.scrollWidth, el.clientWidth])
    expect(sw).toBeGreaterThan(cw)
    const [dw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(dw).toBeLessThanOrEqual(iw)
  })
})

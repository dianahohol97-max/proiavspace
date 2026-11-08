import { expect, test } from '@playwright/test'
import { cardSuite, waitHydrated } from './card-checks'

/** «Портрет», through the test-only route /uk/e2e/themes/portret. */
const URL = '/uk/e2e/themes/portret'

cardSuite('portret')

test.describe('тема «Портрет»: своє', () => {
  test('слайдер «до/після»: стрілки клавіатури зсувають межу', async ({ page }) => {
    await page.goto(URL)
    const range = page.locator('#portfolio input[type=range]')
    await range.scrollIntoViewIfNeeded()
    await waitHydrated(page, '#portfolio input[type=range]')
    await expect(range).toHaveValue('50')
    await range.focus()
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
    await expect(range).toHaveValue('60')
    const clip = await page.locator('[class*=Studio_baBefore__]').evaluate((el) => getComputedStyle(el).clipPath)
    expect(clip).toContain('40%')
  })

  test('кадр «до» не потрапляє в сітку портфоліо', async ({ page }) => {
    await page.goto(URL)
    const alts = await page.locator('#portfolio figure img').evaluateAll((els) => els.map((el) => el.getAttribute('alt')))
    expect(alts).not.toContain('До ретуші')
  })

  test('«Як підготуватися» — список із галочками', async ({ page }) => {
    await page.goto(URL)
    const items = page.locator('#pricing aside li')
    expect(await items.count()).toBeGreaterThanOrEqual(2)
  })
})

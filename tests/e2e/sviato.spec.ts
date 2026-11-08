import { expect, test } from '@playwright/test'
import { cardSuite, waitHydrated } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Свято», through the test-only route /uk/e2e/themes/sviato. */
const URL = '/uk/e2e/themes/sviato'

cardSuite('sviato', { gifts: true })

test.describe('тема «Свято»: своє', () => {
  test('стрічка фотобудки: 4 кадри на першому екрані', async ({ page }) => {
    await page.goto(URL)
    await expect(page.locator('header [class*=Party_shot__]')).toHaveCount(4)
  })

  test('календар: вільна дата підставляється у форму', async ({ page }) => {
    await page.goto(URL)
    const free = page.locator('#contact [class*=Party_calFree__]').first()
    await expect(free).toBeVisible()
    await waitHydrated(page, '#contact form')
    await waitHydrated(page, '#contact [class*=Party_calFree__]')
    const label = await free.getAttribute('aria-label')
    expect(label).toContain('вільно')
    await free.click()
    await expect(page.locator('#contact input[name=date]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('reduced motion: конфеті не падає', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(URL)
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
    expect(running).toBe(0)
    await context.close()
  })
})

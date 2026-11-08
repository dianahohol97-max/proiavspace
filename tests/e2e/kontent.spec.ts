import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Контент», through the test-only route /uk/e2e/themes/kontent. */
const URL = '/uk/e2e/themes/kontent'

cardSuite('kontent')

test.describe('тема «Контент»: своє', () => {
  test('рілс на першому екрані грає сам: кадри змінюються без JS, смужки заповнюються', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 860 } })
    const page = await context.newPage()
    await page.goto(URL)
    const frames = page.locator('header [data-i]').filter({ has: page.locator('img, video') })
    expect(await frames.count()).toBeGreaterThanOrEqual(2)
    const visibleIndex = () =>
      frames.evaluateAll((els) => els.findIndex((el) => Number(getComputedStyle(el).opacity) > 0.9 && el.getAttribute('data-i') !== '0' ? true : false))
    await expect.poll(visibleIndex, { timeout: 8000 }).toBeGreaterThan(-1)
    await context.close()
  })

  test('reduced motion: рілс стоїть на першому кадрі', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(URL)
    await page.waitForTimeout(3500)
    const shown = await page
      .locator('header [data-i]')
      .filter({ has: page.locator('img, video') })
      .evaluateAll((els) => els.filter((el) => Number(getComputedStyle(el).opacity) > 0.5).map((el) => el.getAttribute('data-i')))
    expect(shown).toEqual(['0'])
    await context.close()
  })

  test('портфоліо — квадратна сітка профілю', async ({ page }) => {
    await page.goto(URL)
    const ratios = await page.locator('#portfolio figure').evaluateAll((els) => els.map((el) => Math.round((el.clientWidth / el.clientHeight) * 100) / 100))
    for (const r of ratios) expect(r).toBeCloseTo(1, 1)
  })
})

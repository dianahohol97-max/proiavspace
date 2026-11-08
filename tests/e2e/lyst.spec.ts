import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Лист», through the test-only route /uk/e2e/themes/lyst. */
const URL = '/uk/e2e/themes/lyst'

cardSuite('lyst')

test.describe('тема «Лист»: своє', () => {
  test('конверт: три фото виходять із нього; без JS видно всі', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(URL)
    await page.waitForTimeout(2200)
    const letters = page.locator('header [data-i]')
    await expect(letters).toHaveCount(3)
    for (const i of [0, 1, 2]) await expect(letters.nth(i)).toBeVisible()
    await context.close()
  })

  test('відгуки — листівки з маркою', async ({ page }) => {
    await page.goto(URL)
    const cards = page.locator('#reviews figure')
    expect(await cards.count()).toBeGreaterThanOrEqual(2)
    await expect(cards.first().locator('blockquote')).not.toHaveText('')
  })

  test('без рожевого: жоден фон/колір тексту не рожевий', async ({ page }) => {
    await page.goto(URL)
    const pink = await page.evaluate(() => {
      const isPink = (c: string) => {
        const m = c.match(/rgba?\((\d+), (\d+), (\d+)/)
        if (!m) return false
        const [r, g, b] = m.slice(1).map(Number)
        return r > 200 && b > 140 && g < r - 50 && b > g
      }
      return Array.from(document.querySelectorAll('main *, header *, section *'))
        .map((el) => getComputedStyle(el))
        .filter((cs) => isPink(cs.backgroundColor) || isPink(cs.color)).length
    })
    expect(pink).toBe(0)
  })
})

import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'

/** «Темна кімната», through the test-only route /uk/e2e/themes/temna. */
const URL = '/uk/e2e/themes/temna'

cardSuite('temna')

test.describe('тема «Темна кімната»: своє', () => {
  test('відбитки висять на мотузці з прищіпками', async ({ page }) => {
    await page.goto(URL)
    const hangs = page.locator('#lab-line > li')
    expect(await hangs.count()).toBeGreaterThanOrEqual(6)
    await expect(hangs.first().locator('[class*=Lab_peg__]')).toHaveCount(1)
  })

  test('відбиток проявляється з білого під час прокрутки', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    await page.goto(URL)
    const img = page.locator('#lab-line img').first()
    // brightness() of the filter: > 1 while the print is still white
    const brightness = () =>
      img.evaluate((el) => {
        const f = getComputedStyle(el).filter
        const m = f.match(/brightness\(([\d.]+)\)/)
        return f === 'none' ? 1 : m ? Number(m[1]) : 1
      })
    expect(await brightness()).toBeGreaterThan(1.5)
    await img.evaluate((el) => el.closest('li')!.scrollIntoView({ block: 'center' }))
    await expect.poll(brightness).toBeLessThan(1.1)
  })
})

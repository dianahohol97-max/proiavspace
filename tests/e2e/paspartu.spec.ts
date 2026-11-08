import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'

/** «Паспарту», through the test-only route /uk/e2e/themes/paspartu. */
const URL = '/uk/e2e/themes/paspartu'

cardSuite('paspartu')

test.describe('тема «Паспарту»: своє', () => {
  test('один кадр за раз: слайд на всю ширину, лічильник «01 / NN»', async ({ page }) => {
    await page.goto(URL)
    const viewer = page.locator('#mat-viewer')
    const [slideW, viewW] = await viewer.evaluate((el) => [(el.firstElementChild as HTMLElement).offsetWidth, el.clientWidth])
    expect(Math.abs(slideW - viewW)).toBeLessThanOrEqual(1)
    await expect(viewer.locator('li').first()).toContainText(/01 \/ \d\d/)
  })

  test('стіна підхоплює колір кадру: за кожним кадром — його розмита копія', async ({ page }) => {
    await page.goto(URL)
    const blur = await page.locator('#mat-viewer li').first().locator('[class*=Mat_slideWall__] img').evaluate((el) => getComputedStyle(el).filter)
    expect(blur).toContain('blur')
  })

  test('кнопка › гортає на наступний кадр', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'кнопки — десктоп')
    await page.goto(URL)
    const viewer = page.locator('#mat-viewer')
    await viewer.scrollIntoViewIfNeeded()
    const next = page.locator('#portfolio button').last()
    await next.click()
    await expect.poll(() => viewer.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100)
  })
})

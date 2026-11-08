import { devices, expect, test } from '@playwright/test'
import { cardSuite, scrollThrough } from './card-checks'

/**
 * «Опівніч» theme demo, through the test-only route /uk/e2e/themes/opivnich
 * (E2E_THEME_PREVIEW=1 in playwright.config — /themes redirects away).
 */
const URL = '/uk/e2e/themes/opivnich'

cardSuite('opivnich', { gifts: true })

test.describe('тема «Опівніч»: своє', () => {
  test('hero-кадр і ім’я є в HTML без JS, кадр з fetchpriority=high', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'достатньо одного прогону')
    const context = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(URL)
    const img = page.locator('header img').first()
    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    await expect(page.locator('header h1')).toHaveAttribute('aria-label', /\S/)
    await expect(page.locator('header h1')).not.toHaveText('')
    await context.close()
  })

  test('prefers-reduced-motion: жодних анімацій, нічого не сховано й не зсунуто', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(URL)
    await scrollThrough(page)
    await page.waitForTimeout(1500)
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => String(((a.effect as KeyframeEffect | null)?.target as Element | null)?.className ?? '?'))
    )
    expect(running).toEqual([])
    const heldBack = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3, p, figure, blockquote, blockquote span, li, [data-motion], [data-motion] *'))
        .filter((el) => !el.closest('nav'))
        .filter((el) => {
          const cs = getComputedStyle(el)
          return Number(cs.opacity) < 0.99 || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)')
        })
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 80))
    )
    expect(heldBack).toEqual([])
    // One still hero frame; the light patch does not move.
    await expect(page.locator('header img')).toHaveCount(1)
    await expect(page.locator('#midnight-spot')).not.toHaveAttribute('data-follow', 'true')
  })

  test('стрічка вогнів: кнопки гортають, вертикальне колесо гортає сторінку, а не стрічку', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'миша й колесо — десктоп')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(URL)
    const strip = page.locator('#midnight-strip')
    await strip.scrollIntoViewIfNeeded()
    await expect(strip.locator('[data-frame]').first()).toBeVisible()
    const before = await strip.evaluate((el) => el.scrollLeft)
    await page.getByRole('button', { name: 'Далі' }).click()
    await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before)
    // Wait for the smooth scroll + snap to come to rest.
    let left = -1
    await expect
      .poll(async () => {
        const now = await strip.evaluate((el) => el.scrollLeft)
        const settled = now === left
        left = now
        return settled
      }, { intervals: [250] })
      .toBe(true)
    const y = await page.evaluate(() => window.scrollY)
    const box = (await strip.boundingBox())!
    await page.mouse.move(box.x + 200, box.y + box.height / 2)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y)
    expect(await strip.evaluate((el) => el.scrollLeft)).toBe(left)
  })
})

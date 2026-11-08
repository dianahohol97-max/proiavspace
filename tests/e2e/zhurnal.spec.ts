import { devices, expect, test } from '@playwright/test'
import { cardSuite, scrollThrough } from './card-checks'

/**
 * «Журнал» theme demo, through the test-only route /uk/e2e/themes/zhurnal
 * (E2E_THEME_PREVIEW=1 in playwright.config — /themes redirects away).
 */
const URL = '/uk/e2e/themes/zhurnal'

cardSuite('zhurnal')

test.describe('тема «Журнал»: своє', () => {
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
    // One still cover.
    await expect(page.locator('header img')).toHaveCount(1)
  })

  test('обкладинка: масthead в один рядок і в межах обкладинки; зміст веде до розділів', async ({ page }) => {
    await page.goto(URL)
    const fits = await page.evaluate(() => {
      const cover = document.querySelector('[class*=Journal_cover__]')!.getBoundingClientRect()
      const h1 = document.querySelector('header h1') as HTMLElement
      const inner = h1.firstElementChild as HTMLElement
      const r = inner.getBoundingClientRect()
      return { oneLine: r.height < cover.height * 0.3, inside: r.left >= cover.left - 1 && r.right <= cover.right + 1 }
    })
    expect(fits).toEqual({ oneLine: true, inside: true })
    for (const href of await page.locator('aside ol a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      await expect(page.locator(href!)).toHaveCount(1)
    }
  })
})

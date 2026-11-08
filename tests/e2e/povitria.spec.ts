import { devices, expect, test } from '@playwright/test'
import { cardSuite, scrollThrough } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/**
 * «Повітря» theme demo, through the test-only route /uk/e2e/themes/povitria
 * (E2E_THEME_PREVIEW=1 in playwright.config — /themes redirects away).
 */
const URL = '/uk/e2e/themes/povitria'

cardSuite('povitria')

test.describe('тема «Повітря»: своє', () => {
  test('hero-кадр і ім’я є в HTML без JS, кадр з fetchpriority=high', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'достатньо одного прогону')
    const context = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(URL)
    const img = page.locator('header img[fetchpriority=high]')
    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
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
          if (Number(cs.opacity) < 0.99) return true
          if (cs.transform === 'none') return false
          // Prints rest with a slight static tilt — a pure rotation is fine;
          // any shift or scale would mean an animation was left mid-way.
          const m = new DOMMatrix(cs.transform)
          const scale = Math.hypot(m.a, m.b)
          return Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5 || Math.abs(scale - 1) > 0.01
        })
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 80))
    )
    expect(heldBack).toEqual([])
  })

  test('«День у світлі»: позначки часу в колажі по порядку, папір теплішає при скролі', async ({ page }, info) => {
    await page.goto(URL)
    const times = await page.locator('#portfolio [class*=Air_time__]').allInnerTexts()
    expect(times.length).toBeGreaterThanOrEqual(3)
    const minutes = times.map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)))
    expect([...minutes].sort((x, y) => x - y)).toEqual(minutes)
    test.skip(info.project.name !== 'desktop', 'небо міряємо на десктопі')
    const sky = () =>
      page.locator('#portfolio').evaluate((el) => getComputedStyle(el, '::before').backgroundColor)
    const section = page.locator('#portfolio')
    const top = await section.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    const height = await section.evaluate((el) => el.getBoundingClientRect().height)
    await page.evaluate((y) => window.scrollTo(0, y - window.innerHeight * 0.6), top)
    const morning = await sky()
    await page.evaluate(([y, h]) => window.scrollTo(0, y + h - window.innerHeight * 0.5), [top, height])
    await expect.poll(sky).not.toBe(morning)
  })
})

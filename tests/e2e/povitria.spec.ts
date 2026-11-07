import { devices, expect, test, type Page } from '@playwright/test'

/**
 * «Повітря» theme demo, through the test-only route /uk/e2e/themes/povitria
 * (E2E_THEME_PREVIEW=1 in playwright.config — /themes redirects away).
 */
const URL = '/uk/e2e/themes/povitria'

/** Walks the whole page so lazy images, reveals and the sticky nav all run. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(30)
  }
}

test.describe('тема «Повітря»', () => {
  test('200 і без горизонтального переповнення (1440 / телефони)', async ({ page }, info) => {
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 })
    const response = await page.goto(URL)
    expect(response?.status()).toBe(200)
    await scrollThrough(page)
    const [scrollWidth, innerWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ])
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('iPhone 13: сторінка коротша за 11 000 px, у портфоліо ≤ 9 кадрів', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'висоту міряємо на iPhone 13')
    await page.goto(URL)
    await scrollThrough(page)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(height).toBeLessThan(11_000)
    const frames = await page.locator('#portfolio figure').count()
    expect(frames).toBeGreaterThan(0)
    expect(frames).toBeLessThanOrEqual(9)
  })

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

  test('у форми є label для кожного поля, коректні типи', async ({ page }) => {
    await page.goto(URL)
    const unlabeled = await page.evaluate(() => {
      const form = document.querySelector('#contact form')
      if (!form) return ['<no form>']
      return Array.from(form.querySelectorAll('input, select, textarea'))
        .filter((el) => (el as HTMLInputElement).type !== 'hidden')
        .filter((el) => ((el as HTMLInputElement).labels?.length ?? 0) === 0)
        .map((el) => el.getAttribute('name') ?? '?')
    })
    expect(unlabeled).toEqual([])
    await expect(page.locator('#contact input[name=email]')).toHaveAttribute('type', 'email')
    await expect(page.locator('#contact input[name=phone]')).toHaveAttribute('type', 'tel')
    await expect(page.locator('#contact input[name=date]')).toHaveAttribute('type', 'date')
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
    // The day falls back to a static gradient: no animated sky layers.
    await expect(page.locator('#day [class*=Air_sky__]')).toBeHidden()
  })

  test('«День у світлі»: кадри в порядку часу, небо — шари, що проявляються при скролі', async ({ page }, info) => {
    await page.goto(URL)
    const times = await page.locator('#day ol li [class*=Air_time__]').allInnerTexts()
    expect(times.length).toBeGreaterThanOrEqual(3)
    const minutes = times.map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)))
    expect([...minutes].sort((x, y) => x - y)).toEqual(minutes)
    test.skip(info.project.name !== 'desktop', 'шари неба міряємо на десктопі')
    const layers = page.locator('#day [class*=Air_skyLayer__]')
    await expect(layers).toHaveCount(times.length)
    const day = page.locator('#day')
    const top = await day.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    const height = await day.evaluate((el) => el.getBoundingClientRect().height)
    const lastOpacity = () => layers.last().evaluate((el) => Number(getComputedStyle(el).opacity))
    await page.evaluate((y) => window.scrollTo(0, y), top)
    await expect.poll(lastOpacity).toBeLessThan(0.1)
    await page.evaluate(([y, h]) => window.scrollTo(0, y + h - window.innerHeight), [top, height])
    await expect.poll(lastOpacity).toBeGreaterThan(0.9)
  })
})

import { devices, expect, test, type Page } from '@playwright/test'

/**
 * «Журнал» theme demo, through the test-only route /uk/e2e/themes/zhurnal
 * (E2E_THEME_PREVIEW=1 in playwright.config — /themes redirects away).
 */
const URL = '/uk/e2e/themes/zhurnal'

/** Walks the whole page so lazy images, reveals and the sticky nav all run. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(30)
  }
}

test.describe('тема «Журнал»', () => {
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
    const img = page.locator('header img').first()
    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    await expect(page.locator('header h1')).toHaveAttribute('aria-label', /\S/)
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
          return Number(cs.opacity) < 0.99 || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)')
        })
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 80))
    )
    expect(heldBack).toEqual([])
    // One still cover; the spread falls back to two static double pages.
    await expect(page.locator('header img')).toHaveCount(1)
    await expect(page.locator('[class*=Journal_spreadStatic__]')).toBeVisible()
    await expect(page.locator('[class*=Journal_spreadBook__]')).toBeHidden()
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

  test('розворот: сторінка перегортається при скролі (3D-поворот)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'достатньо одного прогону')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(URL)
    const book = page.locator('[class*=Journal_spreadBook__]')
    await expect(book).toBeVisible()
    const top = await book.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    const angle = async () =>
      page.locator('[class*=Journal_leaf__]').evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform)
        return Math.round((Math.atan2(-m.m13, m.m11) * 180) / Math.PI)
      })
    await page.evaluate((y) => window.scrollTo(0, y), top)
    await expect.poll(async () => Math.abs(await angle())).toBeLessThan(5)
    await page.evaluate((y) => window.scrollTo(0, y + window.innerHeight * 0.95), top)
    await expect.poll(async () => Math.abs(await angle())).toBeGreaterThan(170)
  })
})

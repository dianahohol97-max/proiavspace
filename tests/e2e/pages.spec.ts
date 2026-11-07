import { expect, test, type Page } from '@playwright/test'

/** Collects console errors and uncaught exceptions for the page's lifetime. */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  return errors
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - doc.clientWidth
  })
}

for (const locale of ['uk', 'en'] as const) {
  test(`головна /${locale}: відкривається, без горизонтального прокручування й помилок у консолі`, async ({ page }) => {
    const errors = watchErrors(page)
    const response = await page.goto(`/${locale}`, { waitUntil: 'load' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`))
    // Lazy sections and fonts settle; scroll through so late layout shows up too.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForLoadState('networkidle').catch(() => {})
    expect(await horizontalOverflow(page), 'сторінка ширша за екран').toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
  })
}

for (const path of ['/uk/tsiny', '/uk/halerei', '/uk/gallery-demo', '/uk/login']) {
  test(`${path} відповідає 200`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
  })
}

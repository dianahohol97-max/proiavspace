import { expect, test } from '@playwright/test'

/**
 * Google Analytics belongs to proiav's own pages only. Photographers' sites,
 * theme demos, client galleries and booking pages must never load it (their
 * visitors never agreed to our analytics). GA itself is blocked here — we
 * only look at whether the page tries to load it.
 */
const GA = /googletagmanager\.com\/gtag\/js/

test.describe('Google Analytics', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'достатньо одного прогону')
    await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort())
  })

  test('лендинг проЯв: GA підвантажується (lazyOnload)', async ({ page }) => {
    await page.goto('/uk')
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1, { timeout: 20_000 })
  })

  for (const path of ['/uk/e2e/themes/tysha', '/uk/s/demo-handle', '/uk/g/demo-slug', '/uk/b/demo-handle']) {
    test(`без GA: ${path}`, async ({ page }) => {
      const requests: string[] = []
      page.on('request', (r) => {
        if (GA.test(r.url())) requests.push(r.url())
      })
      await page.goto(path)
      await page.waitForLoadState('load')
      await page.waitForTimeout(3000)
      await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0)
      expect(requests).toEqual([])
    })
  }
})

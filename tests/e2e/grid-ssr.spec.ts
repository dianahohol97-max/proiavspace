import { expect, test } from '@playwright/test'

/**
 * The grid is rendered on the server (first 24 tiles, plain CSS) and swapped
 * in place for the virtualized grid after hydration: tiles are there without
 * JavaScript, and the swap moves nothing (CLS).
 */

test.describe('сітка без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const query of ['', '?cover=minimal', '?cover=minimal&layout=collage', '?layout=editorial']) {
    test(`плитки видно: /uk/gallery-demo${query}`, async ({ page }) => {
      await page.goto(`/uk/gallery-demo${query}`)
      const tiles = page.locator('main figure:visible')
      await expect(tiles.first()).toBeVisible()
      expect(await tiles.count()).toBeGreaterThanOrEqual(12)
      // Proportions are known before the photo loads: no zero-height tiles.
      for (const box of await tiles.evaluateAll((all) => all.slice(0, 12).map((f) => f.getBoundingClientRect()))) {
        expect(box.width).toBeGreaterThan(50)
        expect(box.height).toBeGreaterThan(50)
      }
      await expect(tiles.first().locator('img')).toHaveAttribute('src', /\/themes\/\d+\.webp$/)
    })
  }

  test('«Мінімал»: сітка на першому екрані, перші плитки вантажаться одразу', async ({ page }) => {
    await page.goto('/uk/gallery-demo?cover=minimal')
    const first = page.locator('main figure:visible').first()
    await expect(first).toBeInViewport()
    await expect(first.locator('img')).toHaveAttribute('loading', 'eager')
    await expect(page.locator('main figure:visible').nth(10).locator('img')).toHaveAttribute('loading', 'lazy')
  })
})

test.describe('сітка: заміна серверної сітки віртуальною без зсувів', () => {
  for (const query of ['', '?cover=minimal', '?cover=minimal&layout=collage', '?cover=minimal&layout=editorial']) {
    test(`CLS < 0.05: /uk/gallery-demo${query}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'android', 'досить iPhone 13 і десктопа')
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number }
        w.__cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!entry.hadRecentInput) w.__cls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      await page.goto(`/uk/gallery-demo${query}`)
      // Hydrated: the virtualized grid has taken over.
      await expect(page.locator('main [data-virtual]')).toHaveCount(1)
      await page.waitForTimeout(1500)
      for (let step = 0; step < 4; step++) {
        await page.mouse.wheel(0, 500)
        await page.waitForTimeout(200)
      }
      await page.waitForTimeout(500)
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
      testInfo.annotations.push({ type: 'CLS', description: cls.toFixed(4) })
      expect(cls).toBeLessThan(0.05)
    })
  }

  test('ті самі картинки до й після гідрації — без повторних завантажень', async ({ page }) => {
    const images: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'image') images.push(request.url())
    })
    await page.goto('/uk/gallery-demo?cover=minimal')
    await expect(page.locator('main [data-virtual]')).toHaveCount(1)
    await page.waitForLoadState('networkidle')
    const repeated = images.filter((url, index) => images.indexOf(url) !== index)
    expect(repeated).toEqual([])
  })
})

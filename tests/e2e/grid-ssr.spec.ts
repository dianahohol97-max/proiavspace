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
      await expect(tiles.first().locator('img')).toHaveAttribute('src', /\/themes\/\d+(-1080)?\.webp$/)
    })
  }

  test('«Мінімал»: сітка на першому екрані, перші плитки вантажаться одразу й першими', async ({ page }) => {
    await page.goto('/uk/gallery-demo?cover=minimal')
    const first = page.locator('main figure:visible').first()
    await expect(first).toBeInViewport()
    await expect(first.locator('img')).toHaveAttribute('loading', 'eager')
    await expect(first.locator('img')).toHaveAttribute('fetchpriority', 'high')
    await expect(page.locator('main figure:visible').nth(10).locator('img')).toHaveAttribute('loading', 'lazy')
  })

  test('під фото-обкладинкою плитки ліниві, обкладинка — першою', async ({ page }) => {
    await page.goto('/uk/gallery-demo')
    await expect(page.locator('header img').first()).toHaveAttribute('fetchpriority', 'high')
    await expect(page.locator('main figure:visible').first().locator('img')).toHaveAttribute('loading', 'lazy')
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

  test('під фото-обкладинкою фото плиток вантажаться лише після обкладинки', async ({ page }) => {
    const order: string[] = []
    // A slow cover: the grid must not take its bandwidth meanwhile.
    await page.route(/\/themes\/07(-1080)?\.webp$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    page.on('requestfinished', (request) => {
      if (request.resourceType() === 'image') order.push(new URL(request.url()).pathname)
    })
    page.on('request', (request) => {
      if (request.resourceType() === 'image') order.push(`start ${new URL(request.url()).pathname}`)
    })
    await page.goto('/uk/gallery-demo')
    await expect(page.locator('main figure:visible img').first()).toBeAttached()
    const coverDone = order.findIndex((entry) => /^\/themes\/07(-1080)?\.webp$/.test(entry))
    const firstTile = order.findIndex((entry) => entry.startsWith('start /themes/') && !/\/07(-1080)?\.webp$/.test(entry))
    expect(coverDone).toBeGreaterThanOrEqual(0)
    expect(firstTile).toBeGreaterThan(coverDone)
  })

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

test.describe('фото без збережених розмірів (masonry)', () => {
  // ?nodims=3: photos #2, #5, #8 (index 1, 4, 7) have no width/height.
  for (const js of [false, true]) {
    test(`показані повністю у слоті 4:5, решта — у своїх пропорціях (JS ${js ? 'увімк.' : 'вимк.'})`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ ...testInfo.project.use, javaScriptEnabled: js })
      const page = await context.newPage()
      await page.goto('/uk/gallery-demo?nodims=3')
      if (js) await expect(page.locator('main [data-virtual]')).toHaveCount(1)
      const tiles = await page.locator('main figure:visible').evaluateAll((figures) =>
        figures.map((figure) => {
          const box = figure.getBoundingClientRect()
          const img = figure.querySelector('img')!
          return {
            src: img.getAttribute('src'),
            ratio: box.height / box.width,
            fit: getComputedStyle(img).objectFit,
          }
        })
      )
      const unsized = ['02', '05', '08']
      for (const n of unsized) {
        const tile = tiles.find((t) => t.src?.includes(`/${n}-1080.webp`))!
        expect(tile, n).toBeTruthy()
        expect(tile.fit).toBe('contain')
        expect(tile.ratio).toBeCloseTo(1.25, 2)
      }
      const sized = tiles.find((t) => t.src?.includes('/01-1080.webp'))!
      expect(sized.fit).toBe('cover')
      expect(sized.ratio).toBeCloseTo(1333 / 2000, 2)
      await context.close()
    })
  }
})

test.describe('вибір варіанта в сітці', () => {
  test('плитки беруть легкий WebP ~1080 px; обкладинка — легкий на телефоні, 2048 на комп’ютері', async ({ page, isMobile }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone' && testInfo.project.name !== 'desktop', 'iPhone 13 і десктоп')
    await page.goto('/uk/gallery-demo?cover=minimal')
    const first = page.locator('main figure:visible').first().locator('img')
    await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/themes\/01-1080\.webp$/)
    await page.goto('/uk/gallery-demo')
    const cover = page.locator('header img').first()
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(
      isMobile ? /\/themes\/07-1080\.webp$/ : /\/themes\/07\.webp$/
    )
  })
})

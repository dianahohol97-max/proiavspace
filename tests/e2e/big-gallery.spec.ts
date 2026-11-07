import { expect, test } from '@playwright/test'

/**
 * 1500 photos (the demo's 24 frames repeated, /uk/gallery-demo?n=1500): the
 * grid is virtualized, so the DOM holds only the rows near the screen and the
 * page scrolls from top to bottom without long freezes.
 */
const N = 1500

for (const layout of ['masonry', 'collage'] as const) {
  test(`галерея з ${N} фото (${layout}): у DOM не всі фото, прокрутка без зависань`, async ({ page }) => {
    await page.goto(`/uk/gallery-demo?n=${N}&layout=${layout}`)
    const main = page.locator('main[data-count]')
    await expect(main).toHaveAttribute('data-count', String(N))
    await expect(page.locator('main figure').first()).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`Завантажити все · ${N}`) })).toBeVisible()

    const inDom = () => page.locator('main figure').count()
    expect(await inDom()).toBeLessThan(150)

    // Scroll the whole page in steps; time each step to the next painted frame.
    const worst = await page.evaluate(async () => {
      const frame = () => new Promise<number>((resolve) => requestAnimationFrame(() => resolve(performance.now())))
      let worstStep = 0
      let maxNodes = 0
      for (let guard = 0; guard < 400; guard++) {
        const start = performance.now()
        window.scrollBy(0, window.innerHeight * 2)
        await frame()
        await frame()
        worstStep = Math.max(worstStep, performance.now() - start)
        maxNodes = Math.max(maxNodes, document.querySelectorAll('main figure').length)
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) break
      }
      return { worstStep, maxNodes }
    })
    expect(worst.maxNodes).toBeLessThan(150)
    // Generous for slow CI machines; a non-virtualized 1500-photo grid takes seconds.
    expect(worst.worstStep).toBeLessThan(1500)

    // The very last photo is reachable and opens in the viewer.
    const last = page.locator('main figure').last()
    await last.locator('img').first().scrollIntoViewIfNeeded()
    await last.locator('img').first().click()
    await expect(page.locator('.yarl__counter')).toHaveText(`${N} / ${N}`)
    // The lightbox doesn't render 1500 slides or thumbnails either.
    expect(await page.locator('.yarl__thumbnails_thumbnail').count()).toBeLessThan(40)
    expect(await page.locator('.yarl__slide').count()).toBeLessThan(10)
  })
}

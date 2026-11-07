import { expect, test } from '@playwright/test'

test.describe('демо-галерея', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/uk/gallery-demo')
    await expect(page.locator('main figure').first()).toBeVisible()
  })

  test('тап по сердечку змінює лічильник обраного', async ({ page, isMobile }) => {
    const counter = page.getByText(/♥\s*\d+/).first()
    const before = Number((await counter.innerText()).match(/\d+/)![0])
    const heart = page.getByRole('button', { name: 'Додати до обраного' }).first()
    if (isMobile) await heart.tap()
    else await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    await expect(counter).toContainText(String(before + 1))
    // Second tap takes it back.
    if (isMobile) await heart.tap()
    else await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    await expect(counter).toContainText(String(before))
    // The heart sits on the tile: tapping it must not open the viewer.
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)
  })

  test('слайд-шоу відкривається й закривається', async ({ page }) => {
    await page.getByRole('button', { name: /Слайд-шоу/ }).click()
    const close = page.getByRole('button', { name: 'Close' })
    await expect(close).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible()
    await close.click()
    await expect(close).toHaveCount(0)
  })

  test('тап по фото відкриває його на весь екран', async ({ page, isMobile }) => {
    const tile = page.locator('main figure').nth(2)
    const src = await tile.locator('img').first().getAttribute('src')
    if (isMobile) await tile.locator('img').first().tap()
    else await tile.locator('img').first().click()
    await expect(page.getByText(/^3 \/ \d+$/)).toBeVisible()
    // The viewer covers the whole viewport and shows the tapped photo.
    const overlay = page.getByRole('button', { name: 'Close' }).locator('xpath=../..')
    const box = await overlay.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1)
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1)
    await expect(overlay.locator(`img[src="${src}"]`)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)
  })
})

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
    await expect(page.getByRole('button', { name: 'Закрити' })).toHaveCount(0)
  })

  test('слайд-шоу відкривається, гортає саме й закривається', async ({ page }) => {
    await page.getByRole('button', { name: /Слайд-шоу/ }).click()
    const close = page.getByRole('button', { name: 'Закрити' })
    await expect(close).toBeVisible()
    await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible()
    await expect(page.locator('.yarl__counter')).toHaveText(/^1 \/ \d+$/)
    // 4.5 s per photo: the second one comes up by itself.
    await expect(page.locator('.yarl__counter')).toHaveText(/^2 \/ \d+$/, { timeout: 9_000 })
    await close.click()
    await expect(page.locator('.yarl__portal')).toHaveCount(0)
  })
})

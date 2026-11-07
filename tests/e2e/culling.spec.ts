import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * «Відібрати кадри» (AI culling, stage 3) on the database-free demo page.
 * The eyes check is off here: it downloads the MediaPipe model from a CDN,
 * which a test must not depend on. Frame 02 is served with frame 01's bytes,
 * so the first two frames are a guaranteed burst.
 */
const FRAME_01 = readFileSync(path.join(process.cwd(), 'public/themes/01-1080.webp'))

test.describe('відбір кадрів (демо)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'воркери й IndexedDB однакові — досить десктопа')
    await page.route(/\/themes\/02-1080\.webp$/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/webp', body: FRAME_01 })
    )
  })

  test('аналіз, серія, рішення фотографа зберігаються на пристрої', async ({ page }) => {
    const external: string[] = []
    page.on('request', (r) => {
      if (/jsdelivr|googleapis|mediapipe/.test(r.url())) external.push(r.url())
    })
    await page.goto('/uk/gallery-demo/culling')
    const start = page.getByTestId('culling-start')
    await expect(start).toBeEnabled()
    await page.getByRole('checkbox', { name: /заплющені очі/ }).uncheck()
    await start.click()

    const summary = page.getByTestId('culling-summary')
    await expect(summary).toContainText('Повтори: 1 (серій: 1)')
    await expect(page.getByRole('button', { name: 'Скасувати' })).toHaveCount(0)
    // Nothing was hidden or changed on its own; the hide button waits for the DB.
    const hide = page.getByTestId('culling-hide')
    await expect(hide).toBeDisabled()
    await expect(page.getByText('З’явиться після оновлення бази').first()).toBeVisible()
    await expect(page.getByText('Збережено на цьому пристрої')).toBeVisible()

    // «Потенційний брак» is the default filter: the repeat of frame 01.
    const tiles = page.getByTestId('culling-tile')
    await expect(tiles).toHaveCount(1)
    await expect(tiles.first().locator('[data-flag=duplicate]')).toBeVisible()

    // Side-by-side series view.
    await tiles.first().getByRole('button', { name: 'Серія · 2' }).click()
    const dialog = page.getByTestId('culling-series')
    await expect(dialog.locator('figure')).toHaveCount(2)
    await expect(dialog.getByText('★ Кращий у серії')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // «Кращі в серіях»: the first frame.
    await page.getByRole('button', { name: /Кращі в серіях · 1/ }).click()
    await expect(tiles).toHaveCount(1)
    await page.getByRole('button', { name: /Потенційний брак/ }).click()

    // The photographer clears the flag — it leaves the reject list…
    await tiles.first().getByRole('button', { name: 'Прибрати з позначки' }).click()
    await expect(page.getByRole('button', { name: /Потенційний брак · 0/ })).toBeVisible()

    // …and that survives a reload (IndexedDB, this device only).
    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByTestId('culling-summary')).toContainText('Повтори: 1')
    await expect(page.getByRole('button', { name: /Потенційний брак · 0/ })).toBeVisible()
    await page.getByRole('button', { name: /Усі · 24/ }).click()
    await expect(page.getByText('Позначку прибрано')).toBeVisible()
    await page.getByRole('button', { name: 'Скасувати рішення' }).click()
    await expect(page.getByRole('button', { name: /Потенційний брак · 1/ })).toBeVisible()

    // With the eyes check off, no model/wasm was ever requested.
    expect(external).toEqual([])
  })

  test('прихована вкладка ставить аналіз на паузу, скасування зупиняє', async ({ page }) => {
    await page.goto('/uk/gallery-demo/culling?n=200')
    await expect(page.getByTestId('culling-start')).toBeEnabled()
    await page.getByRole('checkbox', { name: /заплющені очі/ }).uncheck()
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
        document.dispatchEvent(new Event('visibilitychange'))
      }, hidden)

    await page.getByTestId('culling-start').click()
    const progress = page.getByTestId('culling-progress')
    await expect(progress).toContainText(/\d+\/200/)
    await setHidden(true)
    await expect(progress).toContainText('Пауза')
    const frozen = (await progress.innerText()).match(/(\d+)\/200/)![1]
    await page.waitForTimeout(1500)
    // In-flight jobs may finish, but no new ones start.
    const after = Number((await progress.innerText()).match(/(\d+)\/200/)![1])
    expect(after - Number(frozen)).toBeLessThanOrEqual(4)
    await setHidden(false)
    await expect(progress).not.toContainText('Пауза')
    await page.getByRole('button', { name: 'Скасувати' }).click()
    await expect(page.getByText('Аналіз скасовано')).toBeVisible()
    await expect(page.getByTestId('culling-start')).toBeEnabled()
  })
})

import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Gallery order mode (galleries.sort_mode, 0071) on the test-only page
 * /uk/e2e/gallery-sort: the real «Порядок» control and EXIF read, one gallery
 * in server memory (its ordering mirrors sort_gallery_assets, covered on a
 * real Postgres in tests/audit-storage/gallery-sort-mode.test.ts).
 *   sort by shot time → upload a frame from the middle of the day → it
 *   lands between its neighbours; a photo without a date stays last;
 *   «за часом завантаження» → manual: new photos go to the end.
 */
const shoot = (name: string) => path.join(__dirname, 'fixtures', 'shoot', name)
const order = (page: Page) => page.getByTestId('photo-order').locator('li')

/** Clear the in-memory gallery, then open the page WITHOUT ?reset (a refresh would clear it again). */
async function fresh(page: Page, locale = 'uk') {
  await page.goto(`/${locale}/e2e/gallery-sort?reset=1`)
  await page.goto(`/${locale}/e2e/gallery-sort`)
}

async function upload(page: Page, files: string[]) {
  const before = Number(await page.getByTestId('sort-state').getAttribute('data-count'))
  await page.getByTestId('sort-upload').setInputFiles(files.map(shoot))
  // registered and the page refreshed with the new photos
  await expect(page.getByTestId('sort-state')).toHaveAttribute('data-count', String(before + files.length))
  await expect(page.getByTestId('sort-upload-state')).toHaveText('idle')
}

test.describe.configure({ mode: 'serial' })

test('за часом зйомки: дозавантажений кадр із середини дня стає між сусідами', async ({ page, isMobile }) => {
  await fresh(page)
  // Перша партія: як завантажено, ручний порядок.
  await upload(page, ['a-0900.jpg', 'b-1800.jpg', 'd-nodate.jpg', 'c-1200.jpg'])
  await expect(order(page)).toHaveText(['a-0900.jpg', 'b-1800.jpg', 'd-nodate.jpg', 'c-1200.jpg'])
  await expect(page.getByTestId('gallery-sort-mode')).toContainText('ручний порядок')
  await expect(page.getByTestId('gallery-sort-status')).toContainText('3 з 4')

  const byShot = page.getByRole('button', { name: 'За часом зйомки' })
  if (isMobile) await byShot.tap()
  else await byShot.click()
  await expect(page.getByTestId('gallery-sort-mode')).toContainText('за часом зйомки')
  await expect(byShot).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  // Режим збережено: після перезавантаження він той самий.
  await expect(page.getByTestId('sort-state')).toHaveAttribute('data-mode', 'taken_at')
  await expect(order(page)).toHaveText(['a-0900.jpg', 'c-1200.jpg', 'b-1800.jpg', 'd-nodate.jpg'])

  // Дозавантаження кадру о 15:00 — стає між 12:00 і 18:00; без дати — у кінці.
  await upload(page, ['e-1500.jpg'])
  await expect(order(page)).toHaveText(['a-0900.jpg', 'c-1200.jpg', 'e-1500.jpg', 'b-1800.jpg', 'd-nodate.jpg'])
  await expect(page.getByTestId('sort-state')).toHaveAttribute('data-mode', 'taken_at')
})

test('за часом завантаження: ручний режим, нові фото — у кінець', async ({ page }) => {
  await fresh(page)
  await upload(page, ['b-1800.jpg', 'a-0900.jpg'])
  await page.getByRole('button', { name: 'За часом зйомки' }).click()
  await expect(page.getByTestId('gallery-sort-mode')).toContainText('за часом зйомки')
  await page.getByRole('button', { name: 'За часом завантаження' }).click()
  await expect(page.getByTestId('gallery-sort-mode')).toContainText('ручний порядок')
  await page.reload()
  await expect(page.getByTestId('sort-state')).toHaveAttribute('data-mode', 'manual')
  await expect(order(page)).toHaveText(['b-1800.jpg', 'a-0900.jpg'])
  // Ранній кадр, але режим ручний: у кінець, а не на початок і не за часом.
  await upload(page, ['c-1200.jpg'])
  await expect(order(page)).toHaveText(['b-1800.jpg', 'a-0900.jpg', 'c-1200.jpg'])
})

test('режим показано мовою кабінету (en, de, pl)', async ({ page }) => {
  for (const [locale, word] of [
    ['en', 'manual order'],
    ['de', 'manuelle Reihenfolge'],
    ['pl', 'kolejność ręczna'],
  ] as const) {
    await fresh(page, locale)
    await upload(page, ['a-0900.jpg', 'b-1800.jpg'])
    await expect(page.getByTestId('gallery-sort-mode')).toContainText(word)
  }
})

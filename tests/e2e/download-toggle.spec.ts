import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { dbState, resetDb, setDownloadsColumn, signIn } from './support/session'

/**
 * «Клієнт може завантажувати фото» (0070): фотограф вимикає перемикач у
 * вкладці «Доступ» → у галереї клієнта нема жодної кнопки завантаження, а
 * прямий запит до маршрутів повертає 403 з людським текстом. Плюс база без
 * міграції: завантаження дозволені, перемикач пояснює, чому неактивний.
 * Фейковий Supabase — tests/e2e/support/fake-supabase.mjs.
 */
const SHOTS = process.env.DASHBOARD_SHOTS_DIR ?? join('test-results', 'dashboard')
const GALLERY_ID = '44444444-4444-4444-8444-444444444444' // «Хрещення Софійки», опублікована, 8 фото
const SLUG = 'olha-vyshnia-444444'
const ASSET = '44444444-a000'
const UK_DISABLED = 'Фотограф вимкнув завантаження в цій галереї. Фото можна переглядати, а по оригінали звертайтеся до фотографа.'

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === 'android', 'перевіряємо на десктопі й iPhone')
  await resetDb('full')
})

async function shot(page: Page, name: string, project: string) {
  mkdirSync(SHOTS, { recursive: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: join(SHOTS, `${name}-${project}.png`), fullPage: true })
}

async function clientSees(page: Page) {
  await page.goto(`/uk/g/${SLUG}`)
  await expect(page.locator('h1')).toHaveText('Хрещення Софійки')
}

test('вимкнути → у клієнта нема кнопок, прямі запити → 403; увімкнути → усе повертається', async ({ browser, baseURL, request }, info) => {
  // Фотограф: «Доступ» → перемикач.
  const owner = await browser.newContext(info.project.use)
  await signIn(owner, baseURL!)
  const dash = await owner.newPage()
  await dash.goto(`/uk/dashboard/galleries/${GALLERY_ID}?tab=access`)
  const toggle = dash.getByTestId('downloads-toggle')
  const sw = toggle.getByRole('switch', { name: 'Клієнт може завантажувати фото' })
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await expect(toggle.getByTestId('downloads-count')).toBeVisible()

  // До: у клієнта кнопки є, прямий запит — редірект на файл.
  const client = await browser.newContext(info.project.use)
  const page = await client.newPage()
  await clientSees(page)
  await expect(page.getByRole('button', { name: /Завантажити все/ })).toBeVisible()
  await expect(page.locator('a[href$="/download"]').first()).toBeAttached()
  expect((await request.get(`/api/assets/${ASSET}/download`, { maxRedirects: 0 })).status()).toBe(302)

  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await expect(toggle.getByRole('status')).toHaveText('Збережено ✓')
  await expect(toggle).toContainText('клієнт лише переглядає фото')
  expect((await dbState()).galleries.find((g) => g.id === GALLERY_ID)?.downloads_enabled).toBe(false)
  await shot(dash, '09-access-downloads-off', info.project.name)

  // Після: ні «Завантажити все», ні підказки, ні «↓», ні кнопки в переглядачі.
  await clientSees(page)
  const tile = page.locator('main figure[data-i="0"]:visible').locator('img').first()
  await expect(tile).toBeVisible()
  await expect(page.getByRole('button', { name: /Завантажити все/ })).toHaveCount(0)
  await expect(page.getByText('Щоб зберегти фото')).toHaveCount(0)
  await expect(page.locator('a[href*="/download"]')).toHaveCount(0)
  if (info.project.name === 'iphone') await tile.tap()
  else await tile.click()
  await expect(page.locator('.yarl__portal_open')).toBeVisible()
  await expect(page.locator('.yarl__toolbar').getByRole('button', { name: 'Закрити' })).toBeVisible()
  await expect(page.locator('.yarl__toolbar [aria-label="Завантажити оригінал"]')).toHaveCount(0)
  await shot(page, '10-client-no-downloads', info.project.name)

  // Прямі запити: 403 з людським текстом мовою сторінки, звідки прийшли.
  const one = await request.get(`/api/assets/${ASSET}/download`, {
    maxRedirects: 0,
    headers: { referer: `${baseURL}/uk/g/${SLUG}` },
  })
  expect(one.status()).toBe(403)
  expect(await one.text()).toBe(UK_DISABLED)
  const onePl = await request.get(`/api/assets/${ASSET}/download?lang=pl`, { maxRedirects: 0 })
  expect(await onePl.text()).toBe('Fotograf wyłączył pobieranie w tej galerii. Zdjęcia możesz oglądać, a po oryginały zwróć się do fotografa.')
  const all = await request.get(`/api/galleries/${SLUG}/archive-urls`, { headers: { referer: `${baseURL}/uk/g/${SLUG}` } })
  expect(all.status()).toBe(403)
  expect(await all.json()).toEqual({ error: 'downloads_disabled', message: UK_DISABLED })

  // Власник і далі може завантажити.
  expect((await owner.request.get(`/api/assets/${ASSET}/download`, { maxRedirects: 0 })).status()).toBe(302)

  // Увімкнути назад.
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await expect(toggle.getByRole('status')).toHaveText('Збережено ✓')
  await clientSees(page)
  await expect(page.getByRole('button', { name: /Завантажити все/ })).toBeVisible()
  const tileAgain = page.locator('main figure[data-i="0"]:visible').locator('img').first()
  if (info.project.name === 'iphone') await tileAgain.tap()
  else await tileAgain.click()
  await expect(page.locator('.yarl__toolbar [aria-label="Завантажити оригінал"]')).toHaveCount(1)
  expect((await request.get(`/api/assets/${ASSET}/download`, { maxRedirects: 0 })).status()).toBe(302)
  expect((await request.get(`/api/galleries/${SLUG}/archive-urls`)).status()).toBe(200)

  await owner.close()
  await client.close()
})

test('база без міграції 0070: завантаження дозволені, перемикач неактивний і пояснює чому', async ({ page, context, baseURL, request }) => {
  await setDownloadsColumn(false)
  await signIn(context, baseURL!)
  await page.goto(`/uk/dashboard/galleries/${GALLERY_ID}?tab=access`)
  const toggle = page.getByTestId('downloads-toggle')
  await expect(toggle.getByRole('switch')).toBeDisabled()
  await expect(toggle.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  await expect(toggle).toContainText('Перемикач запрацює після оновлення бази (міграція 0070)')

  await context.clearCookies()
  await page.goto(`/uk/g/${SLUG}`)
  await expect(page.getByRole('button', { name: /Завантажити все/ })).toBeVisible()
  expect((await request.get(`/api/assets/${ASSET}/download`, { maxRedirects: 0 })).status()).toBe(302)
  expect((await request.get(`/api/galleries/${SLUG}/archive-urls`)).status()).toBe(200)
})

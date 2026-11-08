import { expect, test, type Page } from '@playwright/test'
import { SITES_ON_URL } from './sites-flag'
import { resetDb, signIn } from './support/session'

/**
 * Сайти й бронювання сховані до окремого релізу (src/lib/features/sites.ts).
 * Основний e2e-сервер — з вимкненим прапорцем (як на проді): фотограф не
 * бачить «Сайт» і «Бронювання» ні на десктопі, ні в мобільному меню,
 * публічні /s/, /b/ і API — 404. Власниця платформи бачить усе.
 * Другий сервер (NEXT_PUBLIC_SITES_ENABLED=1) показує, що прапорець повертає все.
 */

const HIDDEN = ['Сайт', 'Бронювання']

async function openMenu(page: Page, project: string) {
  // On a phone the menu sits behind ☰.
  if (project === 'iphone') await page.getByRole('button', { name: 'Мої галереї' }).click()
  return page.locator('nav:visible')
}

test.describe('кабінет: меню й розділи', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === 'android', 'кабінет перевіряємо на десктопі й iPhone')
  })

  test('фотограф: у меню немає «Сайт» і «Бронювання», розділи ведуть на /dashboard', async ({ page, context, baseURL }, info) => {
    await resetDb('full')
    await signIn(context, baseURL!)
    await page.goto('/uk/dashboard')
    const menu = await openMenu(page, info.project.name)
    await expect(menu.getByRole('link', { name: 'Налаштування', exact: true })).toBeVisible()
    for (const name of HIDDEN) await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0)

    for (const section of ['site', 'booking']) {
      await page.goto(`/uk/dashboard/${section}`)
      await expect(page).toHaveURL(/\/uk\/dashboard$/)
    }
  })

  test('власниця бачить «Сайт» і «Бронювання» і відкриває обидва розділи', async ({ page, context, baseURL }, info) => {
    await resetDb('full')
    await signIn(context, baseURL!, 'owner')
    await page.goto('/uk/dashboard')
    const menu = await openMenu(page, info.project.name)
    for (const name of HIDDEN) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()

    for (const section of ['site', 'booking']) {
      await page.goto(`/uk/dashboard/${section}`)
      await expect(page).toHaveURL(new RegExp(`/uk/dashboard/${section}$`))
    }
  })

  test('з прапорцем фотограф знову бачить «Сайт» і «Бронювання»', async ({ page, context }, info) => {
    await resetDb('full')
    await signIn(context, SITES_ON_URL)
    await page.goto(`${SITES_ON_URL}/uk/dashboard`)
    const menu = await openMenu(page, info.project.name)
    for (const name of HIDDEN) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()
  })
})

test.describe('публічні сторінки й API', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'досить одного прогону: відповіді сервера однакові')
  })

  test('/s/test, /b/test, /site-preview → 404 з X-Robots-Tag: noindex', async ({ page }) => {
    for (const path of ['/uk/s/test', '/uk/s/test/legal/privacy', '/uk/b/test', '/uk/site-preview']) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
      expect(response?.headers()['x-robots-tag'], path).toMatch(/noindex/)
    }
    const og = await page.request.get('/uk/s/test/opengraph-image')
    expect(og.status()).toBe(404)
  })

  test('API бронювання, оплати й лідів із сайту → 404', async ({ request }) => {
    for (const path of ['/api/booking/book', '/api/booking/pay', '/api/sites/lead']) {
      const response = await request.post(path, { data: {} })
      expect(response.status(), path).toBe(404)
    }
    const google = await request.get('/api/booking/google/connect', { maxRedirects: 0 })
    expect(google.status()).toBe(404)
  })

  test('sitemap без /s/ і /b/', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain('<urlset')
    expect(xml).not.toMatch(/\/(s|b)\//)
  })

  test('з прапорцем сторінка бронювання знову відкривається (без бази — «не знайдено» з 200)', async ({ request }) => {
    const response = await request.get(`${SITES_ON_URL}/uk/b/test`)
    expect(response.status()).toBe(200)
    expect(response.headers()['x-robots-tag']).toBeUndefined()
    const api = await request.post(`${SITES_ON_URL}/api/sites/lead`, { data: {} })
    expect(api.status()).not.toBe(404)
  })
})

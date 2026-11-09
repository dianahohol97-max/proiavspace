import { expect, test, type Page } from '@playwright/test'
import { SITES_ON } from './sites-flag'
import { resetDb, signIn } from './support/session'

/**
 * Сайти й бронювання сховані до окремого релізу (src/lib/features/sites.ts).
 * Перший прогін `npm run test:e2e` — з вимкненим прапорцем (як на проді):
 * фотограф не бачить «Сайт» і «Бронювання» ні на десктопі, ні в мобільному
 * меню, публічні /s/, /b/, /site-preview і API — 404. Власниця бачить усе.
 * Другий прогін (E2E_SITES=1 → NEXT_PUBLIC_SITES_ENABLED=1) показує, що
 * прапорець повертає все як було.
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
    await resetDb('full')
  })

  test('фотограф: у меню немає «Сайт» і «Бронювання», розділи ведуть на /dashboard', async ({ page, context, baseURL }, info) => {
    test.skip(SITES_ON, 'прогін із вимкненим прапорцем')
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
    test.skip(SITES_ON, 'прогін із вимкненим прапорцем')
    await signIn(context, baseURL!, 'owner')
    await page.goto('/uk/dashboard')
    const menu = await openMenu(page, info.project.name)
    for (const name of HIDDEN) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()

    for (const section of ['site', 'booking']) {
      await page.goto(`/uk/dashboard/${section}`)
      await expect(page).toHaveURL(new RegExp(`/uk/dashboard/${section}$`))
    }
  })

  test('з прапорцем фотограф знову бачить «Сайт» і «Бронювання» і відкриває розділи', async ({ page, context, baseURL }, info) => {
    test.skip(!SITES_ON, 'лише в прогоні E2E_SITES=1')
    await signIn(context, baseURL!)
    await page.goto('/uk/dashboard')
    const menu = await openMenu(page, info.project.name)
    for (const name of HIDDEN) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()
    await page.goto('/uk/dashboard/booking')
    await expect(page).toHaveURL(/\/uk\/dashboard\/booking$/)
  })
})

test.describe('публічні сторінки й API', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'досить одного прогону: відповіді сервера однакові')
  })

  test('/s/*, /b/*, /site-preview → статус 404', async ({ request }) => {
    test.skip(SITES_ON, 'прогін із вимкненим прапорцем')
    for (const path of ['/uk/s/test', '/uk/s/test/legal/privacy', '/uk/s/test/opengraph-image', '/uk/b/test', '/uk/site-preview']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
    }
  })

  test('API бронювання, оплати й лідів із сайту → 404', async ({ request }) => {
    test.skip(SITES_ON, 'прогін із вимкненим прапорцем')
    for (const path of ['/api/booking/book', '/api/booking/pay', '/api/sites/lead']) {
      const response = await request.post(path, { data: {} })
      expect(response.status(), path).toBe(404)
    }
    const google = await request.get('/api/booking/google/connect', { maxRedirects: 0 })
    expect(google.status()).toBe(404)
  })

  test('sitemap без /s/ і /b/', async ({ request }) => {
    test.skip(SITES_ON, 'прогін із вимкненим прапорцем')
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain('<urlset')
    expect(xml).not.toMatch(/\/(s|b)\//)
  })

  test('з прапорцем сторінка бронювання й API знову відповідають', async ({ request }) => {
    test.skip(!SITES_ON, 'лише в прогоні E2E_SITES=1')
    // Without a database the booking page shows «not found» with 200, as before.
    expect((await request.get('/uk/b/test')).status()).toBe(200)
    expect((await request.post('/api/sites/lead', { data: {} })).status()).not.toBe(404)
  })
})

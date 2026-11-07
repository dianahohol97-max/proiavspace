import { devices, expect, test, type Page } from '@playwright/test'

/**
 * Shared checks for every one-page «візитка» theme. Each theme spec calls
 * cardSuite(id) and adds its own signature tests.
 *
 * Contract the themes keep (data attributes, not class names):
 *   [data-card=name]  the photographer's name (h1)
 *   [data-card=role]  «Фотограф»
 *   [data-card=directions], [data-card=city]
 *   [data-card=book]  the first-screen booking button
 *   #portfolio, #pricing, #about, #contact — blocks 2, 3, 4, 6
 *   #gifts [data-gift] — optional block 7
 */
export async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(25)
  }
}

export function cardSuite(
  id: string,
  opts: { gifts?: boolean; filters?: boolean; maxHeight?: number } = {}
) {
  const URL = `/uk/e2e/themes/${id}`
  const maxHeight = opts.maxHeight ?? (opts.gifts ? 9000 : 8000)

  test.describe(`візитка «${id}»: спільні вимоги`, () => {
    test('200 і без горизонтального переповнення (375–1440)', async ({ page }, info) => {
      const widths = info.project.name === 'desktop' ? [1440, 1024, 768] : [0]
      for (const w of widths) {
        if (w) await page.setViewportSize({ width: w, height: 900 })
        const response = await page.goto(URL)
        expect(response?.status()).toBe(200)
        await scrollThrough(page)
        const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
        expect(sw, `ширина ${w || 'телефон'}`).toBeLessThanOrEqual(iw)
      }
    })

    test(`iPhone 13: сторінка ≤ ${maxHeight} px, усі блоки на місці`, async ({ page }, info) => {
      test.skip(info.project.name !== 'iphone', 'висоту міряємо на iPhone 13')
      await page.goto(URL)
      await scrollThrough(page)
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      expect(height).toBeLessThanOrEqual(maxHeight)
      for (const sel of ['#portfolio', '#pricing', '#about', '#contact']) {
        await expect(page.locator(sel).first(), sel).toBeAttached()
      }
      const frames = await page.locator('#portfolio img').count()
      expect(frames).toBeGreaterThanOrEqual(6)
      expect(frames).toBeLessThanOrEqual(15)
      const packs = await page.locator('#pricing [data-pack]').count()
      expect(packs).toBeGreaterThanOrEqual(2)
      expect(packs).toBeLessThanOrEqual(4)
      if (opts.gifts) await expect(page.locator('#gifts [data-gift]')).not.toHaveCount(0)
    })

    test('перевірка 5 секунд: без JS на першому екрані ім’я, «фотограф», напрямки, місто, запис', async ({ browser }, info) => {
      test.skip(info.project.name !== 'desktop', 'один прогін на емуляції iPhone')
      for (const device of [devices['iPhone 13'], { viewport: { width: 1440, height: 900 } }]) {
        const context = await browser.newContext({ ...device, javaScriptEnabled: false })
        const page = await context.newPage()
        await page.goto(URL)
        const vh = page.viewportSize()!.height
        for (const key of ['name', 'role', 'directions', 'city', 'book']) {
          const el = page.locator(`[data-card=${key}]`).first()
          await expect(el, key).toBeVisible()
          const box = await el.boundingBox()
          expect(box, key).not.toBeNull()
          expect(box!.y + Math.min(box!.height, 40), `${key} на першому екрані`).toBeLessThanOrEqual(vh)
          const opacity = await el.evaluate((n) => {
            let o = 1
            for (let e: Element | null = n; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
            return o
          })
          expect(opacity, `${key} видно без JS`).toBeGreaterThan(0.9)
        }
        await context.close()
      }
    })

    if (opts.filters !== false) {
      test('фільтр портфоліо: «Усі» і напрямки ховають чужі кадри', async ({ page }) => {
        await page.goto(URL)
        const chips = page.locator('#portfolio [aria-pressed]')
        await expect(chips.first()).toBeVisible()
        const n = await chips.count()
        expect(n).toBeGreaterThanOrEqual(3)
        const all = await page.locator('#portfolio [data-cat]:visible').count()
        await chips.nth(1).click()
        await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')
        const some = await page.locator('#portfolio [data-cat]:visible').count()
        expect(some).toBeGreaterThan(0)
        expect(some).toBeLessThan(all)
        await chips.first().click()
        await expect(page.locator('#portfolio [data-cat]:visible')).toHaveCount(all)
      })
    }

    test('форма: label у кожного поля; «Обрати» пакет підставляє тему', async ({ page }) => {
      await page.goto(URL)
      const unlabeled = await page.evaluate(() => {
        const form = document.querySelector('#contact form')
        if (!form) return ['<no form>']
        return Array.from(form.querySelectorAll('input, select, textarea'))
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .filter((el) => !el.id || !form.querySelector(`label[for="${el.id}"]`))
          .map((el) => (el as HTMLInputElement).name)
      })
      expect(unlabeled).toEqual([])
      const cta = page.locator('#pricing [data-pack] a[href="#contact"]').first()
      const pack = await page.locator('#pricing [data-pack]').first().getAttribute('data-pack')
      await cta.click()
      await expect(page.locator('#contact select').first()).toHaveValue(pack!)
    })

    if (opts.gifts) {
      test('подарунки: «Замовити» сертифікат відкриває форму з номіналом/кому/від кого', async ({ page }) => {
        await page.goto(URL)
        const cert = page.locator('#gifts [data-gift=certificate]')
        await cert.locator('a').click()
        await expect(page.locator('#contact [name=cert_to]')).toBeVisible()
        await expect(page.locator('#contact [name=cert_from]')).toBeVisible()
        await expect(page.locator('#contact [name=cert_nominal]')).toBeVisible()
      })
    }

    test('reduced motion: контент видно без анімацій', async ({ browser }, info) => {
      test.skip(info.project.name !== 'desktop', 'достатньо одного прогону')
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })
      const page = await context.newPage()
      await page.goto(URL)
      await scrollThrough(page)
      const hidden = await page.evaluate(() =>
        Array.from(document.querySelectorAll('main h1, main h2, main h3, main p, main img'))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return false
            if ((el as HTMLElement).closest('[hidden],[aria-hidden=true]')) return false
            let o = 1
            for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
            return o < 0.9
          })
          .map((el) => el.tagName + ':' + (el.textContent ?? '').slice(0, 30))
      )
      expect(hidden).toEqual([])
      await context.close()
    })
  })
}

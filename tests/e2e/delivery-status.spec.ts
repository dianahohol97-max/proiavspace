import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * «Статус зйомки для клієнта»: the status screen and the banner through the
 * test-only route /[locale]/e2e/delivery (same components and decision logic
 * as /g/[slug], no database), and the dashboard control through
 * /[locale]/e2e/delivery/control (in-memory save). E2E_THEME_PREVIEW=1.
 */
const SHOTS = process.env.DELIVERY_SHOTS_DIR ?? join('test-results', 'delivery-status')
const THEMES = ['tysha', 'opivnich', 'povitria', 'plivka', 'zhurnal', 'galereia', 'arkhiv', 'prodakshn']

async function noHorizontalOverflow(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

test.describe('екран статусу для клієнта', () => {
  test('«Обробка» в «Опівночі»: назва, фотограф, три кроки, дата; скріншот', async ({ page }, info) => {
    await page.goto('/uk/e2e/delivery?status=editing&theme=opivnich&eta=2026-12-14')
    const screen = page.locator('[data-delivery="screen"]')
    await expect(screen).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Марта і Богдан')
    await expect(screen).toContainText('Ольга Вишня')
    await expect(screen).toContainText('Ваші кадри вже в роботі')
    const steps = screen.locator('ol li')
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(0)).toContainText('Зйомка')
    await expect(steps.nth(2)).toContainText('Готово')
    await expect(screen.locator('li[aria-current="step"]')).toContainText('Обробка')
    await expect(screen).toContainText('Орієнтовно до 14 грудня 2026')
    await noHorizontalOverflow(page)
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: join(SHOTS, `screen-opivnich-${info.project.name}.png`), fullPage: true })
  })

  test('«Зйомка пройшла» у світлій «Тиші», без дати — жодного «орієнтовно»; скріншот', async ({ page }, info) => {
    await page.goto('/uk/e2e/delivery?status=shot&theme=tysha')
    const screen = page.locator('[data-delivery="screen"]')
    await expect(screen.locator('li[aria-current="step"]')).toContainText('Зйомка')
    await expect(screen).not.toContainText('Орієнтовно')
    await noHorizontalOverflow(page)
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: join(SHOTS, `screen-tysha-${info.project.name}.png`), fullPage: true })
  })

  test('англійською: дата у форматі en', async ({ page }) => {
    await page.goto('/en/e2e/delivery?status=editing&eta=2026-12-14')
    const screen = page.locator('[data-delivery="screen"]')
    await expect(screen).toContainText('Your photos are already in progress')
    await expect(screen).toContainText('Expected by 14 December 2026')
    await expect(screen.locator('li[aria-current="step"]')).toContainText('Editing')
  })

  test('приховані фото не рахуються: лише hidden → усе одно екран', async ({ page }) => {
    await page.goto('/uk/e2e/delivery?status=editing&hidden=3')
    await expect(page.locator('[data-delivery="screen"]')).toBeVisible()
    await expect(page.locator('main figure')).toHaveCount(0)
  })

  test('у кожному стилі: текст читається (≥ 4.5:1) і нічого не вилазить за екран', async ({ page }, info) => {
    test.skip(info.project.name === 'android', 'стилі перевіряємо на десктопі й iPhone')
    for (const theme of THEMES) {
      await page.goto(`/uk/e2e/delivery?status=editing&theme=${theme}&eta=2026-12-14`)
      await expect(page.locator('[data-delivery="screen"]')).toBeVisible()
      await noHorizontalOverflow(page)
      const worst = await page.evaluate(() => {
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
        const lum = ([r, g, b]: number[]) =>
          [r, g, b]
            .map((v) => v / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
        const bgOf = (el: Element | null): string => {
          for (let node = el; node; node = node.parentElement) {
            const bg = getComputedStyle(node).backgroundColor
            if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg
          }
          return 'rgb(255, 255, 255)'
        }
        const screen = document.querySelector('[data-delivery="screen"]')!
        const texts = Array.from(screen.querySelectorAll('h1, p, li span, a')).filter(
          (el) => (el as HTMLElement).innerText?.trim() && !el.closest('details')
        )
        let min = 21
        let at = ''
        for (const el of texts) {
          const fg = lum(parse(getComputedStyle(el).color))
          const bg = lum(parse(bgOf(el)))
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
          if (ratio < min) {
            min = ratio
            at = (el as HTMLElement).innerText.slice(0, 40)
          }
        }
        return { min, at }
      })
      expect(worst.min, `${theme}: «${worst.at}»`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

test.describe('плашка над галереєю і звичайна галерея', () => {
  test("кілька прев'ю → галерея з плашкою «Повна галерея в обробці · орієнтовно до …»; скріншот", async ({ page }, info) => {
    await page.goto('/uk/e2e/delivery?status=editing&theme=opivnich&photos=4&eta=2026-12-14')
    const banner = page.locator('[data-delivery="banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveText(/Повна галерея в обробці\s*·\s*орієнтовно до 14 грудня 2026/)
    await expect(page.locator('[data-delivery="screen"]')).toHaveCount(0)
    await expect(page.locator('figure:visible').first()).toBeVisible()
    // The strip sits above the cover.
    const [bannerBox, coverBox] = await Promise.all([banner.boundingBox(), page.locator('header').first().boundingBox()])
    expect(bannerBox!.y).toBeLessThan(coverBox!.y)
    await noHorizontalOverflow(page)
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: join(SHOTS, `banner-opivnich-${info.project.name}.png`) })
  })

  test("'ready' → звичайна галерея без плашки (і з фото, і без)", async ({ page }) => {
    await page.goto('/uk/e2e/delivery?status=ready&photos=4')
    await expect(page.locator('figure:visible').first()).toBeVisible()
    await expect(page.locator('[data-delivery]')).toHaveCount(0)
    await page.goto('/uk/e2e/delivery?status=ready&photos=0')
    await expect(page.locator('[data-delivery]')).toHaveCount(0)
  })

  test('без статусу → як раніше: ні екрана, ні плашки', async ({ page }) => {
    await page.goto('/uk/e2e/delivery?photos=0')
    await expect(page.locator('[data-delivery]')).toHaveCount(0)
    await page.goto('/uk/e2e/delivery?photos=4&eta=2026-12-14')
    await expect(page.locator('[data-delivery]')).toHaveCount(0)
  })
})

test.describe('кабінет: перемикач статусу', () => {
  test('статус і дата зберігаються одразу, без кнопки; переживають перезавантаження', async ({ page, isMobile }) => {
    await page.goto('/uk/e2e/delivery/control?reset=1')
    const group = page.getByRole('radiogroup', { name: 'Статус для клієнта' })
    await expect(group.getByRole('radio')).toHaveCount(4)
    await expect(group.getByRole('radio', { name: 'Без статусу' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Орієнтовна дата готовності')).toHaveCount(0)

    const editing = group.getByRole('radio', { name: 'Обробка' })
    // Thumb-sized on phones.
    const box = await editing.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    if (isMobile) await editing.tap()
    else await editing.click()
    await expect(editing).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('status')).toHaveText('Збережено')

    const date = page.getByLabel('Орієнтовна дата готовності')
    await expect(date).toBeVisible()
    await date.fill('2026-12-14')
    await expect(page.getByRole('status')).toHaveText('Збережено')

    await page.goto('/uk/e2e/delivery/control')
    await expect(page.getByTestId('saved-state')).toHaveText(/^editing\|2026-12-14\|/)
    await expect(page.getByRole('radio', { name: 'Обробка' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Орієнтовна дата готовності')).toHaveValue('2026-12-14')

    // «Готово»: the date field goes away; «Прибрати дату» was not needed.
    await page.getByRole('radio', { name: 'Готово' }).click()
    await expect(page.getByRole('status')).toHaveText('Збережено')
    await expect(page.getByLabel('Орієнтовна дата готовності')).toHaveCount(0)
    await page.goto('/uk/e2e/delivery/control')
    await expect(page.getByTestId('saved-state')).toHaveText(/^ready\|/)

    // Back to «Без статусу».
    await page.getByRole('radio', { name: 'Без статусу' }).click()
    await expect(page.getByRole('status')).toHaveText('Збережено')
    await page.goto('/uk/e2e/delivery/control')
    await expect(page.getByTestId('saved-state')).toHaveText(/^null\|/)
  })

  test('«Прибрати дату» очищує дату', async ({ page }) => {
    await page.goto('/uk/e2e/delivery/control?reset=1')
    await page.getByRole('radio', { name: 'Зйомка пройшла' }).click()
    await page.getByLabel('Орієнтовна дата готовності').fill('2026-12-20')
    await expect(page.getByRole('status')).toHaveText('Збережено')
    await page.goto('/uk/e2e/delivery/control')
    await expect(page.getByTestId('saved-state')).toHaveText(/^shot\|2026-12-20\|/)
    await page.getByRole('button', { name: 'Прибрати дату' }).click()
    await expect(page.getByRole('status')).toHaveText('Збережено')
    await page.goto('/uk/e2e/delivery/control')
    await expect(page.getByTestId('saved-state')).toHaveText(/^shot\|null\|/)
  })
})

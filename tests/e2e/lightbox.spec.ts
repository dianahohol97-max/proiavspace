import { expect, test, type Page } from '@playwright/test'

/** Lightbox (yet-another-react-lightbox) on the demo gallery: 24 photos, /themes/NN.webp. */

const counter = (page: Page) => page.locator('.yarl__counter')
const viewer = (page: Page) => page.locator('.yarl__portal_open')
const currentSlide = (page: Page) => page.locator('.yarl__slide_current img.yarl__slide_image')

async function openTile(page: Page, index: number, isMobile: boolean) {
  // data-i: the tile's place in the gallery (the DOM order of the server-rendered
  // masonry head is column by column, and phone/desktop variants both exist).
  const image = page.locator(`main figure[data-i="${index}"]:visible`).locator('img').first()
  if (isMobile) await image.tap()
  else await image.click()
  await expect(viewer(page)).toBeVisible()
}

/** A finger/mouse drag across the slide: pointer events, as YARL listens for. */
async function swipe(page: Page, direction: 'left' | 'right') {
  const box = (await page.locator('.yarl__container').boundingBox())!
  const y = box.y + box.height / 2
  const from = direction === 'left' ? box.x + box.width * 0.8 : box.x + box.width * 0.2
  const to = direction === 'left' ? box.x + box.width * 0.2 : box.x + box.width * 0.8
  await page.mouse.move(from, y)
  await page.mouse.down()
  for (let step = 1; step <= 8; step++) await page.mouse.move(from + ((to - from) * step) / 8, y)
  await page.mouse.up()
}

test.describe('лайтбокс', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/uk/gallery-demo')
    await expect(page.locator('main figure:visible').first()).toBeVisible()
  })

  test('відкривається на тапнутому фото на весь екран, у великому прев’ю', async ({ page, isMobile }) => {
    await openTile(page, 2, isMobile)
    await expect(counter(page)).toHaveText('3 / 24')
    const box = (await viewer(page).boundingBox())!
    const size = page.viewportSize()!
    expect(box.width).toBeGreaterThanOrEqual(size.width - 1)
    expect(box.height).toBeGreaterThanOrEqual(size.height - 1)
    await expect(currentSlide(page)).toHaveAttribute('src', '/themes/03.webp')
    // Thumbnails strip, zoom and full screen are there; labels are translated.
    await expect(page.locator('.yarl__thumbnails_thumbnail').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Збільшити' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'На весь екран' })).toBeVisible()
    await expect(viewer(page).getByRole('link', { name: 'Завантажити оригінал' })).toHaveAttribute(
      'href',
      '/themes/03.jpg'
    )
  })

  test('свайп гортає вперед і назад, по колу', async ({ page, isMobile }) => {
    await openTile(page, 0, isMobile)
    await expect(counter(page)).toHaveText('1 / 24')
    await swipe(page, 'left')
    await expect(counter(page)).toHaveText('2 / 24')
    await expect(currentSlide(page)).toHaveAttribute('src', '/themes/02.webp')
    await swipe(page, 'right')
    await expect(counter(page)).toHaveText('1 / 24')
    await swipe(page, 'right')
    await expect(counter(page)).toHaveText('24 / 24')
    if (!isMobile) {
      await page.keyboard.press('ArrowRight')
      await expect(counter(page)).toHaveText('1 / 24')
    }
  })

  test('сердечко всередині відмічає саме поточне фото і сходиться з сіткою', async ({ page, isMobile }) => {
    const chip = page.getByText(/♥\s*\d+/).first()
    const before = Number((await chip.innerText()).match(/\d+/)![0])
    await openTile(page, 1, isMobile) // photo 2 — not among the demo's initial favourites (5, 11)
    const heart = viewer(page).getByRole('button', { name: 'Додати до обраного' })
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    await expect(chip).toContainText(String(before + 1))
    // Next photo: its own state, not the previous one's.
    await swipe(page, 'left')
    await expect(counter(page)).toHaveText('3 / 24')
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    // Close: the grid tile of photo 2 shows the pick made inside the viewer.
    await page.getByRole('button', { name: 'Закрити' }).click()
    await expect(page.locator('.yarl__portal')).toHaveCount(0)
    await expect(
      page.locator('main figure[data-i="1"]:visible').getByRole('button', { name: 'Додати до обраного' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('закривається хрестиком і Escape', async ({ page, isMobile }) => {
    await openTile(page, 4, isMobile)
    await page.getByRole('button', { name: 'Закрити' }).click()
    await expect(page.locator('.yarl__portal')).toHaveCount(0)
    if (!isMobile) {
      await openTile(page, 4, isMobile)
      await page.keyboard.press('Escape')
      await expect(page.locator('.yarl__portal')).toHaveCount(0)
    }
  })

  test('підписи перекладені: англійська галерея', async ({ page, isMobile }) => {
    await page.goto('/en/gallery-demo')
    await openTile(page, 0, isMobile)
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  })
})

import { expect, test, type Page } from '@playwright/test'

/**
 * «Рядки» (justified rows, ?layout=rows): rows of one height, every photo
 * whole, full rows edge to edge; the server-rendered head and the virtualized
 * tail join without a seam; hearts and the lightbox work on head and tail
 * tiles; every theme and the designer's grid settings (columns, gap, radius).
 * Runs on desktop, iPhone 13 and Pixel 7 (playwright.config.ts).
 */

type Row = { top: number; indices: number[]; heights: number[]; left: number; right: number; ratioError: number }

/** Visible tiles grouped into rows, measured against the grid host. */
async function measureRows(page: Page): Promise<{ rows: Row[]; overlaps: number }> {
  return page.evaluate(() => {
    const host = document.querySelector('main [data-virtual]')!.getBoundingClientRect()
    const tiles = [...document.querySelectorAll<HTMLElement>('main figure')]
      .map((figure) => ({ figure, box: figure.getBoundingClientRect() }))
      .filter(({ box }) => box.bottom > 0 && box.top < window.innerHeight && box.width > 0)
    const groups = new Map<number, typeof tiles>()
    for (const tile of tiles) {
      const key = Math.round(tile.box.top)
      groups.set(key, [...(groups.get(key) ?? []), tile])
    }
    let overlaps = 0
    for (let a = 0; a < tiles.length; a++)
      for (let b = a + 1; b < tiles.length; b++) {
        const A = tiles[a].box
        const B = tiles[b].box
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) overlaps++
      }
    const rows = [...groups.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([top, group]) => {
        group.sort((x, y) => x.box.left - y.box.left)
        // The tile keeps its photo's proportions (nothing cropped): box ratio = image ratio.
        const ratioError = Math.max(
          ...group.map(({ figure, box }) => {
            const image = figure.querySelector('img')!
            const want = Number(image.getAttribute('width')) / Number(image.getAttribute('height'))
            return Math.abs(box.width / box.height - want) / want
          })
        )
        return {
          top,
          indices: group.map(({ figure }) => Number(figure.dataset.i)),
          heights: group.map(({ box }) => box.height),
          left: group[0].box.left - host.left,
          right: host.right - group[group.length - 1].box.right,
          ratioError,
        }
      })
    return { rows, overlaps }
  })
}

function expectJustified(rows: Row[], total: number) {
  // Rows cut by the screen edge are skipped; the last gallery row is left-aligned.
  const whole = rows.slice(1, -1)
  expect(whole.length).toBeGreaterThan(0)
  for (const row of whole) {
    expect(Math.max(...row.heights) - Math.min(...row.heights)).toBeLessThan(1)
    expect(row.left).toBeLessThan(1)
    if (!row.indices.includes(total - 1)) expect(Math.abs(row.right)).toBeLessThan(1.5)
    expect(row.ratioError).toBeLessThan(0.02)
    // gallery order inside a row
    expect(row.indices).toEqual([...row.indices].sort((a, b) => a - b))
  }
}

test.describe('«Рядки»', () => {
  test('рядки однакової висоти від краю до краю, без обрізання і накладань', async ({ page }) => {
    await page.goto('/uk/gallery-demo?layout=rows&cover=minimal')
    await expect(page.locator('main [data-virtual]')).toHaveCount(1)
    await expect(page.locator('main[data-layout="rows"]')).toHaveCount(1)
    const { rows, overlaps } = await measureRows(page)
    expect(overlaps).toBe(0)
    expectJustified(rows, 24)
  })

  test('1500 фото: віртуалізація, шов голова→хвіст непомітний, останнє фото відкривається', async ({ page }) => {
    const N = 1500
    await page.goto(`/uk/gallery-demo?layout=rows&n=${N}`)
    await expect(page.locator('main [data-virtual]')).toHaveCount(1)
    expect(await page.locator('main figure').count()).toBeLessThan(150)
    // Across the seam: the head's last rows and the tail's first ones.
    const head = page.locator('main [class*="ssrRows"] figure').last()
    await head.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -window.innerHeight / 3))
    await page.waitForTimeout(300)
    const seam = await measureRows(page)
    expect(seam.overlaps).toBe(0)
    expectJustified(seam.rows, N)
    // gaps between rows are even across the seam
    const tops = seam.rows.map((row, k) => row.top + Math.max(...row.heights) - (seam.rows[k + 1]?.top ?? NaN))
    const gaps = tops.filter((gap) => !Number.isNaN(gap)).map((gap) => -gap)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1.5)

    // Deep in the virtualized tail
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
    await page.waitForTimeout(400)
    const deep = await measureRows(page)
    expect(deep.overlaps).toBe(0)
    expectJustified(deep.rows, N)
    expect(await page.locator('main figure').count()).toBeLessThan(150)

    const last = page.locator(`main figure[data-i="${N - 1}"]`)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(last).toBeVisible()
    await last.locator('img').click()
    await expect(page.locator('.yarl__counter')).toHaveText(`${N} / ${N}`)
  })

  test('сердечко і лайтбокс на плитці з хвоста', async ({ page, isMobile }) => {
    await page.goto('/uk/gallery-demo?layout=rows&n=200')
    await expect(page.locator('main [data-virtual]')).toHaveCount(1)
    const tile = page.locator('main figure[data-i="60"]')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 4))
    await tile.scrollIntoViewIfNeeded()
    const heart = tile.getByRole('button', { name: 'Додати до обраного' })
    if (isMobile) await heart.tap()
    else await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Закрити' })).toHaveCount(0)
    const image = tile.locator('img')
    if (isMobile) await image.tap()
    else await image.click()
    await expect(page.locator('.yarl__counter')).toHaveText('61 / 200')
  })

  for (const theme of ['tysha', 'opivnich', 'povitria', 'plivka', 'zhurnal', 'galereia', 'arkhiv', 'prodakshn']) {
    test(`тема «${theme}»: рядки рівні`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'android', 'теми досить на десктопі й iPhone')
      await page.goto(`/uk/gallery-demo?layout=rows&cover=minimal&theme=${theme}`)
      await expect(page.locator('main [data-virtual]')).toHaveCount(1)
      const { rows, overlaps } = await measureRows(page)
      expect(overlaps).toBe(0)
      expectJustified(rows, 24)
    })
  }

  for (const [cols, gap, radius] of [
    [2, 0, 0],
    [4, 30, 22],
  ]) {
    test(`налаштування сітки: ${cols} колонки, проміжок ${gap}, кути ${radius}`, async ({ page }, testInfo) => {
      await page.goto(`/uk/gallery-demo?layout=rows&cover=minimal&n=120&cols=${cols}&gap=${gap}&radius=${radius}`)
      await expect(page.locator('main [data-virtual]')).toHaveCount(1)
      const { rows, overlaps } = await measureRows(page)
      expect(overlaps).toBe(0)
      expectJustified(rows, 120)
      const first = page.locator('main figure').first()
      await expect(first).toHaveCSS('border-top-left-radius', `${radius}px`)
      if (testInfo.project.name === 'desktop') {
        // more «columns» → lower rows → more photos per row
        const perRow = rows.slice(1, -1).reduce((sum, row) => sum + row.indices.length, 0) / (rows.length - 2)
        expect(perRow).toBeGreaterThan(cols === 4 ? 3 : 1.5)
      }
    })
  }
})

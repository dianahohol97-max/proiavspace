import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { readJpegDpi, readJpegIcc } from '../../src/lib/album/export/jpeg-meta'
import { formatFor, mmToPt, sheetSizePx } from '../../src/lib/album/geometry'
import { normalizeSpec } from '../../src/lib/album/profiles'

/**
 * Конструктор альбомів, повний шлях фотографа на локальному демо (без БД:
 * localStorage + фото з public/showcase): профіль друку → альбом із галереї →
 * два заповнені розвороти (перетягування й автозаповнення) → експорт JPEG і
 * PDF з перевіркою розміру, DPI і сторінок. На телефоні — перегляд.
 */

const BASE = '/uk/e2e/albums'

/** JPEG frame size from the SOF marker. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let at = 2
  while (at < bytes.length) {
    const marker = bytes[at + 1]!
    const len = (bytes[at + 2]! << 8) | bytes[at + 3]!
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (bytes[at + 5]! << 8) | bytes[at + 6]!, width: (bytes[at + 7]! << 8) | bytes[at + 8]! }
    }
    at += 2 + len
  }
  throw new Error('no SOF')
}

async function freshStorage(page: Page) {
  await page.goto(BASE)
  await page.evaluate(() => window.localStorage.clear())
}

// The profile the test creates: a 30×30 album copied from the example and edited.
const PROFILE = normalizeSpec({
  spreadWidthMm: 600,
  spreadHeightMm: 300,
  bleedMm: 4,
  safeMm: 8,
  marginMm: 12,
  gapMm: 4,
  dpi: 200,
  colorProfile: 'srgb',
  cover: { widthMm: 615, heightMm: 300, bleedMm: 15, spineMm: 15 },
})

test.describe('конструктор альбомів', () => {
  test('профіль → альбом з галереї → 2 розвороти → експорт JPEG і PDF', async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, 'редагування — на ноутбуці; телефон перевіряє окремий тест')
    test.setTimeout(240_000)
    await freshStorage(page)

    // 1. Print profile: copy an example, change bleed and DPI.
    await page.goto(`${BASE}/profiles`)
    await page.getByRole('button', { name: 'Скопіювати й змінити' }).first().click()
    const form = page.getByTestId('profile-form')
    await form.getByLabel('Назва').fill('Моя друкарня 30×30')
    await form.getByLabel('Виліт (bleed)').fill('4')
    // A lower DPI keeps the export light in CI; the geometry is the same.
    await form.getByLabel('Роздільна здатність').fill('200')
    await expect(page.getByTestId('profile-preview')).toContainText(
      `${sheetSizePx(formatFor(PROFILE, 'spread'), 200).width}×${sheetSizePx(formatFor(PROFILE, 'spread'), 200).height} px`
    )
    await form.getByRole('button', { name: 'Зберегти профіль' }).click()
    await expect(page.getByTestId('own-profiles')).toContainText('Моя друкарня 30×30')
    await expect(page.getByTestId('own-profiles')).toContainText('виліт 4 мм · 200 DPI')

    // 2. Album from the (demo) gallery, own profile, no auto layout.
    await page.goto(BASE)
    await page.getByRole('button', { name: '+ Новий альбом' }).click()
    const newAlbum = page.getByTestId('new-album')
    await newAlbum.getByLabel('Назва').fill('Весілля Ані й Тараса')
    await expect(newAlbum.getByLabel('Профіль друку')).toHaveValue(/[0-9a-f-]{36}/) // own profile preselected
    await newAlbum.getByLabel('Одразу розкласти').uncheck()
    await newAlbum.getByRole('button', { name: 'Створити' }).click()
    await expect(page.getByTestId('album-editor')).toBeVisible()
    await expect(page.getByTestId('strip-photo')).toHaveCount(16)

    // 3. Spread 1: template + drag photos from the strip into the slots.
    await page.getByRole('button', { name: '+ Перший розворот' }).click()
    await page.getByRole('tab', { name: 'Ліва' }).click()
    await page.getByRole('button', { name: 'Шаблон: 1 фото під обріз' }).click()
    await page.getByRole('tab', { name: 'Права' }).click()
    await page.getByRole('button', { name: 'Шаблон: 2 поруч', exact: true }).click()
    const slots = page.getByTestId('spread-sheet').getByTestId('slot')
    await expect(slots).toHaveCount(3)
    const strip = page.getByTestId('strip-photo')
    for (let i = 0; i < 3; i++) await strip.nth(i).dragTo(slots.nth(i))
    await expect(page.getByTestId('spread-sheet').locator('[data-testid="slot"][data-filled="true"]')).toHaveCount(3)

    // Swap the first two photos, then undo/redo the swap.
    const src0 = await slots.nth(0).locator('img').getAttribute('src')
    const src1 = await slots.nth(1).locator('img').getAttribute('src')
    // The swap handle shows on hover and stays while the slot is selected.
    await slots.nth(0).click()
    await slots.nth(0).getByLabel('Поміняти місцями').dragTo(slots.nth(1))
    await expect(slots.nth(0).locator('img')).toHaveAttribute('src', src1!)
    await page.getByRole('button', { name: 'Скасувати' }).click()
    await expect(slots.nth(0).locator('img')).toHaveAttribute('src', src0!)
    await page.getByRole('button', { name: 'Повторити' }).click()
    await expect(slots.nth(0).locator('img')).toHaveAttribute('src', src1!)

    // Crop: zoom the selected slot and set its focal point.
    await slots.nth(2).click()
    const inspector = page.getByTestId('slot-inspector')
    await expect(inspector).toBeVisible()
    await inspector.getByLabel(/Масштаб/).fill('1.5')
    await expect(inspector).toContainText('Масштаб · 150%')
    await inspector.getByTestId('focal-picker').click({ position: { x: 10, y: 10 } })
    // The bundled demo photos are 2000 px: a full-bleed page at 200 DPI needs more.
    await expect(page.getByTestId('dpi-warning').first()).toBeVisible()
    await expect(page.getByTestId('guides')).toBeVisible()

    // 4. Spread 2: pick two unused photos in the strip and auto-fill.
    await page.getByRole('button', { name: '+ Розворот' }).click()
    await expect(page.getByTestId('spread-thumb')).toHaveCount(2)
    await page.getByRole('combobox', { name: 'Фільтр плівки' }).selectOption('unused')
    await strip.nth(0).click()
    await strip.nth(4).click()
    await page.getByRole('tab', { name: 'Шаблони' }).or(page.getByRole('button', { name: 'Шаблони', exact: true })).first().click()
    await page.getByRole('button', { name: /Заповнити розворот обраними \(2\)/ }).click()
    await expect(page.getByTestId('spread-sheet').locator('[data-testid="slot"][data-filled="true"]')).toHaveCount(2)

    // 5. Autosave → reload → everything is still there.
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })
    await page.screenshot({ path: testInfo.outputPath('editor.png') })
    await page.reload()
    await expect(page.getByTestId('spread-thumb')).toHaveCount(2)
    await expect(page.getByTestId('spread-sheet').locator('[data-testid="slot"][data-filled="true"]')).toHaveCount(3)

    // 6. Export JPEG of the current spread: exact size with bleed, DPI and ICC in the file.
    const expected = sheetSizePx(formatFor(PROFILE, 'spread'), 200)
    await page.getByRole('button', { name: 'Експорт', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Експорт' })
    await dialog.getByLabel(/JPEG розворотів/).check()
    await dialog.getByLabel('Лише поточний').check()
    const jpegDownload = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Експортувати' }).click()
    const jpeg = await jpegDownload
    expect(jpeg.suggestedFilename()).toMatch(/^vesillia-ani-y-tarasa-01-rozvorot-1\.jpg$/)
    const jpegPath = testInfo.outputPath('spread.jpg')
    await jpeg.saveAs(jpegPath)
    const jpegBytes = new Uint8Array(readFileSync(jpegPath))
    expect(jpegSize(jpegBytes)).toEqual(expected)
    expect(readJpegDpi(jpegBytes)).toEqual({ units: 1, x: 200, y: 200 })
    expect(readJpegIcc(jpegBytes)?.length).toBeGreaterThan(100)
    await expect(dialog.getByTestId('export-done')).toBeVisible()

    // 7. Export PDF of the whole album with crop marks.
    await dialog.getByLabel(/PDF альбому/).check()
    await dialog.getByLabel(/Усі розвороти/).check()
    const pdfDownload = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Експортувати' }).click()
    const pdf = await pdfDownload
    expect(pdf.suggestedFilename()).toBe('vesillia-ani-y-tarasa.pdf')
    const pdfPath = testInfo.outputPath('album.pdf')
    await pdf.saveAs(pdfPath)
    const pdfBytes = readFileSync(pdfPath)
    expect(pdfBytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.6')
    const pdfText = pdfBytes.toString('latin1')
    expect(pdfText.match(/\/Type \/Page\b/g)?.length).toBe(2)
    expect(pdfText).toContain(`/Width ${expected.width} /Height ${expected.height}`)
    const info = spawnSync('pdfinfo', ['-box', pdfPath], { encoding: 'utf8' })
    if (info.status === 0) {
      expect(info.stdout).toMatch(/Pages:\s+2/)
      const size = info.stdout.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/)!
      // trim 600×300 + bleed 4 mm + 10 mm slug for crop marks on each side
      expect(Math.abs(Number(size[1]) - mmToPt(600 + 2 * 4 + 2 * 10))).toBeLessThan(0.01)
    }
  })

  /** Seeds an empty demo album with a cover whose spine grows 1 mm per spread. */
  async function seedAlbum(page: Page, title: string): Promise<string> {
    await freshStorage(page)
    return page.evaluate((albumTitle) => {
      const projectId = crypto.randomUUID()
      window.localStorage.setItem(
        'proiav-album-demo-v1',
        JSON.stringify({
          profiles: [],
          projects: [
            {
              id: projectId,
              title: albumTitle,
              galleryId: 'demo-gallery',
              profileId: null,
              updatedAt: new Date().toISOString(),
              // Low DPI keeps the CI export light; geometry is the same at 300.
              spec: {
                spreadWidthMm: 600, spreadHeightMm: 300, bleedMm: 3, safeMm: 8, marginMm: 12, gapMm: 4, dpi: 120, colorProfile: 'srgb',
                cover: { widthMm: 610, heightMm: 300, bleedMm: 10, spineMm: 6, spinePerSpreadMm: 1 },
              },
              spreads: [],
            },
          ],
        })
      )
      return projectId
    }, title)
  }

  test('автодизайн, обкладинка з корінцем, поворот, текст, варіанти ←/→ → PDF з живим текстом у Web Worker', async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, 'редагування — на ноутбуці')
    test.setTimeout(240_000)
    const id = await seedAlbum(page, 'Весілля Ані й Тараса')
    await page.goto(`${BASE}/${id}`)
    await expect(page.getByTestId('album-editor')).toBeVisible()
    const filled = page.getByTestId('spread-sheet').locator('[data-testid="slot"][data-filled="true"]')

    // Autodesign of all 16 demo frames.
    await page.getByRole('radio', { name: 'Звично' }).click()
    await page.getByRole('button', { name: /Автодизайн з невикористаних/ }).click()
    const thumbs = page.getByTestId('spread-thumb')
    await expect(thumbs.first()).toBeVisible()
    const spreadCount = await thumbs.count()
    expect(spreadCount).toBeGreaterThanOrEqual(4)
    await page.getByRole('combobox', { name: 'Фільтр плівки' }).selectOption('unused')
    await expect(page.getByTestId('strip-photo')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Фільтр плівки' }).selectOption('all')

    // Cover: spine = 6 mm + 1 mm × spreads; preset puts a title and the spine text.
    await page.getByRole('button', { name: '+ Обкладинка' }).click()
    await expect(page.getByTestId('spread-list')).toContainText(`Обкладинка · ${6 + spreadCount} мм`)
    await page.getByRole('button', { name: 'Обкладинка: Фото на всю обкладинку' }).click()
    await page.getByTestId('strip-photo').nth(4).dragTo(page.getByTestId('spread-sheet').getByTestId('slot').first(), { targetPosition: { x: 40, y: 40 } })
    await expect(filled).toHaveCount(1)
    await expect(page.getByTestId('spread-sheet').getByTestId('text-item')).toHaveCount(2)
    await expect(page.getByTestId('spine-guide')).toBeVisible()

    // Spread 1: rotate a photo 90° and straighten by −3°; add a script text.
    await thumbs.nth(1).click()
    await page.getByTestId('spread-sheet').getByTestId('slot').first().click()
    await page.getByRole('button', { name: 'Повернути на 90° за годинниковою' }).click()
    await page.getByLabel('Вільний поворот').fill('-3')
    await expect(page.getByTestId('slot-inspector')).toContainText('Поворот · 87°')
    await page.getByRole('button', { name: '+ Текст' }).click()
    await page.locator('#text-content').fill('Наш день\n12.09.2026')
    await page.getByTestId('text-inspector').getByLabel('Шрифт').selectOption('greatvibes')
    await expect(page.getByTestId('spread-sheet').getByTestId('text-item')).toHaveCount(1)

    // Spread 2: drop three marked photos at once → layout variants, flip with the arrow keys.
    await thumbs.nth(2).click()
    const before = await filled.count()
    const strip = page.getByTestId('strip-photo')
    for (const i of [13, 14, 15]) await strip.nth(i).click()
    await strip.nth(14).dragTo(page.getByTestId('spread-sheet'), { targetPosition: { x: 5, y: 5 } })
    await expect(page.getByTestId('variant-bar')).toBeVisible()
    await expect(page.getByTestId('variant-counter')).toHaveText(/^Варіант 1 з \d+$/)
    const total = await filled.count()
    expect(total).toBeGreaterThan(before)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('variant-counter')).toHaveText(/^Варіант 2 з \d+$/)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('variant-counter')).toHaveText(/^Варіант 2 з \d+$/)
    await expect(filled).toHaveCount(total)
    // All the flipping is a single undo step.
    await page.getByRole('button', { name: 'Скасувати' }).click()
    await expect(filled).toHaveCount(before)
    await page.getByRole('button', { name: 'Повторити' }).click()
    await expect(filled).toHaveCount(total)

    // Autosave → reload → text and rotation survive.
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 })
    await page.screenshot({ path: testInfo.outputPath('editor-text.png') })
    await page.reload()
    await thumbs.nth(1).click()
    await expect(page.getByTestId('spread-sheet').getByTestId('text-item')).toHaveCount(1)
    await page.getByTestId('spread-sheet').getByTestId('slot').first().click()
    await expect(page.getByTestId('slot-inspector')).toContainText('Поворот · 87°')

    // PDF of the whole album, rendered in the Web Worker; live text with embedded fonts.
    await page.getByRole('button', { name: 'Експорт', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Експорт' })
    await dialog.getByLabel(/PDF альбому/).check()
    await dialog.getByLabel(/Усі розвороти/).check()
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Експортувати' }).click()
    const pdf = await download
    await expect(dialog.getByTestId('export-done')).toHaveAttribute('data-engine', 'worker')
    const pdfPath = testInfo.outputPath('album-text.pdf')
    await pdf.saveAs(pdfPath)
    const text = spawnSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })
    if (text.status === 0) {
      const flat = text.stdout.replace(/\s+/g, ' ')
      expect(flat).toContain('Наш день 12.09.2026')
      expect(flat).toContain('Весілля Ані й Тараса')
      const fonts = spawnSync('pdffonts', [pdfPath], { encoding: 'utf8' }).stdout
      expect(fonts).toMatch(/GreatVibes-Regular\s+CID TrueType/)
      expect(fonts).toMatch(/CormorantGaramond-Medium\s+CID TrueType/)
      const pages = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' }).stdout
      expect(pages).toMatch(new RegExp(`Pages:\\s+${spreadCount + 1}\\b`))
    }
  })

  test('сховище не віддає оригінали (CORS) — експорт пояснює, що налаштувати', async ({ page, isMobile }) => {
    test.skip(isMobile, 'експорт — на ноутбуці')
    const id = await seedAlbum(page, 'CORS')
    await page.goto(`${BASE}/${id}`)
    await page.getByRole('button', { name: /Автодизайн з невикористаних/ }).click()
    await expect(page.getByTestId('spread-thumb').first()).toBeVisible()
    // From now on the «storage» refuses the originals the way a missing CORS rule looks to fetch().
    await page.context().route('**/showcase/*.jpg', (route) => route.abort('accessdenied'))
    await page.getByRole('button', { name: 'Експорт', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Експорт' })
    await dialog.getByLabel(/JPEG розворотів/).check()
    await dialog.getByLabel('Лише поточний').check()
    await dialog.getByRole('button', { name: 'Експортувати' }).click()
    const alert = dialog.getByRole('alert')
    await expect(alert).toContainText('CORS')
    await expect(alert).toContainText('docs/albums/B2-CORS.md')
    await expect(dialog.getByRole('button', { name: 'Експортувати' })).toBeEnabled()
  })

  test('телефон: альбом відкривається для перегляду', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'лише телефони')
    await freshStorage(page)
    const id = await page.evaluate(() => {
      const projectId = crypto.randomUUID()
      const slot = (x: number, assetId: string) => ({ id: crypto.randomUUID(), x, y: -3, w: 303, h: 306, assetId, zoom: 1, fx: 0.5, fy: 0.5 })
      const state = {
        profiles: [],
        projects: [
          {
            id: projectId,
            title: 'Перегляд на телефоні',
            galleryId: 'demo-gallery',
            profileId: null,
            updatedAt: new Date().toISOString(),
            spec: { spreadWidthMm: 600, spreadHeightMm: 300, bleedMm: 3, safeMm: 8, marginMm: 12, gapMm: 4, dpi: 300, colorProfile: 'srgb', cover: null },
            spreads: [
              { id: crypto.randomUUID(), kind: 'spread', layout: 'pages:p1-bleed|p1-bleed', slots: [slot(-3, 'demo-01'), slot(300, 'demo-02')] },
            ],
          },
        ],
      }
      window.localStorage.setItem('proiav-album-demo-v1', JSON.stringify(state))
      return projectId
    })
    await page.goto(`${BASE}/${id}`)
    await expect(page.getByTestId('album-phone-viewer')).toBeVisible()
    await expect(page.getByText('лише перегляд')).toBeVisible()
    await expect(page.getByTestId('album-phone-viewer').locator('img')).toHaveCount(2)
    // No horizontal page scroll on a phone.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

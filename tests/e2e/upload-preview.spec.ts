import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Upload pipeline in the browser (no storage, no database): the test-only
 * page /uk/e2e/upload-preview runs the real readPhotoExif + generateImageVariants
 * on the picked files, exactly as lib/upload/client.ts does before the PUTs.
 *   - HEIC from an iPhone: Chromium can't decode it → heic-to (separate chunk)
 *     → a JPEG preview + WebP grid tile instead of an empty tile;
 *   - capture time from EXIF (HEIC and JPEG);
 *   - EXIF orientation 6 (camera turned): the preview is upright, portrait.
 * The fixtures are tiny synthetic files (tests/e2e/fixtures).
 */
const fixtures = path.join(__dirname, 'fixtures')

type Probe = {
  name: string
  contentType: string
  takenAt: string | null
  orientation: number | null
  width?: number
  height?: number
  variants: { name: string; type: string; width: number; height: number }[]
}

async function run(page: Page): Promise<Probe[]> {
  await page.goto('/uk/e2e/upload-preview')
  await page.setInputFiles('[data-testid=probe-input]', [
    path.join(fixtures, 'iphone.heic'),
    path.join(fixtures, 'canon-rotated.jpg'),
  ])
  await expect(page.getByTestId('probe-state')).toHaveText('done', { timeout: 60_000 })
  return JSON.parse((await page.getByTestId('probe-json').textContent()) ?? '[]') as Probe[]
}

/** RGB of a point (fractions of width/height) of a rendered variant. */
async function pixel(page: Page, file: string, variant: string, fx: number, fy: number): Promise<number[]> {
  return page.locator(`img[data-file="${file}"][data-variant="${variant}"]`).evaluate(
    (image: HTMLImageElement, [x, y]) => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return Array.from(context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data.slice(0, 3))
    },
    [fx, fy]
  )
}
const isWhite = (rgb: number[]) => rgb.every((c) => c > 225)

test('HEIC з iPhone: прев’ю й плитка сітки замість порожньої плитки, дата зйомки з EXIF', async ({ page }) => {
  const [heic] = await run(page)
  expect(heic.name).toBe('iphone.heic')
  expect(heic.takenAt).toBe('2026-06-01T14:03:22.120Z')
  expect([heic.width, heic.height]).toEqual([600, 400])
  const names = heic.variants.map((v) => v.name).sort()
  // навіть мале HEIC-фото (менше 2048 px) отримує прев’ю і плитку
  expect(names).toEqual(['mobile', 'preview', 'thumb'])
  expect(heic.variants.find((v) => v.name === 'preview')).toMatchObject({ type: 'image/jpeg', width: 600, height: 400 })
  // у прев’ю справжній кадр: біла смуга зверху ліворуч, синє тло
  expect(isWhite(await pixel(page, 'iphone.heic', 'preview', 0.1, 0.05))).toBe(true)
  expect(isWhite(await pixel(page, 'iphone.heic', 'preview', 0.9, 0.9))).toBe(false)
})

test('EXIF-орієнтація 6: прев’ю стоїть вертикально, як фото в камері', async ({ page }) => {
  const [, jpeg] = await run(page)
  expect(jpeg.orientation).toBe(6)
  expect(jpeg.takenAt).toBe('2026-06-01T14:03:20.000Z')
  // збережено 600×400, показуємо 400×600
  expect([jpeg.width, jpeg.height]).toEqual([400, 600])
  const thumb = jpeg.variants.find((v) => v.name === 'thumb')!
  expect(thumb.height).toBeGreaterThan(thumb.width)
  // біла смуга зверху ліворуч збереженого кадру після повороту на 90° — праворуч угорі
  expect(isWhite(await pixel(page, 'canon-rotated.jpg', 'thumb', 0.95, 0.2))).toBe(true)
  expect(isWhite(await pixel(page, 'canon-rotated.jpg', 'thumb', 0.05, 0.2))).toBe(false)
})

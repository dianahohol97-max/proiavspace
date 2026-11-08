import { expect, test } from '@playwright/test'
import { cardSuite } from './card-checks'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/** «Видошукач», through the test-only route /uk/e2e/themes/vydoshukach. */
const URL = '/uk/e2e/themes/vydoshukach'

cardSuite('vydoshukach')

test.describe('тема «Видошукач»: своє', () => {
  test('видошукач: точка фокусу фіксується зеленим, під кадром — рядок експозиції', async ({ page }) => {
    await page.goto(URL)
    const af = page.locator('header [class*=Finder_af__]')
    await expect.poll(() => af.evaluate((el) => getComputedStyle(el).borderTopColor), { timeout: 5000 }).toBe('rgb(127, 224, 143)')
    await expect(page.locator('header [class*=Finder_lcd__]')).toContainText('ISO')
  })

  test('EXIF під кадрами портфоліо', async ({ page }) => {
    await page.goto(URL)
    const lines = await page.locator('#portfolio [class*=Finder_exifLine__]').allInnerTexts()
    expect(lines.length).toBeGreaterThanOrEqual(6)
    for (const l of lines) expect(l).toMatch(/f\/[\d.]+.*ISO \d+/)
  })

  test('затвор: шторки закриваються й відкриваються, коли кадр заходить у вікно', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    await page.goto(URL)
    const shutter = page.locator('#portfolio [class*=Finder_shutter__]').first()
    const size = () => shutter.evaluate((el) => getComputedStyle(el).backgroundSize)
    await shutter.evaluate((el) => el.closest('figure')!.scrollIntoView({ block: 'center' }))
    await expect.poll(size).toMatch(/100% 0%/)
  })
})

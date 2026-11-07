import { expect, test, type Page } from '@playwright/test'

/**
 * «Магічна збірка» на локальному демо (без БД): галерея «день весілля» з
 * часом зйомки, двома кадрами без дати, двома схованими від клієнта,
 * сердечками й ретушшю. Альбом одним кліком → три стилі ←/→ → скасування
 * одним кроком → звичайне ручне редагування. Скріншоти всіх розворотів
 * трьох варіантів одного альбому — у test-results (і docs/albums/magic-*).
 */

const BASE = '/uk/e2e/albums'
const STORAGE_KEY = 'proiav-album-demo-v1'
const HIDDEN = ['magic-t09', 'magic-s12']

interface StoredSpread {
  kind: string
  layout: string
  slots: { assetId: string | null }[]
  texts?: { text: string; rotation: number }[]
  spineMm?: number | null
}

async function stored(page: Page): Promise<StoredSpread[]> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? '{}').projects?.[0]?.spreads ?? [], STORAGE_KEY)
}

async function newMagicAlbum(page: Page, gallery: string, spreads: number, style = 'Редакційний') {
  await page.goto(BASE)
  await page.evaluate(() => window.localStorage.clear())
  await page.goto(BASE)
  await page.getByRole('button', { name: '+ Новий альбом' }).click()
  const form = page.getByTestId('new-album')
  await form.getByLabel('Назва').fill('Магія')
  await form.getByLabel('Галерея').selectOption(gallery)
  await form.getByLabel('Розворотів').fill(String(spreads))
  await form.getByLabel('Стиль').selectOption({ label: style })
  await form.getByRole('button', { name: 'Створити' }).click()
  await expect(page.getByTestId('magic-dialog')).toBeVisible()
}

test.describe('магічна збірка альбому', () => {
  test.beforeEach(async ({ isMobile }) => {
    test.skip(isMobile, 'редагування — на ноутбуці')
  })

  test('один клік → три стилі ←/→, жодних дублів і прихованих, скасування одним кроком', async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    await newMagicAlbum(page, 'demo-magic', 8)
    // It starts on its own; progress, then the style switcher.
    const bar = page.getByTestId('magic-bar')
    await expect(bar).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('magic-dialog')).toHaveCount(0)
    await expect(page.getByTestId('magic-style')).toHaveAttribute('data-style', 'editorial')
    await expect(page.getByTestId('magic-report')).toContainText('розділів 4')
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 })

    const thumbs = page.getByTestId('spread-thumb')
    const seen = new Map<string, string>()
    for (const style of ['editorial', 'calm', 'rich']) {
      if (style !== 'editorial') {
        // Arrows work when no form field has the focus (the guides checkbox had it).
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        await page.keyboard.press('ArrowRight')
        await expect(page.getByTestId('magic-style')).toHaveAttribute('data-style', style)
        await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 })
      }
      // Cover + exactly 8 spreads.
      await expect(thumbs).toHaveCount(9)
      const spreads = await stored(page)
      expect(spreads).toHaveLength(9)
      expect(spreads[0]!.kind).toBe('cover')
      const ids = spreads.flatMap((s) => s.slots.map((x) => x.assetId).filter(Boolean)) as string[]
      expect(new Set(ids).size, `${style}: кадр повторюється`).toBe(ids.length)
      for (const h of HIDDEN) expect(ids, `${style}: прихований кадр`).not.toContain(h)
      // The client's hearts and retouch are in.
      for (const pick of ['magic-t18', 'magic-t07', 'magic-s14', 'magic-s02']) expect(ids, `${style}: ${pick}`).toContain(pick)
      // Cover: gallery title and the shoot date; spine 15 mm (example 30×30 profile).
      const coverTexts = (spreads[0]!.texts ?? []).map((t) => t.text)
      expect(coverTexts).toContain('Аня й Тарас')
      expect(coverTexts).toContain('12 вересня 2026')
      seen.set(style, ids.join(','))

      // Screenshots of every spread of this variant.
      await page.getByRole('checkbox', { name: 'Напрямні' }).uncheck()
      for (let i = 0; i < 9; i++) {
        await thumbs.nth(i).click()
        await page.getByTestId('spread-sheet').screenshot({ path: testInfo.outputPath(`magic-${style}-${String(i).padStart(2, '0')}.png`) })
      }
      await page.getByRole('checkbox', { name: 'Напрямні' }).check()
      await page.screenshot({ path: testInfo.outputPath(`magic-${style}-editor.png`) })
    }
    // Three different albums.
    expect(new Set(seen.values()).size).toBe(3)
    // Back around to the first style with ←.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('magic-style')).toHaveAttribute('data-style', 'calm')

    // The whole build — with all the flipping — is ONE undo step.
    await page.getByTestId('magic-undo').click()
    await expect(bar).toHaveCount(0)
    await expect(thumbs).toHaveCount(0)
    await expect(page.getByText('У альбомі ще немає розворотів.')).toBeVisible()
    await page.getByRole('button', { name: 'Повторити' }).click()
    await expect(thumbs).toHaveCount(9)
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 15_000 })

    // From here on: ordinary manual editing (and the switcher closes).
    await page.getByRole('button', { name: '✨ Магічна збірка' }).first().click()
    await page.getByTestId('magic-start').click()
    await expect(bar).toBeVisible({ timeout: 120_000 })
    await thumbs.nth(2).click()
    const slots = page.getByTestId('spread-sheet').locator('[data-testid="slot"][data-filled="true"]')
    const before = await slots.count()
    await slots.first().click()
    await page.keyboard.press('Delete')
    await expect(slots).toHaveCount(before - 1)
    await expect(bar).toHaveCount(0)
    await page.getByRole('button', { name: 'Скасувати', exact: true }).click()
    await expect(slots).toHaveCount(before)
    await page.reload()
    await expect(thumbs).toHaveCount(9)
  })

  test('«Скасувати» зупиняє аналіз і нічого не змінює', async ({ page }) => {
    test.setTimeout(120_000)
    await newMagicAlbum(page, 'demo-magic-800', 30)
    const progress = page.getByTestId('magic-progress')
    await expect(progress).toBeVisible()
    await expect(progress).toContainText(/з 79\d/) // 800 − hidden frames
    await page.getByTestId('magic-cancel').click()
    await expect(progress).toHaveCount(0)
    await expect(page.getByTestId('magic-start')).toBeEnabled()
    await page.getByTestId('magic-dialog').getByText('Закрити', { exact: true }).click()
    await expect(page.getByTestId('spread-thumb')).toHaveCount(0)
    expect(await stored(page)).toHaveLength(0)
  })

  test('швидкість: 800 кадрів → три варіанти альбому', async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    await newMagicAlbum(page, 'demo-magic-800', 30)
    const bar = page.getByTestId('magic-bar')
    await expect(bar).toBeVisible({ timeout: 180_000 })
    const ms = Number(await bar.getAttribute('data-ms'))
    const measured = Number(await bar.getAttribute('data-measured'))
    const faced = Number(await bar.getAttribute('data-faced'))
    testInfo.annotations.push({ type: 'magic-800', description: `${(ms / 1000).toFixed(1)} с; виміряно ${measured}, облич ${faced}` })
    console.log(`magic-800: ${(ms / 1000).toFixed(1)} s, measured ${measured}, faces ${faced}`)
    expect(measured).toBeGreaterThan(780)
    // ≤ ~30 s on an ordinary laptop; CI machines are slower — a generous ceiling here.
    expect(ms).toBeLessThan(90_000)
    await expect(page.getByTestId('spread-thumb')).toHaveCount(31)
  })
})

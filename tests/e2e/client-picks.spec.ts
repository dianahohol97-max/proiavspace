import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/**
 * «Обране клієнта» для Lightroom і «Лист клієнтові» через тестову сторінку
 * /[locale]/e2e/client-picks (ті самі компоненти, що в кабінеті; дані й
 * «пошта» — у памʼяті сервера). E2E_THEME_PREVIEW=1.
 */

async function noHorizontalOverflow(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

test.describe('обране клієнта → Lightroom', () => {
  test('рядок: без розширень, через кому, дублікат один раз; назва з пробілом — окремо', async ({ page }) => {
    await page.goto('/uk/e2e/client-picks')
    const line = page.getByTestId('picks-line')
    await expect(line).toHaveValue('IMG_0012,IMG_0015,IMG_0200,Весілля_007')
    await expect(page.getByText('Рядок для Lightroom · назв: 4')).toBeVisible()
    await expect(page.getByTestId('picks-skipped')).toContainText('DSC 0101.jpg')
    await expect(page.getByTestId('client-picks-export')).toContainText('Filename → Contains')
    await noHorizontalOverflow(page)
  })

  test('«Скопіювати назви файлів» кладе рядок у буфер', async ({ page, context, browserName }, info) => {
    test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'буфер перевіряємо на десктопі')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/uk/e2e/client-picks')
    await page.getByTestId('picks-copy').click()
    await expect(page.getByTestId('picks-copy')).toHaveText('Назви скопійовано')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('IMG_0012,IMG_0015,IMG_0200,Весілля_007')
  })

  test('«Завантажити список»: .txt і .csv з назвою, позначкою, коментарем', async ({ page }) => {
    await page.goto('/uk/e2e/client-picks')
    const [txt] = await Promise.all([page.waitForEvent('download'), page.getByTestId('picks-txt').click()])
    expect(txt.suggestedFilename()).toBe('e2e-marta-bohdan-picks.txt')
    const txtBody = readFileSync((await txt.path())!, 'utf8')
    expect(txtBody.split('\n')[0]).toBe('IMG_0012.jpg — сердечко + ретуш')
    expect(txtBody).toContain('IMG_0200.JPG — ретуш')
    expect(txtBody).toContain('Весілля_007.JPG — сердечко')

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('picks-csv').click()])
    expect(csv.suggestedFilename()).toBe('e2e-marta-bohdan-picks.csv')
    const csvBody = readFileSync((await csv.path())!, 'utf8')
    expect(csvBody.startsWith('﻿Файл,Позначка,Коментар\r\n')).toBe(true)
    expect(csvBody).toContain('IMG_0015.jpg,сердечко,')
  })

  test('порожній набір: копіювати нічого, рядка немає', async ({ page }) => {
    await page.goto('/uk/e2e/client-picks?empty=1')
    await expect(page.getByTestId('picks-copy')).toBeDisabled()
    await expect(page.getByTestId('picks-line')).toHaveCount(0)
  })
})

test.describe('лист клієнтові «Ваші фото готові»', () => {
  test('адреса лише зі згодою; «Готово» → один лист; «Надіслати ще раз» не двічі за хвилину', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'стан у памʼяті сервера — один проєкт')
    await page.goto('/uk/e2e/client-picks?reset=1&ready=0')
    // Without ?reset, so reloads below keep the in-memory state.
    await page.goto('/uk/e2e/client-picks')
    const block = page.getByTestId('client-email')
    await expect(block).toContainText('Лист клієнтові «Ваші фото готові»')

    await page.getByTestId('client-email-input').fill('olena@example')
    await block.getByRole('button', { name: 'Зберегти адресу' }).click()
    await expect(block).toContainText('Перевірте адресу')

    await page.getByTestId('client-email-input').fill('olena@example.com')
    await block.getByRole('button', { name: 'Зберегти адресу' }).click()
    await expect(block).toContainText('Позначте, що клієнт погодився')

    await page.getByTestId('client-email-consent').check()
    await block.getByRole('button', { name: 'Зберегти адресу' }).click()
    await expect(block).toContainText('Збережено')
    await expect(page.getByTestId('client-email-status')).toHaveText('Лист піде автоматично, щойно статус стане «Готово».')
    await expect(page.getByTestId('client-email-send-again')).toHaveCount(0)

    // Статус → «Готово» двічі поспіль: лист один.
    const markReady = async () => {
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/e2e/client-picks')),
        page.getByTestId('e2e-mark-ready').click(),
      ])
      await page.reload()
    }
    await markReady()
    await expect(page.getByTestId('e2e-state')).toHaveAttribute('data-sent', '1')
    await markReady()
    await expect(page.getByTestId('e2e-state')).toHaveAttribute('data-sent', '1')
    await expect(page.getByTestId('client-email-status')).toContainText('Лист «Ваші фото готові» надіслано')

    const again = page.getByTestId('client-email-send-again')
    await expect(again).toHaveText('Надіслати ще раз')
    await again.click()
    await expect(block).toContainText('Лист щойно пішов — спробуйте за хвилину.')
    await page.reload()
    await expect(page.getByTestId('e2e-state')).toHaveAttribute('data-sent', '1')
    await noHorizontalOverflow(page)
  })
})

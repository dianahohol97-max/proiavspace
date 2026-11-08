import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { E2E_USER, insertRow, resetDb, signIn } from './support/session'

/**
 * «Дизайн» → Превʼю = справжня галерея клієнта. Фотограф вибирає розкладку
 * («Мозаїка», «Рядки»), зберігає; превʼю «ноутбук» (desktop) / «телефон»
 * (iPhone) порівнюємо з галереєю, відкритою кнопкою «Відкрити як клієнт» на
 * тому ж пристрої: та сама кількість колонок, ті самі перші кадри в тому ж
 * порядку; схований кадр не потрапляє ні туди, ні туди.
 * Скриншоти пар «превʼю / справжня галерея» — test-results/designer-preview.
 */
const SHOTS = process.env.DESIGNER_SHOTS_DIR ?? join('test-results', 'designer-preview')
const GALLERY_ID = '44444444-4444-4444-8444-444444444444' // «Хрещення Софійки», опублікована, 8 фото
const TITLE = 'Хрещення Софійки'
const HIDDEN_ID = '44444444-hidden'

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === 'android', 'превʼю порівнюємо на ноутбуці (desktop) і телефоні (iPhone)')
})

/** Eight more frames of mixed proportions (the seed has only 3:2) and one hidden frame. */
async function seedMixedShoot() {
  const base = `u/${E2E_USER.id}/g/${GALLERY_ID}`
  const dims: [number, number][] = [
    [1067, 1600], [1600, 1067], [1200, 1600], [2000, 1000],
    [1067, 1600], [1600, 1600], [1600, 1067], [900, 1600],
  ]
  for (const [i, [width, height]] of dims.entries()) {
    const n = String(((i + 3) % 15) + 1).padStart(2, '0')
    await insertRow('assets', {
      id: `44444444-m${String(i).padStart(3, '0')}`,
      gallery_id: GALLERY_ID,
      owner_id: E2E_USER.id,
      r2_key: `${base}/o/mixed-${i}.jpg`,
      kind: 'photo',
      content_type: 'image/jpeg',
      width,
      height,
      size_bytes: 3_000_000,
      variants: { thumb: `${base}/v/${n}-m${i}-thumb.jpg`, preview: `${base}/v/${n}-m${i}-preview.jpg` },
      // interleaved with the seeded frames (positions 0–7): 1, 3, 5, …
      position: i * 2 + 1,
      hidden_from_client: false,
      focal_x: null,
      focal_y: null,
      created_at: '2026-10-01T10:00:00Z',
    })
  }
  // Hidden from the client, and first by position: must appear nowhere.
  await insertRow('assets', {
    id: HIDDEN_ID,
    gallery_id: GALLERY_ID,
    owner_id: E2E_USER.id,
    r2_key: `${base}/o/hidden.jpg`,
    kind: 'photo',
    content_type: 'image/jpeg',
    width: 1600,
    height: 1067,
    size_bytes: 3_000_000,
    variants: { thumb: `${base}/v/14-h-thumb.jpg`, preview: `${base}/v/14-h-preview.jpg` },
    position: -1,
    hidden_from_client: true,
    focal_x: null,
    focal_y: null,
    created_at: '2026-01-01T00:00:00Z',
  })
}

type Grid = { columns: number; firstRow: string[]; order: string[]; ids: string[] }

/** Tiles under `root` grouped into rows by their top edge; columns = distinct left edges. */
async function measure(root: Locator): Promise<Grid> {
  return root.evaluate((element) => {
    const tiles = [...element.querySelectorAll<HTMLElement>('figure[data-id]')]
      .map((figure) => ({ id: figure.dataset.id!, box: figure.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
    const tolerance = 1.5
    tiles.sort((a, b) => (Math.abs(a.box.top - b.box.top) < tolerance ? a.box.left - b.box.left : a.box.top - b.box.top))
    const top = tiles[0].box.top
    const lefts: number[] = []
    for (const { box } of tiles) if (!lefts.some((left) => Math.abs(left - box.left) < tolerance)) lefts.push(box.left)
    return {
      columns: lefts.length,
      firstRow: tiles.filter(({ box }) => Math.abs(box.top - top) < tolerance).map((t) => t.id),
      order: tiles.slice(0, 6).map((t) => t.id),
      ids: tiles.map((t) => t.id),
    }
  })
}

async function shot(target: Page | Locator, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  // The dashboard's sticky header and tabs would cover the frame in an element shot.
  await (('page' in target ? target.page() : target) as Page).evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.closest('[data-testid="designer-preview"]')) continue
      const position = getComputedStyle(element).position
      if ((position === 'sticky' || position === 'fixed') && location.pathname.includes('/dashboard'))
        element.style.position = 'relative'
    }
  })
  await target.screenshot({ path: join(SHOTS, `${name}.png`) })
}

async function imagesLoaded(root: Locator) {
  await expect
    .poll(() =>
      root.evaluate((element) =>
        // every tile (and the cover) on screen shows its photo; lazy tiles
        // further down never load, so they are not waited for
        [...element.querySelectorAll<HTMLElement>('figure, header')]
          .filter((box) => {
            const rect = box.getBoundingClientRect()
            return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight
          })
          .every((box) => {
            const img = box.querySelector('img')
            return !!img && img.complete && img.naturalWidth > 0
          })
      )
    )
    .toBe(true)
  // decoded, so the screenshot shows the photos, not empty tiles
  await root.evaluate((element) =>
    Promise.all(
      [...element.querySelectorAll('img')]
        .filter((img) => {
          const box = img.getBoundingClientRect()
          return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
        })
        .map((img) => img.decode().catch(() => undefined))
    )
  )
}

for (const [layout, label] of [
  ['masonry', 'Мозаїка'],
  ['rows', 'Рядки'],
] as const) {
  test(`«${label}»: превʼю показує те саме, що бачить клієнт`, async ({ context, page, baseURL }, info) => {
    const device = info.project.name === 'iphone' ? 'phone' : 'desktop'
    await resetDb('full')
    await seedMixedShoot()
    await signIn(context, baseURL!)

    // ---- фотограф: «Дизайн» → розкладка → зберегти
    await page.goto(`/uk/dashboard/galleries/${GALLERY_ID}?tab=design`)
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.getByRole('button', { name: device === 'phone' ? 'Телефон' : 'Комп’ютер', exact: true }).click()
    await page.getByRole('button', { name: 'Зберегти стиль' }).click()
    await expect(page.getByText('✓ Збережено', { exact: true })).toBeVisible()

    const preview = page.getByTestId('designer-preview')
    await expect(preview).toHaveAttribute('data-device', device)
    await expect(preview).toHaveAttribute('data-layout', layout)
    await expect(preview.getByTestId('preview-title')).toHaveText(TITLE)
    await expect(preview.getByTestId('preview-event')).toHaveText('22 серпня 2026 р.')
    await expect(preview.getByTestId('preview-cover')).toContainText('Ольга Вишня')
    await expect(preview.getByTestId('preview-download-all')).toHaveText(/Завантажити все · 16/)
    await expect(preview.locator(`figure[data-id="${HIDDEN_ID}"]`)).toHaveCount(0)

    // рамка: 16:10 / ~9:19.5, обкладинка — та сама частка висоти, що й у клієнта
    const frame = (await preview.boundingBox())!
    expect(Math.abs(frame.height / frame.width - (device === 'phone' ? 844 / 390 : 800 / 1280))).toBeLessThan(0.01)
    const coverBox = (await preview.getByTestId('preview-cover').boundingBox())!
    expect(Math.abs(coverBox.height / frame.height - (device === 'phone' ? 742.72 / 844 : 704 / 800))).toBeLessThan(0.01)

    await preview.evaluate((element) => element.scrollTo(0, 0))
    await imagesLoaded(preview.getByTestId('preview-cover'))
    await shot(preview, `${layout}-${device}-1-preview-cover`)
    await preview.evaluate((element) => {
      const grid = element.querySelector<HTMLElement>('[data-testid="preview-grid"]')!
      element.scrollTo(0, grid.offsetTop - 60 * Number(element.dataset.scale))
    })
    await imagesLoaded(preview.getByTestId('preview-grid'))
    await shot(preview, `${layout}-${device}-2-preview-grid`)
    const inPreview = await measure(preview.getByTestId('preview-grid'))
    // gridColumns(): 3 columns chosen → 3 on the laptop, 1 on the phone
    expect(Number(await preview.getAttribute('data-columns'))).toBe(device === 'phone' ? 1 : 3)

    // ---- «Відкрити як клієнт»: справжня галерея в новій вкладці
    const [client] = await Promise.all([context.waitForEvent('page'), page.getByTestId('open-as-client').click()])
    await client.waitForLoadState()
    await expect(client).toHaveURL(/\/uk\/g\/olha-vyshnia-444444\?preview=1$/)
    await expect(client.locator('h1')).toHaveText(TITLE)
    await expect(client.locator('header').first()).toContainText('Ольга Вишня')
    await expect(client.locator('header').first()).toContainText('22 серпня 2026 р.')
    await expect(client.locator(`figure[data-id="${HIDDEN_ID}"]`)).toHaveCount(0)
    const body = client.locator('body')
    await imagesLoaded(client.locator('header'))
    await shot(client, `${layout}-${device}-3-client-cover`)
    await client.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('[data-virtual]') ?? document.querySelector('figure')!.parentElement!
      window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - 60)
    })
    await expect(client.locator('figure[data-id] img:visible').first()).toBeVisible()
    await imagesLoaded(body)
    await shot(client, `${layout}-${device}-4-client-grid`)
    const onClient = await measure(body)

    // однакова кількість колонок, ті самі перші кадри в тому ж порядку
    if (layout === 'masonry') expect(inPreview.columns).toBe(onClient.columns)
    expect(inPreview.firstRow).toEqual(onClient.firstRow)
    expect(inPreview.order).toEqual(onClient.order)
    if (layout === 'masonry' && device === 'phone') expect(onClient.columns).toBe(1)
    expect(onClient.ids).not.toContain(HIDDEN_ID)
    expect(inPreview.ids).not.toContain(HIDDEN_ID)
    // the seeded frame at position 0 opens the gallery, then the mixed one at 1
    expect(inPreview.order.slice(0, 2)).toEqual(['44444444-a000', '44444444-m000'])
  })
}

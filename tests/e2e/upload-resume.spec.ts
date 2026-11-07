import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Plan 4.3: big files go multipart (8 MB parts), survive a network outage and
 * continue after a page reload from the parts storage already has. The real
 * Uploader on /uk/e2e/upload (dev-only page) talks to mocked /api/uploads/*
 * and a mocked "B2" (page.route) — no database, no bucket.
 *
 * Throughput / CPU numbers are measured separately with a shaped link
 * (docs/UPLOAD_PERF.md); here only the behaviour is pinned.
 */

const STORE = 'https://b2.e2e.test'
const MB = 1024 * 1024

interface Upload {
  key: string
  parts: Map<number, { size: number; etag: string }>
}

class FakeBackend {
  uploads = new Map<string, Upload>()
  partPuts: number[] = []
  singlePuts = 0
  completes: { multipart: boolean; parts: unknown; sizeBytes: number }[] = []
  exposeEtag = true
  /** Delay before "B2" answers part N: N × partDelay ms (parts finish one by one). */
  partDelay = 0
  /** While true every storage request dies like a dropped connection (also ones in flight). */
  offline = false

  async attach(page: Page) {
    await page.route('**/api/uploads/**', (route) => this.api(route))
    await page.route(`${STORE}/**`, (route) => this.store(route))
  }

  private cors(extra: Record<string, string> = {}) {
    return {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT, GET',
      'access-control-allow-headers': 'content-type',
      ...(this.exposeEtag ? { 'access-control-expose-headers': 'ETag' } : {}),
      ...extra,
    }
  }

  private async api(route: Route) {
    const url = new URL(route.request().url())
    const body = route.request().postDataJSON() as Record<string, unknown>
    const name = url.pathname.replace('/api/uploads/', '')
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    const newKey = () => `u/U/g/${body.galleryId}/${body.variant ? 'v' : 'o'}/${crypto.randomUUID()}-${body.fileName}`
    switch (name) {
      case 'presign': {
        const key = newKey()
        return json(200, { key, uploadUrl: `${STORE}/${key}?sig=1` })
      }
      case 'complete':
        this.completes.push({ multipart: false, parts: null, sizeBytes: body.sizeBytes as number })
        return json(200, { assetId: crypto.randomUUID() })
      case 'multipart/create': {
        const id = crypto.randomUUID()
        this.uploads.set(id, { key: newKey(), parts: new Map() })
        return json(200, { key: this.uploads.get(id)!.key, uploadId: id })
      }
      case 'multipart/part-urls': {
        const urls: Record<number, string> = {}
        for (const n of body.partNumbers as number[]) {
          urls[n] = `${STORE}/${body.key}?partNumber=${n}&uploadId=${body.uploadId}`
        }
        return json(200, { urls })
      }
      case 'multipart/list-parts': {
        const upload = this.uploads.get(body.uploadId as string)
        if (!upload) return json(404, { error: 'upload_not_found' })
        return json(200, {
          parts: [...upload.parts].map(([partNumber, p]) => ({ partNumber, etag: p.etag, sizeBytes: p.size })),
        })
      }
      case 'multipart/complete': {
        const upload = this.uploads.get(body.uploadId as string)
        if (!upload) return json(400, { error: 'upload_missing' })
        const total = [...upload.parts.values()].reduce((s, p) => s + p.size, 0)
        if (total !== body.sizeBytes) return json(422, { error: 'parts_size_mismatch' })
        this.completes.push({ multipart: true, parts: body.parts, sizeBytes: total })
        return json(200, { assetId: crypto.randomUUID() })
      }
      case 'multipart/abort':
        this.uploads.delete(body.uploadId as string)
        return json(200, { ok: true })
    }
    return json(404, {})
  }

  private async store(route: Route) {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors() })
    const url = new URL(request.url())
    const partNumber = Number(url.searchParams.get('partNumber'))
    const etag = crypto.randomUUID().replaceAll('-', '')
    if (this.offline) return route.abort('internetdisconnected')
    if (partNumber) {
      if (this.partDelay) await new Promise((resolve) => setTimeout(resolve, this.partDelay * partNumber))
      if (this.offline) return route.abort('internetdisconnected')
      const upload = this.uploads.get(url.searchParams.get('uploadId')!)
      const size = request.postDataBuffer()?.length ?? 0
      upload?.parts.set(partNumber, { size, etag })
      this.partPuts.push(partNumber)
    } else {
      this.singlePuts++
    }
    return route.fulfill({ status: 200, headers: this.cors({ etag: `"${etag}"` }), body: '' }).catch(() => {})
  }
}

/** A 21 MB "photo": 3 parts of 8 + 8 + 5 MB. Not decodable, so no renditions — fine here. */
function bigFile(name = 'shot-01.png') {
  const buffer = Buffer.alloc(21 * MB)
  for (let i = 0; i < buffer.length; i += 4096) buffer[i] = (i / 4096) & 0xff
  return { name, mimeType: 'image/png', buffer }
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'behaviour is the same on every device; desktop only')
})

test('файл > 16 МБ іде частинами по 8 МБ і реєструється з ETag частин', async ({ page }) => {
  const backend = new FakeBackend()
  await backend.attach(page)
  await page.goto('/uk/e2e/upload')
  await page.locator('input[type=file]').setInputFiles([bigFile()])
  await expect(page.getByText('✓')).toBeVisible({ timeout: 30_000 })
  expect(backend.partPuts.sort()).toEqual([1, 2, 3])
  expect(backend.singlePuts).toBe(0)
  expect(backend.completes).toHaveLength(1)
  expect(backend.completes[0].multipart).toBe(true)
  expect((backend.completes[0].parts as unknown[]).length).toBe(3)
})

test('бакет не віддає ETag — файл усе одно завершується (сервер бере ListParts) і є чітке попередження', async ({ page }) => {
  const backend = new FakeBackend()
  backend.exposeEtag = false
  await backend.attach(page)
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text())
  })
  await page.goto('/uk/e2e/upload')
  await page.locator('input[type=file]').setInputFiles([bigFile()])
  await expect(page.getByText('✓')).toBeVisible({ timeout: 30_000 })
  expect(backend.completes[0].parts).toBeNull()
  expect(warnings.some((w) => w.includes('does not expose the ETag header') && w.includes('MANUAL_TASKS'))).toBe(true)
})

test('обрив мережі посеред файлу — чекає, показує статус і продовжує з місця', async ({ page, context }) => {
  const backend = new FakeBackend()
  backend.partDelay = 1500
  await backend.attach(page)
  await page.goto('/uk/e2e/upload')
  await page.locator('input[type=file]').setInputFiles([bigFile()])
  await expect.poll(() => backend.partPuts.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1)

  // Mocked routes are not cut by setOffline: the fake storage drops every
  // request (in flight too) while the browser itself reports offline.
  backend.offline = true
  await context.setOffline(true)
  await expect(page.getByRole('status')).toContainText('Немає з’єднання', { timeout: 15_000 })
  await page.waitForTimeout(5_000)
  backend.offline = false
  await context.setOffline(false)

  await expect(page.getByText('✓')).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(backend.completes).toHaveLength(1)
  // Every part stored exactly once — nothing restarted from zero.
  expect(new Set(backend.partPuts).size).toBe(3)
})

test('перезавантаження вкладки — після вибору того самого файлу вантажаться лише відсутні частини', async ({ page }) => {
  const backend = new FakeBackend()
  backend.partDelay = 2500
  await backend.attach(page)
  await page.goto('/uk/e2e/upload')
  const file = bigFile()
  await page.locator('input[type=file]').setInputFiles([file])
  await expect.poll(() => backend.partPuts.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1)

  await page.reload()
  const stored = [...backend.partPuts]
  expect(stored.length).toBeGreaterThanOrEqual(1)
  expect(stored.length).toBeLessThan(3)
  await expect(page.getByTestId('upload-resume-hint')).toContainText('Незавершених завантажень: 1')
  await expect(page.getByTestId('upload-resume-hint')).toContainText('shot-01.png')

  backend.partDelay = 0
  await page.locator('input[type=file]').setInputFiles([file])
  await expect(page.getByText('✓')).toBeVisible({ timeout: 30_000 })
  const secondPass = backend.partPuts.slice(stored.length)
  expect(secondPass.every((n) => !stored.includes(n))).toBe(true)
  expect(new Set(backend.partPuts)).toEqual(new Set([1, 2, 3]))
  expect(backend.completes).toHaveLength(1)
  expect(backend.uploads.size).toBe(1) // one upload, resumed — not a second one
  await expect(page.getByTestId('upload-resume-hint')).toHaveCount(0)
})

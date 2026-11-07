import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js'
import { EXISTING_XMP, testSet, writeTestFolder } from '../folder-cull/make-set'

/**
 * «Відбір із папки» on the database-free demo: synthetic RAW containers of
 * every format (tests/folder-cull/make-raw.ts) built around real photos.
 * Eyes are off in the main flow (the model is 17 MB); a separate test checks
 * it loads from our own server.
 */
test.describe('відбір із папки (демо)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'файлова система, воркери й клавіатура — досить десктопа')
  })

  async function openFolder(page: Page, dir: string, eyes = false) {
    await page.goto('/uk/cull-demo')
    await page.getByTestId('folder-input').setInputFiles(dir)
    await expect(page.getByTestId('cull-found')).toContainText('Кадрів: 12 (RAW: 12, JPEG/HEIC: 0), інших файлів пропущено: 1')
    if (!eyes) await page.getByRole('checkbox', { name: /заплющені очі/ }).uncheck()
    await page.getByTestId('cull-start').click()
    await expect(page.getByTestId('cull-summary')).toContainText('Брак: 2 · Кращі в серіях: 2 · Серій: 2', { timeout: 60_000 })
    await expect(page.getByRole('button', { name: 'Скасувати' })).toHaveCount(0, { timeout: 60_000 })
  }

  test('аналіз RAW, фільтри, клавіші, серія, 100 %, ZIP із .xmp, продовження', async ({ page }) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cull-'))
    writeTestFolder(path.join(dir, 'shoot'))
    // Nothing of the photos may leave the browser: no request body of any size
    // goes anywhere (site analytics pings are tiny and carry no file data).
    const external: string[] = []
    const ANALYTICS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net/
    page.on('request', (r) => {
      const url = r.url()
      if (url.startsWith('http://localhost') || url.startsWith('blob:') || url.startsWith('data:')) return
      if (ANALYTICS.test(new URL(url).hostname) && (r.postDataBuffer()?.length ?? 0) < 4096) return
      external.push(`${r.method()} ${url} ${r.postDataBuffer()?.length ?? 0}`)
    })
    await openFolder(page, path.join(dir, 'shoot'))

    // Suggested rejects: the missed-focus twin and the heavily blurred frame.
    await page.getByRole('button', { name: /^Брак · 2/ }).click()
    await expect(page.getByTestId('cull-tile')).toHaveCount(2)
    await expect(page.locator('[data-testid=cull-tile][data-id="DSC_0005.NEF"] [data-flag=blurry]')).toBeVisible()
    await expect(page.locator('[data-testid=cull-tile][data-id="IMG_0011.CR3"] [data-flag=blurry]')).toBeVisible()

    // Photo Mechanic keys on «All»: → X (reject), → 4 (stars), P on a suggested reject.
    await page.getByRole('button', { name: /^Усі · 12/ }).click()
    await expect(page.locator('[data-testid=cull-tile][data-focused]')).toHaveAttribute('data-id', 'IMG_0001.CR2')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('x')
    await expect(page.getByRole('button', { name: /^Брак · 3/ })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('4')
    await expect(page.locator('[data-testid=cull-tile][data-id="IMG_0003.CR2"] [data-mark=stars]')).toHaveText('★★★★')
    await page.locator('[data-testid=cull-tile][data-id="DSC_0005.NEF"]').click()
    await page.keyboard.press('p')
    await expect(page.getByRole('button', { name: /^Брак · 2/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Залишені \(P\) · 1/ })).toBeVisible()

    // Burst side by side.
    await page.locator('[data-testid=cull-tile][data-id="IMG_0001.CR2"]').getByRole('button', { name: 'Серія · 3' }).click()
    await expect(page.getByTestId('cull-series').locator('figure')).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('cull-series')).toHaveCount(0)

    // Full screen + 100 %: the canvas shows the embedded preview at its own pixel size.
    await page.locator('[data-testid=cull-tile][data-id="IMG_0001.CR2"]').click()
    await page.keyboard.press('Enter')
    const viewer = page.getByTestId('cull-viewer')
    await expect(viewer).toContainText(/1200×80\d/)
    await page.keyboard.press('z')
    await expect(page.getByTestId('cull-zoom')).toHaveText('Вписати')
    const box = await viewer.locator('canvas').boundingBox()
    expect(Math.round(box!.width)).toBe(1200) // DPR 1 in this project
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)

    // ZIP of sidecars (read-only folder access in this path).
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('cull-zip').click()])
    const zipPath = path.join(dir, 'out.zip')
    await download.saveAs(zipPath)
    const reader = new ZipReader(new BlobReader(new Blob([readFileSync(zipPath)])))
    const entries = await reader.getEntries()
    const text = async (name: string) => {
      const e = entries.find((x) => x.filename === name)
      expect(e, name).toBeTruthy()
      return (e as unknown as { getData(w: TextWriter): Promise<string> }).getData(new TextWriter())
    }
    const names = entries.map((e) => e.filename).sort()
    expect(names).toContain('README.txt')
    expect(names).toContain('culling.csv')
    const blurred = await text('shoot/IMG_0011.xmp')
    expect(blurred).toContain('xmp:Rating="-1"')
    expect(blurred).toContain('xmp:Label="Red"')
    expect(blurred).toContain('xmpDM:pick="-1"')
    const best = await text('shoot/IMG_0001.xmp')
    expect(best).toContain('xmp:Rating="3"')
    // P on DSC_0005 — its existing Lightroom sidecar: pick=1, develop settings intact.
    const picked = await text('shoot/DSC_0005.xmp')
    expect(picked).toContain('xmpDM:pick="1"')
    expect(picked).toContain('crs:Exposure2012="+0.35"')
    expect(picked).toContain('<rdf:li>0, 0</rdf:li>')
    const rejectedByHand = await text('shoot/IMG_0002.xmp')
    expect(rejectedByHand).toContain('xmp:Rating="-1"')
    expect(await text('shoot/IMG_0003.xmp')).toContain('xmp:Rating="4"')
    await reader.close()

    // Reload: the session is offered to continue, and nothing left the browser.
    await page.waitForTimeout(1300)
    await page.reload()
    await expect(page.getByText('shoot: 12 з 12 проаналізовано')).toBeVisible()
    await page.getByTestId('folder-input').setInputFiles(path.join(dir, 'shoot'))
    await expect(page.getByTestId('cull-summary')).toContainText('Залишено: 1')
    // Previews/sharpness are not redone; only the (skipped) eyes check is offered.
    await expect(page.getByTestId('cull-start')).toHaveText('Продовжити аналіз (12)')
    await page.getByRole('checkbox', { name: /заплющені очі/ }).uncheck()
    await expect(page.getByTestId('cull-start')).toHaveCount(0)
    expect(external).toEqual([])
  })

  test('запис .xmp прямо в папку (File System Access — через OPFS)', async ({ page }) => {
    await page.goto('/uk/cull-demo?opfs=shoot')
    // Put the shoot into the browser's private file system.
    const files = [...testSet(1)].map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')] as const)
    await page.evaluate(
      async ({ files, xmp }) => {
        const root = await navigator.storage.getDirectory()
        await root.removeEntry('shoot', { recursive: true }).catch(() => undefined)
        const dir = await root.getDirectoryHandle('shoot', { create: true })
        const put = async (name: string, data: Uint8Array<ArrayBuffer> | string) => {
          const w = await (await dir.getFileHandle(name, { create: true })).createWritable()
          await w.write(data)
          await w.close()
        }
        for (const [name, b64] of files) await put(name, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
        await put('DSC_0005.xmp', xmp)
      },
      { files, xmp: EXISTING_XMP }
    )
    await page.getByRole('button', { name: 'Вибрати папку', exact: true }).click()
    await expect(page.getByTestId('cull-found')).toContainText('Кадрів: 12')
    await page.getByRole('checkbox', { name: /заплющені очі/ }).uncheck()
    await page.getByTestId('cull-start').click()
    await expect(page.getByTestId('cull-summary')).toContainText('Брак: 2', { timeout: 60_000 })
    await page.getByTestId('cull-write').click()
    await expect(page.getByTestId('cull-export-status')).toContainText('створено 3, оновлено 1')
    const written = await page.evaluate(async () => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('shoot')
      const out: Record<string, string> = {}
      for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemFileHandle]> }).entries()) {
        if (name.endsWith('.xmp')) out[name] = await (await h.getFile()).text()
      }
      return out
    })
    // Best of the two bursts (3★), the blurred frame (new) + the existing Lightroom sidecar (updated).
    expect(Object.keys(written).sort()).toEqual(['DSC_0004.xmp', 'DSC_0005.xmp', 'IMG_0001.xmp', 'IMG_0011.xmp'])
    expect(written['DSC_0004.xmp']).toContain('xmp:Rating="3"')
    expect(written['DSC_0005.xmp']).toContain('xmp:Rating="-1"')
    expect(written['DSC_0005.xmp']).toContain('crs:Exposure2012="+0.35"')
    expect(written['IMG_0011.xmp']).toContain('xmpDM:pick="-1"')
  })

  test('очі: модель і wasm лише з нашого сервера, після натискання', async ({ page }) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cull-'))
    writeTestFolder(path.join(dir, 'shoot'))
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.goto('/uk/cull-demo')
    await page.getByTestId('folder-input').setInputFiles(path.join(dir, 'shoot'))
    await expect(page.getByTestId('cull-found')).toBeVisible()
    expect(requests.filter((u) => /\.wasm|\.task|vision_wasm/.test(u))).toEqual([])
    await page.getByTestId('cull-start').click()
    await expect(page.getByTestId('cull-summary')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('button', { name: 'Скасувати' })).toHaveCount(0, { timeout: 90_000 })
    await expect(page.getByText('Модель облич не завантажилась')).toHaveCount(0)
    const heavy = requests.filter((u) => /\.wasm|\.task|vision_wasm/.test(u))
    expect(heavy.length).toBeGreaterThanOrEqual(3)
    for (const u of heavy) expect(new URL(u).pathname).toMatch(/^\/vendor\/mediapipe\//)
    expect(readdirSync(path.join(dir, 'shoot')).filter((n) => n.endsWith('.xmp'))).toEqual(['DSC_0005.xmp']) // nothing written without a click
  })
})

import { expect, test } from '@playwright/test'
import { buildSync } from 'esbuild'
import { join } from 'node:path'

/**
 * src/lib/gallery/archive.ts in a real browser: the gallery is cut into parts,
 * each part zipped into a Blob, and the one-file variant streamed into a
 * WritableStream. Files come from blob: URLs, so no storage is needed.
 */
const bundle = buildSync({
  entryPoints: [join(__dirname, 'archive-entry.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  alias: { '@': join(__dirname, '..', '..', 'src') },
  logLevel: 'silent',
}).outputFiles[0].text

test.describe('архів «Завантажити все» у браузері', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'чистий JS — досить одного браузера')
    await page.goto('/uk/login')
    await page.addScriptTag({ content: bundle })
  })

  test('збирає zip частинами: кожна частина — свій архів з правильними файлами', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { splitIntoParts, buildZipBlob, unzip } = window.__archive
      const sizes = [300_000, 200_000, 500_000, 50_000]
      const sources = sizes.map((size, i) => {
        const bytes = new Uint8Array(size)
        for (let j = 0; j < size; j++) bytes[j] = (j * 31 + i * 7) & 0xff
        return bytes
      })
      const files = sources.map((bytes, i) => ({
        name: `photo-${i + 1}.jpg`,
        url: URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })),
        size: bytes.length,
      }))
      const parts = splitIntoParts(files, 600_000)
      const report = []
      for (const part of parts) {
        let done = 0
        const blob = await buildZipBlob(part, () => done++)
        const entries = await unzip(blob)
        const ok = part.every((f) => {
          const original = sources[files.findIndex((x) => x.name === f.name)]
          const got = entries[f.name]
          return got && got.length === original.length && got.every((b, k) => b === original[k])
        })
        report.push({ names: Object.keys(entries).sort(), done, ok, type: blob.type })
      }
      files.forEach((f) => URL.revokeObjectURL(f.url))
      return report
    })
    expect(result.map((p) => p.names)).toEqual([
      ['photo-1.jpg', 'photo-2.jpg'],
      ['photo-3.jpg', 'photo-4.jpg'],
    ])
    for (const part of result) {
      expect(part.ok).toBe(true)
      expect(part.done).toBe(part.names.length)
      expect(part.type).toBe('application/zip')
    }
  })

  test('пише zip потоком: байти йдуть у WritableStream ще до останнього файла', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeZipToStream, unzip } = window.__archive
      const sources = [400_000, 400_000, 400_000].map((size, i) => new Uint8Array(size).fill(i + 1))
      const files = sources.map((bytes, i) => ({
        name: `video-${i + 1}.mp4`,
        url: URL.createObjectURL(new Blob([bytes])),
        size: bytes.length,
      }))
      const log: string[] = []
      const chunks: Uint8Array[] = []
      const writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk.slice())
          log.push('chunk')
        },
      })
      let done = 0
      await writeZipToStream(files, writable, () => done++, (url) => {
        log.push(`fetch ${files.findIndex((f) => f.url === url) + 1}`)
        return fetch(url)
      })
      const entries = await unzip(new Blob(chunks as BlobPart[]))
      files.forEach((f) => URL.revokeObjectURL(f.url))
      const lastFetch = log.indexOf('fetch 3')
      return {
        done,
        chunks: chunks.length,
        chunksBeforeLastFetch: log.slice(0, lastFetch).filter((e) => e === 'chunk').length,
        sizes: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v.length])),
        contentOk: sources.every((s, i) => entries[`video-${i + 1}.mp4`]?.every((b) => b === s[0])),
      }
    })
    expect(result.done).toBe(3)
    expect(result.chunks).toBeGreaterThan(1)
    expect(result.chunksBeforeLastFetch, 'архів має писатися до того, як завантажено всі файли').toBeGreaterThan(0)
    expect(result.sizes).toEqual({ 'video-1.mp4': 400_000, 'video-2.mp4': 400_000, 'video-3.mp4': 400_000 })
    expect(result.contentOk).toBe(true)
  })
})

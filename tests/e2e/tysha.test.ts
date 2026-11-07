/**
 * «Тиша» demo page in a real browser (Playwright):
 *   - the page answers 200;
 *   - no horizontal overflow on iPhone 13 and at 1440px;
 *   - every enquiry-form control has a <label>;
 *   - with prefers-reduced-motion the page is still (no running animations,
 *     nothing held transparent or shifted);
 *   - the page stays short: < 11 000 px on iPhone 13, ≤ 9 portfolio frames;
 *   - the hero image is in the server HTML (JS off) with fetchpriority=high.
 *
 * Needs a running app with the /themes routes reachable (locally the
 * redirect to /gallery-demo in next.config.js is in the way — see
 * tests/e2e/README.md) and Playwright with Chromium installed:
 *
 *   TYSHA_E2E_URL=http://localhost:3000/uk/themes/tysha npm run test:e2e:tysha
 */
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createRequire } from 'node:module'

/* Loose local types: playwright is optional and not a project dependency. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Browser = any
type Page = any
type BrowserContextOptions = Record<string, any>

const url = process.env.TYSHA_E2E_URL ?? ''
const requireFrom = createRequire(__filename)
let pw: any = null
try {
  pw = requireFrom('playwright')
} catch {
  pw = null
}
const skip = !url ? 'set TYSHA_E2E_URL' : !pw ? 'playwright is not installed' : false

let browser: Browser

async function open(options: BrowserContextOptions): Promise<{ page: Page; status: number; close: () => Promise<void> }> {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const response = await page.goto(url, { waitUntil: 'networkidle' })
  return { page, status: response?.status() ?? 0, close: () => context.close() }
}

/** Walks the whole page so lazy images, reveals and the sticky nav all run. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top: number) => window.scrollTo(0, top), y)
    await page.waitForTimeout(40)
  }
}

describe('«Тиша» demo', { skip }, () => {
  before(async () => {
    browser = await pw!.chromium.launch()
  })
  after(async () => {
    await browser?.close()
  })

  const viewports: [string, BrowserContextOptions][] = [
    ['iPhone 13', pw ? pw.devices['iPhone 13'] : {}],
    ['1440', { viewport: { width: 1440, height: 900 } }],
  ]

  for (const [name, options] of viewports) {
    test(`200 and no horizontal overflow — ${name}`, async () => {
      const { page, status, close } = await open(options)
      assert.equal(status, 200)
      await scrollThrough(page)
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ])
      assert.ok(scrollWidth <= innerWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`)
      await close()
    })
  }

  test('iPhone 13: page shorter than 11 000 px, at most 9 portfolio frames', async () => {
    const { page, close } = await open(pw.devices['iPhone 13'])
    await scrollThrough(page)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    assert.ok(height < 11000, `page height ${height}px`)
    const frames = await page.evaluate(() => document.querySelectorAll('#portfolio figure').length)
    assert.ok(frames > 0 && frames <= 9, `${frames} portfolio frames`)
    await close()
  })

  test('hero image: server HTML without JS, fetchpriority=high', async () => {
    const { page, close } = await open({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false })
    const hero = await page.evaluate(() => {
      const img = document.querySelector('header img') as HTMLImageElement | null
      if (!img) return null
      return {
        priority: img.getAttribute('fetchpriority'),
        loaded: img.complete && img.naturalWidth > 0,
        title: document.querySelector('header h1')?.getAttribute('aria-label') ?? '',
        titleText: (document.querySelector('header h1') as HTMLElement | null)?.innerText.trim() ?? '',
      }
    })
    assert.ok(hero, 'no <img> in the hero')
    assert.equal(hero.priority, 'high')
    assert.ok(hero.loaded, 'hero image did not load without JS')
    assert.ok(hero.title.length > 0 && hero.titleText.length > 0, 'hero name missing without JS')
    await close()
  })

  test('every form field has a label', async () => {
    const { page, close } = await open({ viewport: { width: 1440, height: 900 } })
    const unlabeled = await page.evaluate(() => {
      const form = document.querySelector('#contact form')
      if (!form) return ['<no form>']
      return Array.from(form.querySelectorAll('input, select, textarea'))
        .filter((el) => (el as HTMLInputElement).type !== 'hidden')
        .filter((el) => ((el as HTMLInputElement).labels?.length ?? 0) === 0)
        .map((el) => el.getAttribute('name') ?? el.outerHTML.slice(0, 60))
    })
    assert.deepEqual(unlabeled, [])
    const types = await page.evaluate(() =>
      Object.fromEntries(
        Array.from(document.querySelectorAll('#contact form input')).map((el) => [
          el.getAttribute('name'),
          el.getAttribute('type') ?? 'text',
        ])
      )
    )
    assert.equal(types.email, 'email')
    assert.equal(types.phone, 'tel')
    assert.equal(types.date, 'date')
    await close()
  })

  test('prefers-reduced-motion: no animations, nothing hidden or shifted', async () => {
    const { page, close } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await scrollThrough(page)
    await page.waitForTimeout(1500)
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null
          return `${a.constructor.name} on ${target?.className ?? target?.tagName ?? '?'}`
        })
    )
    assert.deepEqual(running, [])
    const heldBack = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3, p, figure, blockquote, blockquote span, li, [data-motion], [data-motion] *'))
        .filter((el) => {
          const cs = getComputedStyle(el)
          return Number(cs.opacity) < 0.99 || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)')
        })
        .filter((el) => !el.closest('nav'))
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 80))
    )
    assert.deepEqual(heldBack, [])
    // A still hero: one frame, no slideshow counter.
    const slides = await page.evaluate(() => document.querySelectorAll('header img').length)
    assert.equal(slides, 1)
    await close()
  })
})

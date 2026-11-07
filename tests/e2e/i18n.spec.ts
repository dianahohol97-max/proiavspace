import { expect, test, type Page } from '@playwright/test'
import { en } from '../../src/lib/i18n/dictionaries/en'
import { getDictionary, type Dictionary } from '../../src/lib/i18n'
import { getLandingCopy, type LandingCopy } from '../../src/lib/landing/copy'
import { getLegalCopy } from '../../src/lib/legal/copy'
import { cullingLabels } from '../../src/lib/culling/i18n'
import type { Locale } from '../../src/lib/i18n/config'

/**
 * Обов'язкова перевірка мов: на головних сторінках кожною з 7 мов немає
 * англійських рядків-фолбеків (рядок з en, якого бракує в перекладі, або
 * вбудований `locale === 'uk' ? … : 'English'`).
 *
 * Як працює: збирає всі англійські рядки (словник, лендинг, оферта, AI-відбір),
 * лишає ті, що в цій мові перекладені інакше, і шукає їх у видимому тексті
 * сторінки. Плюс евристика: англійські службові слова (the, your, and…) у
 * тексті сторінки, якої англійською бути не повинно.
 */

const LOCALES = ['pl', 'de', 'es', 'fr', 'it', 'ro', 'pt'] as const satisfies readonly Locale[]

const PAGES = [
  '',
  '/login',
  '/gallery-demo',
  '/gallery-demo/culling',
  '/oferta',
  '/privacy',
  '/e2e/delivery?status=editing&eta=2026-12-14',
  '/e2e/delivery?status=shot&photos=1',
]

/** English function words that never occur in the other 7 languages' UI. */
const ENGLISH_MARKERS = /\b(the|your|with|and|you|this|from|will|have|for)\b/gi

/** Visible text that may legitimately contain those words (brand names, demo data). */
const ALLOWED_TEXT = [/Google Pay|Apple Pay|Google Calendar/g, /Made with/gi]

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out))
  return out
}

/** Keeps only literal text runs (no placeholders/plural syntax) long enough to be telling. */
function fragments(text: string): string[] {
  return text
    .split(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 14 && (s.match(/[A-Za-z]{2,}/g) ?? []).length >= 3)
}

async function englishLeftovers(locale: Locale): Promise<string[]> {
  const dict: Dictionary = await getDictionary(locale)
  const translated = new Set([
    ...strings(dict),
    ...strings(getLandingCopy(locale) as LandingCopy),
    ...strings(getLegalCopy(locale)),
    ...strings(cullingLabels(locale)),
  ])
  const english = [
    ...strings(en),
    ...strings(getLandingCopy('en')),
    ...strings(getLegalCopy('en')),
    ...strings(cullingLabels('en')),
  ].filter((s) => !translated.has(s))
  return [...new Set(english.flatMap(fragments))]
}

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.body.innerText]
    // Accessible names and tooltips count too.
    document.querySelectorAll('[aria-label],[title],[alt],[placeholder]').forEach((el) => {
      for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
        const v = el.getAttribute(attr)
        if (v) parts.push(v)
      }
    })
    parts.push(document.title)
    return parts.join('\n')
  })
}

for (const locale of LOCALES) {
  test.describe(`мова ${locale}`, () => {
    test.skip(({ isMobile }) => isMobile, 'текст той самий — достатньо десктопу')

    for (const path of PAGES) {
      test(`/${locale}${path}: без англійських рядків`, async ({ page }) => {
        const leftovers = await englishLeftovers(locale)
        const response = await page.goto(`/${locale}${path}`, { waitUntil: 'load' })
        expect(response?.status()).toBe(200)
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        let text = await visibleText(page)
        for (const re of ALLOWED_TEXT) text = text.replace(re, '')

        const found = leftovers.filter((s) => text.includes(s))
        expect(found, `англійські рядки на /${locale}${path}`).toEqual([])

        const markers = text.match(ENGLISH_MARKERS) ?? []
        const lines = text
          .split('\n')
          .filter((line) => (line.match(ENGLISH_MARKERS) ?? []).length >= 2)
          .slice(0, 10)
        expect(markers.length, `схоже на англійський текст:\n${lines.join('\n')}`).toBeLessThanOrEqual(2)
      })
    }
  })
}

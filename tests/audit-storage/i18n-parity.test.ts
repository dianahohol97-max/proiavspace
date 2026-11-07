/**
 * Паритет перекладів: кожна з 9 мов має всі рядки, що й англійська.
 *
 * Обов'язковий тест (входить у test:audit). Додаєте рядок у uk.ts / en.ts,
 * лендинг, юридичні тексти, AI-відбір чи політики клієнтів — додайте його
 * в усі мови: pl, de, es, fr, it, ro, pt. Інакше цей тест упаде.
 *
 * Перевіряє:
 *  - ті самі розділи й ключі, що в en (крім явного списку MISSING_ALLOWED);
 *  - ті самі плейсхолдери ({n}, {date}…) і коректні plural-блоки з `other`;
 *  - рядок не скопійований з англійської (крім SAME_AS_EN_ALLOWED);
 *  - лендинг, оферта/політика, AI-відбір, політики клієнтів — та сама структура;
 *  - у кожного перекладу юридичних текстів є помітка про чинну українську версію.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { PartialDictionary } from '@/lib/i18n'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { de } from '@/lib/i18n/dictionaries/de'
import { es } from '@/lib/i18n/dictionaries/es'
import { fr } from '@/lib/i18n/dictionaries/fr'
import { it as itDict } from '@/lib/i18n/dictionaries/it'
import { ro } from '@/lib/i18n/dictionaries/ro'
import { pt } from '@/lib/i18n/dictionaries/pt'
import { formatMessage, placeholders } from '@/lib/i18n/format'
import { getLandingCopy } from '@/lib/landing/copy'
import { getLegalCopy } from '@/lib/legal/copy'
import { renderClientPolicy } from '@/lib/legal/clientPolicies'
import { cullingLabels } from '@/lib/culling/i18n'
import { galleryHelp } from '@/lib/gallery/help'
import { locales, type Locale } from '@/lib/i18n/config'

type Translated = Exclude<Locale, 'uk' | 'en'>

const DICTS: Record<Translated, PartialDictionary> = { pl, de, es, fr, it: itDict, ro, pt }
const TRANSLATED = Object.keys(DICTS) as Translated[]

/**
 * Keys a language may leave out (then English is shown). Format:
 * 'section.key' for every language, or 'pl:section.key' for one.
 * Keep it empty unless there is a real reason — write it next to the entry.
 */
const MISSING_ALLOWED = new Set<string>([])

/**
 * Values that are legitimately the same as English: brand / product names,
 * international words, examples, codes. 'section.key' for every language or
 * 'de:section.key' for one.
 */
const SAME_AS_EN_ALLOWED = new Set<string>([
  'common.appName',
  'booking.googleTitle', // «Google Calendar» — product name
  'fr:pages.sitePhotosCount', // «# photo / # photos» — same in French
  'it:pages.homeAria', // «proiav — home»: «home» is the usual Italian word here
  'importer.gb',
  'importer.mb',
  'publicBooking.emailLabel',
  'site.contactEmail',
  'site.contactInstagram',
  'site.contactTelegram',
  'settings.title',
  'publicSite.portfolio',
  'publicGallery.viewerSlideOf',
  'designer.layoutPortrait',
  'designer.fontPalatino',
  'designer.fontMono',
  'designer.columnsShort',
  'pages.demoBrand',
  'pages.demoCouple',
  'designer.sampleTitle',
  'studio.saved',
])

const allowed = (set: Set<string>, locale: string, path: string) => set.has(path) || set.has(`${locale}:${path}`)

/** A value «looks English» when it has two+ Latin words — short codes and names pass. */
const looksLikeSentence = (value: string) => (value.match(/[A-Za-z]{2,}/g) ?? []).length >= 2

function pluralBlocksHaveOther(template: string): boolean {
  const re = /\{\s*\w+\s*,\s*plural\s*,/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    // Walk to the matching brace of this block and look for `other {` inside.
    let depth = 0
    let end = m.index
    for (let i = m.index; i < template.length; i++) {
      if (template[i] === '{') depth++
      else if (template[i] === '}' && --depth === 0) {
        end = i
        break
      }
    }
    if (!/\bother\s*\{/.test(template.slice(m.index, end))) return false
  }
  return true
}

describe('i18n: словники кабінету й клієнтських сторінок', () => {
  test('uk і en мають однаковий набір ключів (джерело правди — uk)', () => {
    for (const section of Object.keys(uk) as (keyof typeof uk)[]) {
      assert.deepEqual(
        Object.keys(en[section]).sort(),
        Object.keys(uk[section]).sort(),
        `розділ ${section}: ключі en ≠ uk`
      )
    }
  })

  test('перемикач мови знає всі 9 мов', () => {
    assert.deepEqual([...locales].sort(), ['de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'ro', 'uk'])
  })

  for (const locale of TRANSLATED) {
    test(`${locale}: усі ключі en перекладені, без зайвих`, () => {
      const dict = DICTS[locale] as Record<string, Record<string, string> | undefined>
      const missing: string[] = []
      const extra: string[] = []
      for (const [section, keys] of Object.entries(en)) {
        for (const key of Object.keys(keys)) {
          const path = `${section}.${key}`
          if (typeof dict[section]?.[key] !== 'string' && !allowed(MISSING_ALLOWED, locale, path)) missing.push(path)
        }
      }
      for (const [section, keys] of Object.entries(dict)) {
        for (const key of Object.keys(keys ?? {})) {
          if (!(key in ((en as Record<string, object>)[section] ?? {}))) extra.push(`${section}.${key}`)
        }
      }
      assert.deepEqual(missing, [], `${locale}: бракує перекладу (додайте в src/lib/i18n/dictionaries/${locale}.ts)`)
      assert.deepEqual(extra, [], `${locale}: ключі, яких немає в en`)
    })

    test(`${locale}: плейсхолдери й множина як в en`, () => {
      const dict = DICTS[locale] as Record<string, Record<string, string> | undefined>
      const bad: string[] = []
      for (const [section, keys] of Object.entries(en)) {
        for (const [key, source] of Object.entries(keys as Record<string, string>)) {
          const value = dict[section]?.[key]
          if (typeof value !== 'string') continue
          const path = `${section}.${key}`
          if (placeholders(value).join() !== placeholders(source).join()) {
            bad.push(`${path}: {${placeholders(value).join(',')}} ≠ en {${placeholders(source).join(',')}}`)
          }
          if (!pluralBlocksHaveOther(value)) bad.push(`${path}: plural без «other»`)
        }
      }
      assert.deepEqual(bad, [])
    })

    test(`${locale}: рядки не скопійовані з англійської`, () => {
      const dict = DICTS[locale] as Record<string, Record<string, string> | undefined>
      const same: string[] = []
      for (const [section, keys] of Object.entries(en)) {
        for (const [key, source] of Object.entries(keys as Record<string, string>)) {
          const path = `${section}.${key}`
          if (dict[section]?.[key] === source && looksLikeSentence(source) && !allowed(SAME_AS_EN_ALLOWED, locale, path)) {
            same.push(path)
          }
        }
      }
      assert.deepEqual(same, [], `${locale}: значення збігається з англійським (перекладіть або внесіть у SAME_AS_EN_ALLOWED з причиною)`)
    })
  }
})

/** Same shape (keys, array lengths, value types) as the English object. */
function shapeDiff(ref: unknown, value: unknown, path: string, out: string[]): void {
  if (typeof ref === 'function') {
    if (typeof value !== 'function') out.push(`${path}: має бути функцією`)
    return
  }
  if (Array.isArray(ref)) {
    if (!Array.isArray(value)) return void out.push(`${path}: має бути масивом`)
    if (value.length !== ref.length) out.push(`${path}: ${value.length} елементів, в en — ${ref.length}`)
    ref.forEach((item, i) => shapeDiff(item, value[i], `${path}[${i}]`, out))
    return
  }
  if (ref && typeof ref === 'object') {
    if (!value || typeof value !== 'object') return void out.push(`${path}: немає`)
    for (const key of Object.keys(ref)) {
      shapeDiff((ref as Record<string, unknown>)[key], (value as Record<string, unknown>)[key], `${path}.${key}`, out)
    }
    for (const key of Object.keys(value)) if (!(key in ref)) out.push(`${path}.${key}: зайвий ключ`)
    return
  }
  if (typeof value !== typeof ref) out.push(`${path}: тип ${typeof value}, в en — ${typeof ref}`)
}

describe('i18n: лендинг, юридичні тексти, AI-відбір, політики клієнтів', () => {
  for (const locale of TRANSLATED) {
    test(`${locale}: лендинг має ту саму структуру, що en, і перекладений`, () => {
      const out: string[] = []
      const copy = getLandingCopy(locale)
      shapeDiff(getLandingCopy('en'), copy, 'landing', out)
      assert.deepEqual(out, [])
      assert.notEqual(copy, getLandingCopy('en'))
      assert.notEqual(copy.hero.subtitle, getLandingCopy('en').hero.subtitle)
      assert.match(copy.pricing.storage(100), /100/)
      assert.match(copy.pricing.yearHint('1 000'), /1 000/)
    })

    test(`${locale}: оферта й політика — та сама кількість розділів, що в uk, і помітка про чинну версію`, () => {
      const copy = getLegalCopy(locale)
      const ukCopy = getLegalCopy('uk')
      for (const doc of ['oferta', 'privacy'] as const) {
        assert.equal(copy[doc].sections.length, ukCopy[doc].sections.length, `${locale}.${doc}: кількість розділів`)
        copy[doc].sections.forEach((section, i) => {
          assert.equal(
            section.paragraphs.length,
            ukCopy[doc].sections[i].paragraphs.length,
            `${locale}.${doc} розділ ${i + 1}: кількість абзаців`
          )
        })
        assert.notEqual(copy[doc].title, getLegalCopy('en')[doc].title)
      }
      assert.ok(copy.reviewNote.trim().length > 40, `${locale}: reviewNote — помітка про юридично чинну українську версію`)
      assert.ok(copy.reviewNote !== getLegalCopy('en').reviewNote)
    })

    test(`${locale}: AI-відбір перекладений`, () => {
      const labels = cullingLabels(locale)
      const out: string[] = []
      shapeDiff(cullingLabels('en'), labels, 'culling', out)
      assert.deepEqual(out, [])
      const enLabels = cullingLabels('en')
      for (const [key, source] of Object.entries(enLabels)) {
        const value = (labels as Record<string, string>)[key]
        assert.equal(placeholders(value).join(), placeholders(source).join(), `culling.${key}: плейсхолдери`)
      }
      assert.notEqual(labels.intro, enLabels.intro)
    })

    test(`${locale}: довідка «Як це працює» перекладена`, () => {
      const out: string[] = []
      shapeDiff(galleryHelp('en'), galleryHelp(locale), 'help', out)
      assert.deepEqual(out, [])
      assert.notEqual(galleryHelp(locale).culling.title, galleryHelp('en').culling.title)
    })

    test(`${locale}: політики для клієнтів фотографа перекладені`, () => {
      for (const doc of ['privacy', 'refund'] as const) {
        const input = { name: '', email: 'a@b.c', locale }
        const policy = renderClientPolicy(doc, input)
        const enPolicy = renderClientPolicy(doc, { ...input, locale: 'en' })
        assert.equal(policy.blocks.length, enPolicy.blocks.length, `${locale}.${doc}: кількість блоків`)
        assert.notEqual(policy.title, enPolicy.title)
        assert.ok(policy.blocks.some((b) => b.includes('a@b.c')), `${locale}.${doc}: email фотографа в тексті`)
      }
    })
  }
})

describe('i18n: множина через Intl.PluralRules', () => {
  const tpl = '{n, plural, one {# zdjęcie} few {# zdjęcia} many {# zdjęć} other {# zdjęcia}}'
  test('польська: 1 / 2 / 5 / 22 — різні форми', () => {
    assert.equal(formatMessage(tpl, { n: 1 }, 'pl'), '1 zdjęcie')
    assert.equal(formatMessage(tpl, { n: 2 }, 'pl'), '2 zdjęcia')
    assert.equal(formatMessage(tpl, { n: 5 }, 'pl'), '5 zdjęć')
    assert.equal(formatMessage(tpl, { n: 22 }, 'pl'), '22 zdjęcia')
  })
  test('плейсхолдери поза plural підставляються, невідомі лишаються', () => {
    assert.equal(formatMessage('{a} / {b}', { a: 1 }, 'en'), '1 / {b}')
    assert.equal(formatMessage('{n, plural, =0 {none} one {# file} other {# files}}', { n: 0 }, 'en'), 'none')
    assert.equal(formatMessage('{n, plural, one {# file} other {# files}}', { n: 1200 }, 'de'), '1.200 files')
  })
  test('placeholders() бачить імена всередині plural', () => {
    assert.deepEqual(placeholders('{n, plural, one {# x {name}} other {#}} {date}'), ['date', 'n', 'name'])
  })
})

/**
 * «Статус зйомки для клієнта» (galleries.delivery_status / delivery_eta, 0055):
 * що бачить клієнт за посиланням — екран статусу, плашка чи звичайна галерея;
 * null = усе як раніше; приховані фото не рахуються як «фото є»; контраст
 * тексту ≥ 4.5:1 у кожному стилі галереї; порядок перевірок на сторінці
 * (закрито / пароль → потім статус); рендер екрана uk/en.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { before, describe, mock, test } from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  contrastRatio,
  countVisibleAssets,
  deliveryPalette,
  deliveryStep,
  deliveryView,
  ensureContrast,
  formatDeliveryEta,
  parseDeliveryEta,
  parseDeliveryStatus,
} from '@/lib/gallery/delivery'
import { THEME_CATALOG, resolveTokens } from '@/lib/site/themes'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('вибір: екран / плашка / звичайна галерея', () => {
  test('статус null → звичайна галерея за будь-якої кількості фото (старі галереї без змін)', () => {
    for (const n of [0, 1, 50]) {
      assert.equal(deliveryView(null, n), 'gallery')
      assert.equal(deliveryView(undefined, n), 'gallery')
    }
  })

  test("'shot' / 'editing' без видимих фото → екран статусу", () => {
    assert.equal(deliveryView('shot', 0), 'screen')
    assert.equal(deliveryView('editing', 0), 'screen')
  })

  test("'shot' / 'editing' з кількома прев'ю → галерея з плашкою", () => {
    assert.equal(deliveryView('shot', 1), 'banner')
    assert.equal(deliveryView('editing', 3), 'banner')
  })

  test("'ready' → звичайна галерея без плашки, навіть порожня", () => {
    assert.equal(deliveryView('ready', 0), 'gallery')
    assert.equal(deliveryView('ready', 10), 'gallery')
  })

  test('приховані фото (hidden_from_client) не рахуються як «фото є»', () => {
    const onlyHidden = [{ hidden_from_client: true }, { hidden_from_client: true }]
    assert.equal(countVisibleAssets(onlyHidden), 0)
    assert.equal(deliveryView('editing', countVisibleAssets(onlyHidden)), 'screen')
    const mixed = [...onlyHidden, { hidden_from_client: false }]
    assert.equal(countVisibleAssets(mixed), 1)
    assert.equal(deliveryView('editing', countVisibleAssets(mixed)), 'banner')
    assert.equal(countVisibleAssets(null), 0)
    assert.equal(countVisibleAssets(undefined), 0)
  })

  test('кроки: shot → 0 «Зйомка», editing → 1 «Обробка», ready → 2 «Готово»', () => {
    assert.equal(deliveryStep('shot'), 0)
    assert.equal(deliveryStep('editing'), 1)
    assert.equal(deliveryStep('ready'), 2)
  })
})

describe('розбір значень', () => {
  test('статус: лише shot / editing / ready, решта → null', () => {
    assert.equal(parseDeliveryStatus('shot'), 'shot')
    assert.equal(parseDeliveryStatus('editing'), 'editing')
    assert.equal(parseDeliveryStatus('ready'), 'ready')
    for (const bad of ['', 'done', 'READY', null, undefined, 1]) assert.equal(parseDeliveryStatus(bad), null)
  })

  test('дата: справжня YYYY-MM-DD, інакше null', () => {
    assert.equal(parseDeliveryEta('2026-12-14'), '2026-12-14')
    assert.equal(parseDeliveryEta('2028-02-29'), '2028-02-29')
    for (const bad of ['2026-02-30', '2026-13-01', '14.12.2026', '', null, undefined]) {
      assert.equal(parseDeliveryEta(bad), null, String(bad))
    }
  })

  test('дата у форматі локалі й без зсуву на день назад', () => {
    assert.equal(formatDeliveryEta('2026-12-14', 'uk'), '14 грудня 2026 р.')
    assert.equal(formatDeliveryEta('2026-12-14', 'en'), '14 December 2026')
    assert.match(formatDeliveryEta('2027-01-01', 'uk') ?? '', /^1 січня 2027/)
    assert.equal(formatDeliveryEta(null, 'uk'), null)
    assert.equal(formatDeliveryEta('garbage', 'en'), null)
  })
})

describe('контраст ≥ 4.5:1 у всіх стилях галерей', () => {
  const accents = (mode: string) => [mode === 'night' ? '#8fa2ff' : '#2f55ff', '#ffd400', '#c8331f', '#ffffff', '#000000']

  for (const entry of THEME_CATALOG) {
    test(`${entry.value} (${entry.mode})`, () => {
      const tokens = resolveTokens(entry.theme, entry.mode)
      for (const accent of accents(entry.mode)) {
        const p = deliveryPalette({ ...tokens, accent })
        for (const ground of [p.bg, p.surface]) {
          for (const [name, color] of [['fg', p.fg], ['muted', p.muted], ['accent', p.accent]] as const) {
            const ratio = contrastRatio(color, ground)
            assert.ok(ratio >= 4.5, `${entry.value} accent=${accent}: ${name} ${color} on ${ground} = ${ratio.toFixed(2)}`)
          }
        }
        // The ✓ / number on the filled dot is a graphic: ≥ 3:1.
        assert.ok(contrastRatio(p.onAccent, p.accent) >= 3, `${entry.value} onAccent`)
      }
    })
  }

  test('«Опівніч» зберігає свій нічний фон і світлий текст', () => {
    const p = deliveryPalette({ ...resolveTokens('tysha', 'night'), accent: '#8fa2ff' })
    assert.equal(p.bg, '#0d0b09')
    assert.equal(p.fg, '#efe6d6')
  })

  test('ensureContrast не чіпає колір, який уже читається', () => {
    assert.equal(ensureContrast('#161513', '#f2f1ed', '#161513'), '#161513')
    assert.notEqual(ensureContrast('#8a8781', '#f2f1ed', '#161513'), '#8a8781')
  })
})

describe('сторінка галереї: порядок перевірок і запити', () => {
  const page = source('src/app/[locale]/g/[slug]/page.tsx')

  test('статус і дата читаються разом із галереєю', () => {
    assert.match(page, /select\(\s*'[^']*delivery_status, delivery_eta'/)
  })

  test('спершу закриття (public_gallery_state) і пароль (isGalleryUnlocked), потім статус', () => {
    const closed = page.indexOf("rpc('public_gallery_state'")
    const password = page.indexOf('isGalleryUnlocked(gallery)')
    const decision = page.indexOf('deliveryView(')
    const screen = page.indexOf('<DeliveryStatusScreen')
    assert.ok(closed > 0 && password > 0 && decision > 0 && screen > 0)
    assert.ok(closed < decision && password < decision && decision < screen)
  })

  test('фото для клієнта фільтруються за hidden_from_client і рахуються через countVisibleAssets', () => {
    assert.match(page, /\.eq\('hidden_from_client', false\)/)
    assert.match(page, /deliveryView\(deliveryStatus, countVisibleAssets\(assets\)\)/)
  })

  test('плашка лише для view === banner, інакше GalleryExperience без змін (deliveryNotice = null)', () => {
    assert.match(page, /view === 'banner'\s*\?[\s\S]*?:\s*null/)
  })
})

describe('кабінет: збереження статусу', () => {
  const action = source('src/lib/actions/galleries.ts')
  const dashboard = source('src/app/[locale]/dashboard/galleries/[id]/page.tsx')

  test('setGalleryDelivery перевіряє значення й власника', () => {
    const body = action.slice(action.indexOf('export async function setGalleryDelivery'))
    assert.match(body, /parseDeliveryStatus\(status\)/)
    assert.match(body, /parseDeliveryEta\(eta\)/)
    assert.match(body, /\.eq\('owner_id', user\.id\)/)
  })

  test('сторінка галереї в кабінеті показує перемикач і читає поля', () => {
    assert.match(dashboard, /<DeliveryStatusControl/)
    assert.match(dashboard, /delivery_status, delivery_eta'/)
  })
})

describe('переклади', () => {
  test('uk і en мають усі рядки екрана, плашки й перемикача', () => {
    for (const dict of [uk, en]) {
      for (const key of Object.keys(uk.publicGallery).filter((k) => k.startsWith('delivery'))) {
        assert.ok((dict.publicGallery as Record<string, string>)[key], `publicGallery.${key}`)
      }
      for (const key of Object.keys(uk.galleryManage).filter((k) => k.startsWith('delivery'))) {
        assert.ok((dict.galleryManage as Record<string, string>)[key], `galleryManage.${key}`)
      }
    }
    assert.match(uk.publicGallery.deliveryEta, /\{date\}/)
    assert.match(en.publicGallery.deliveryEta, /\{date\}/)
  })
})

describe('екран статусу (рендер)', () => {
  let render: (locale: 'uk' | 'en', props: Record<string, unknown>) => string
  before(async () => {
    mock.module('next/navigation', { namedExports: { usePathname: () => '/uk/g/demo' } })
    // CSS modules don't load in node: class names = their keys.
    const cssPath = 'src/components/gallery/DeliveryStatus.module.css'
    const css = Object.fromEntries(
      [...source(cssPath).matchAll(/\.([a-zA-Z][\w-]*)/g)].map(([, name]) => [name, name])
    )
    mock.module(pathToFileURL(join(ROOT, cssPath)).href, { defaultExport: css, namedExports: css })
    ;(globalThis as { React?: typeof React }).React = React
    const { DeliveryStatusScreen } = await import('@/components/gallery/DeliveryStatusScreen')
    const { deliveryLabels } = await import('@/lib/gallery/labels')
    render = (locale, props) =>
      renderToStaticMarkup(
        createElement(DeliveryStatusScreen, {
          locale,
          title: 'Марта і Богдан',
          brandName: 'Ольга Вишня',
          logoUrl: null,
          status: 'editing',
          etaText: null,
          contactUrl: null,
          showBadge: false,
          theme: 'tysha',
          mode: 'night',
          labels: deliveryLabels(locale === 'uk' ? uk : en),
          ...props,
        } as Parameters<typeof DeliveryStatusScreen>[0])
      )
  })

  test('uk: назва, фотограф, три кроки, поточний — «Обробка», дата «орієнтовно до»', () => {
    const html = render('uk', { etaText: formatDeliveryEta('2026-12-14', 'uk') })
    assert.match(html, /Марта і Богдан/)
    assert.match(html, /Ольга Вишня/)
    assert.match(html, /Ваші кадри вже в роботі/)
    assert.match(html, /Зйомка[\s\S]*Обробка[\s\S]*Готово/)
    assert.match(html, /aria-current="step"[^>]*>[\s\S]*?Обробка/)
    assert.match(html, /Орієнтовно до 14 грудня 2026/)
  })

  test('без дати — жодного «орієнтовно»; en перекладено', () => {
    const html = render('en', { status: 'shot' })
    assert.doesNotMatch(html, /Expected by/)
    assert.match(html, /Your photos are already in progress/)
    assert.match(html, /aria-current="step"[^>]*>[\s\S]*?Shoot/)
  })

  test('без вигаданих цифр: на екрані немає відсотків і «днів»', () => {
    const html = render('uk', {})
    assert.doesNotMatch(html, /%|\bдн/)
  })
})

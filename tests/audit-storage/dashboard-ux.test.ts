/**
 * Зручний кабінет фотографа: меню (адмінські розділи лише власниці), вікно
 * «Поділитися» (посилання, готовий текст мовою клієнта, месенджери, пароль),
 * пошук і сортування списку галерей, вкладки галереї, переклади нових
 * клієнтських рядків на всі мови клієнта.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { ADMIN_ONLY_SECTIONS, dashboardNavItems } from '@/lib/dashboard/nav'
import { filterAndSortGalleries, normalizeForSearch, parseGallerySort } from '@/lib/dashboard/gallery-list'
import { parseGalleryTab } from '@/lib/dashboard/tabs'
import { galleryShareUrl, shareLocaleOrDefault, shareMessage, shareSubject, shareTargets } from '@/lib/gallery/share'
import { getDictionary } from '@/lib/i18n'
import { locales } from '@/lib/i18n/config'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'

const ROOT = join(__dirname, '..', '..')

describe('меню кабінету', () => {
  test('фотограф не бачить «Блог», «Хаб», «Контент», «Сторіс», «Threads», «Статистику»', async () => {
    const dict = await getDictionary('uk')
    const items = dashboardNavItems('uk', dict, false)
    const labels = items.map((item) => item.label)
    for (const hidden of ['Блог', 'Хаб', 'Контент', 'Сторіс', 'Threads', dict.dashboard.statsLink]) {
      assert.ok(!labels.includes(hidden), hidden)
    }
    for (const section of ADMIN_ONLY_SECTIONS) {
      assert.ok(!items.some((item) => item.href.endsWith(`/dashboard/${section}`)), section)
    }
    assert.deepEqual(
      items.map((item) => item.href),
      ['/uk/dashboard', '/uk/dashboard/site', '/uk/dashboard/booking', '/uk/dashboard/offline', '/uk/dashboard/albums', '/uk/dashboard/billing', '/uk/dashboard/referrals', '/uk/dashboard/settings']
    )
  })

  test('власниця бачить усі адмінські розділи', async () => {
    const items = dashboardNavItems('uk', await getDictionary('uk'), true)
    for (const section of ADMIN_ONLY_SECTIONS) {
      assert.ok(items.some((item) => item.href === `/uk/dashboard/${section}`), section)
    }
  })

  test('кожна адмінська сторінка сама перевіряє isAdminEmail → notFound', () => {
    const pages = ['blog', 'blog/[id]', 'hub', 'content', 'content/[id]', 'stories', 'threads', 'stats', 'stats/account/[userId]']
    for (const page of pages) {
      const source = readFileSync(join(ROOT, 'src', 'app', '[locale]', 'dashboard', page, 'page.tsx'), 'utf8')
      assert.match(source, /if \(!isAdminEmail\(user\.email\)\) notFound\(\)/, page)
    }
  })

  test('layout будує меню через dashboardNavItems з isAdminEmail', () => {
    const source = readFileSync(join(ROOT, 'src', 'app', '[locale]', 'dashboard', 'layout.tsx'), 'utf8')
    assert.match(source, /dashboardNavItems\(locale, dict, isAdminEmail\(user\.email\)\)/)
    assert.doesNotMatch(source, /label: 'Блог'/)
  })
})

describe('«Поділитися»', () => {
  const strings = {
    shareReady: uk.publicGallery.shareReady,
    shareInProgress: uk.publicGallery.shareInProgress,
    sharePassword: uk.publicGallery.sharePassword,
    shareSubject: uk.publicGallery.shareSubject,
  }
  const url = galleryShareUrl('https://proiav.space/', 'pl', 'olha-marta-x1')

  test('посилання: мова клієнта в шляху, без подвійного слеша', () => {
    assert.equal(url, 'https://proiav.space/pl/g/olha-marta-x1')
    assert.equal(shareLocaleOrDefault('de', 'uk'), 'de')
    assert.equal(shareLocaleOrDefault('xx', 'uk'), 'uk')
    assert.equal(shareLocaleOrDefault(null, 'en'), 'en')
  })

  test('готовий текст: назва, посилання; пароль — лише нагадування, що прийде окремо', () => {
    const plain = shareMessage(strings, { title: 'Марта і Богдан', url, hasPassword: false, inProgress: false })
    assert.equal(plain, `Вітаю! Ваша галерея «Марта і Богдан» готова:\n${url}`)
    const locked = shareMessage(strings, { title: 'Марта і Богдан', url, hasPassword: true, inProgress: false })
    assert.ok(locked.endsWith('\nГалерея захищена паролем — надішлю його окремим повідомленням.'))
    const editing = shareMessage(strings, { title: 'Марта', url, hasPassword: false, inProgress: true })
    assert.match(editing, /Зараз фото в обробці/)
    assert.ok(editing.includes(url))
    assert.equal(shareSubject(strings, 'Марта'), 'Ваша галерея «Марта»')
  })

  test('месенджери: Telegram отримує посилання окремо (без дубля в тексті), решта — увесь текст', () => {
    const message = shareMessage(strings, { title: 'Марта', url, hasPassword: true, inProgress: false })
    const targets = shareTargets(message, url, 'Тема')
    const tg = new URL(targets.telegram)
    assert.equal(tg.origin + tg.pathname, 'https://t.me/share/url')
    assert.equal(tg.searchParams.get('url'), url)
    assert.ok(!tg.searchParams.get('text')!.includes(url))
    assert.match(tg.searchParams.get('text')!, /паролем/)
    assert.equal(decodeURIComponent(targets.whatsapp.replace('https://wa.me/?text=', '')), message)
    assert.equal(decodeURIComponent(targets.viber.replace('viber://forward?text=', '')), message)
    assert.equal(targets.email, `mailto:?subject=${encodeURIComponent('Тема')}&body=${encodeURIComponent(message)}`)
  })

  test('сторінка галереї: текст «в обробці», коли клієнт бачить екран або плашку статусу', () => {
    const source = readFileSync(join(ROOT, 'src', 'app', '[locale]', 'dashboard', 'galleries', '[id]', 'page.tsx'), 'utf8')
    assert.match(source, /const inProgress = deliveryView\(deliveryStatus, countVisibleAssets\(assets\)\) !== 'gallery'/)
  })
})

describe('список галерей: пошук і сортування', () => {
  const g = (title: string, created: string, eventDate: string | null, updated = created) => ({
    title,
    created_at: created,
    updated_at: updated,
    event_date: eventDate,
  })
  const items = [
    g('Марʼяна · весілля', '2026-10-01', '2026-09-14', '2026-11-05'),
    g('Сімейна прогулянка в Карпатах', '2026-10-20', '2026-10-03'),
    g('Аня · портрет', '2026-11-01', null),
    g('хрещення Софійки', '2026-08-01', '2026-08-22'),
  ]

  test('пошук без огляду на регістр і апостроф, усі слова', () => {
    assert.deepEqual(filterAndSortGalleries(items, "мар'яна", 'newest').map((i) => i.title), ['Марʼяна · весілля'])
    assert.deepEqual(filterAndSortGalleries(items, 'КАРПАТ', 'newest').length, 1)
    assert.deepEqual(filterAndSortGalleries(items, 'прогулянка карпат', 'newest').length, 1)
    assert.deepEqual(filterAndSortGalleries(items, 'прогулянка весілля', 'newest').length, 0)
    assert.equal(filterAndSortGalleries(items, '   ', 'newest').length, 4)
    assert.equal(normalizeForSearch('  Мар’яна  ВЕСІЛЛЯ '), 'маряна весілля')
  })

  test('сортування: нові, дата зйомки (без дати — в кінці), змінені, назва', () => {
    const titles = (sort: Parameters<typeof filterAndSortGalleries>[2]) => filterAndSortGalleries(items, '', sort).map((i) => i.title)
    assert.deepEqual(titles('newest'), ['Аня · портрет', 'Сімейна прогулянка в Карпатах', 'Марʼяна · весілля', 'хрещення Софійки'])
    assert.deepEqual(titles('shoot'), ['Сімейна прогулянка в Карпатах', 'Марʼяна · весілля', 'хрещення Софійки', 'Аня · портрет'])
    assert.deepEqual(titles('updated')[0], 'Марʼяна · весілля')
    assert.deepEqual(titles('title'), ['Аня · портрет', 'Марʼяна · весілля', 'Сімейна прогулянка в Карпатах', 'хрещення Софійки'])
    assert.equal(parseGallerySort('bogus'), 'newest')
    assert.equal(parseGallerySort('title'), 'title')
  })

  test('вихідний масив не змінюється', () => {
    const before = items.map((i) => i.title)
    filterAndSortGalleries(items, '', 'title')
    assert.deepEqual(items.map((i) => i.title), before)
  })
})

describe('вкладки галереї', () => {
  test('?tab= → одна з чотирьох, інакше «Фото»', () => {
    for (const tab of ['photos', 'design', 'access', 'client']) assert.equal(parseGalleryTab(tab), tab)
    assert.equal(parseGalleryTab(undefined), 'photos')
    assert.equal(parseGalleryTab('../x'), 'photos')
  })
})

describe('переклади нових клієнтських рядків', () => {
  const CLIENT_KEYS = [
    'shareReady',
    'shareInProgress',
    'sharePassword',
    'shareSubject',
    'deliveryTitle',
    'deliveryNote',
    'deliveryEta',
    'deliverySteps',
    'deliveryStepShot',
    'deliveryStepEditing',
    'deliveryStepReady',
    'deliveryStepDone',
    'deliveryStepCurrent',
    'deliveryBanner',
    'deliveryBannerEta',
    'contactPhotographer',
  ] as const

  test('кожна мова клієнта перекладає їх сама (не падає на англійську)', async () => {
    for (const locale of locales) {
      if (locale === 'uk' || locale === 'en') continue
      const dict = await getDictionary(locale)
      for (const key of CLIENT_KEYS) {
        const value = dict.publicGallery[key]
        assert.ok(value, `${locale}.${key}`)
        assert.notEqual(value, en.publicGallery[key], `${locale}.${key} ще англійською`)
      }
    }
  })

  test('увесь розділ publicGallery перекладено в кожній мові клієнта', async () => {
    for (const locale of locales) {
      if (locale === 'uk' || locale === 'en') continue
      const file = readFileSync(join(ROOT, 'src', 'lib', 'i18n', 'dictionaries', `${locale}.ts`), 'utf8')
      const section = file.slice(file.indexOf('publicGallery: {'))
      for (const key of Object.keys(uk.publicGallery)) {
        assert.match(section, new RegExp(`\\n    ${key}:`), `${locale}.publicGallery.${key}`)
      }
    }
  })

  test('плейсхолдери {title} / {url} / {date} збережено в кожному перекладі', async () => {
    for (const locale of locales) {
      const pg = (await getDictionary(locale)).publicGallery
      assert.match(pg.shareReady, /\{title\}[\s\S]*\{url\}/, locale)
      assert.match(pg.shareInProgress, /\{title\}[\s\S]*\{url\}/, locale)
      assert.match(pg.shareSubject, /\{title\}/, locale)
      assert.match(pg.deliveryEta, /\{date\}/, locale)
      assert.match(pg.deliveryBannerEta, /\{date\}/, locale)
      assert.doesNotMatch(pg.sharePassword, /\{/, locale)
    }
  })
})

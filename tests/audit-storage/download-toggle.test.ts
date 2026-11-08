/**
 * «Клієнт може завантажувати фото» (galleries.downloads_enabled, 0068):
 * маршрути завантаження (одне фото, «Завантажити все») при вкл / викл / коли
 * колонки ще нема (міграцію не накочено) / для власника / при збої читання;
 * людський текст 403 мовою відвідувача; кнопки в галереї клієнта; перемикач
 * у кабінеті; міграція й реєстр номерів.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { before, beforeEach, describe, mock, test } from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n'
import { locales } from '@/lib/i18n/config'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'
import { isMissingDownloadsColumn, readDownloadsSetting, requestLocale } from '@/lib/gallery/downloads'

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const fileUrl = (path: string) => pathToFileURL(join(ROOT, path)).href

// ---------------------------------------------------------------- fake db

const OWNER = 'owner-1'
const state = {
  /** null — column missing (0068 not applied); 'boom' — any other failure. */
  column: 'present' as 'present' | 'missing' | 'boom',
  downloadsEnabled: true,
  user: null as { id: string } | null,
  rpcs: [] as string[],
}

const gallery = { id: 'g-1', slug: 'olha-marta', has_password: false, owner_id: OWNER }
const asset = {
  id: 'a-1',
  gallery_id: 'g-1',
  owner_id: OWNER,
  r2_key: `u/${OWNER}/g/g-1/o/00000000-0000-0000-0000-000000000000-IMG_1.jpg`,
  hidden_from_client: false,
  size_bytes: 1000,
}

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private columns = '*'
  constructor(private readonly table: string) {}
  select(columns = '*') {
    this.columns = columns
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  returns() {
    return this
  }
  private result(): { data: unknown; error: unknown } {
    if (this.table === 'galleries') {
      if (this.columns.includes('downloads_enabled')) {
        if (state.column === 'missing') {
          return { data: null, error: { code: '42703', message: 'column galleries.downloads_enabled does not exist' } }
        }
        if (state.column === 'boom') return { data: null, error: { code: '57014', message: 'canceling statement' } }
        return { data: { downloads_enabled: state.downloadsEnabled }, error: null }
      }
      return { data: gallery, error: null }
    }
    if (this.table === 'assets') return { data: this.columns === '*' ? [asset] : asset, error: null }
    return { data: null, error: null }
  }
  async single() {
    const r = this.result()
    return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error }
  }
  async maybeSingle() {
    return this.single()
  }
  then<A = { data: unknown; error: unknown }, B = never>(
    ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return Promise.resolve(this.result()).then(ok, fail)
  }
}

const client = {
  from: (table: string) => new Query(table),
  rpc: async (name: string) => {
    state.rpcs.push(name)
    return { data: null, error: null }
  },
  auth: { getUser: async () => ({ data: { user: state.user } }) },
}

type Handler = (request: Request, context: { params: Record<string, string> }) => Promise<Response>
let downloadOne: Handler
let archiveUrls: Handler

before(async () => {
  mock.module(fileUrl('src/lib/supabase/server.ts'), { namedExports: { createSupabaseServerClient: () => client } })
  mock.module(fileUrl('src/lib/supabase/admin.ts'), { namedExports: { createSupabaseAdminClient: () => client } })
  mock.module(fileUrl('src/lib/gallery-access.ts'), {
    namedExports: { isGalleryUnlocked: async () => true, galleryAssetsClient: () => client },
  })
  mock.module(fileUrl('src/lib/storage/index.ts'), {
    namedExports: { getStorage: () => ({ getSignedReadUrl: async (key: string) => `https://r2.test/${key}` }) },
  })
  downloadOne = (await import('@/app/api/assets/[id]/download/route')).GET as unknown as Handler
  archiveUrls = (await import('@/app/api/galleries/[slug]/archive-urls/route')).GET as unknown as Handler
})

beforeEach(() => {
  state.column = 'present'
  state.downloadsEnabled = true
  state.user = null
  state.rpcs = []
})

const one = (headers: Record<string, string> = {}) =>
  downloadOne(new Request('https://proiav.space/api/assets/a-1/download', { headers }), { params: { id: 'a-1' } })
const all = (headers: Record<string, string> = {}) =>
  archiveUrls(new Request('https://proiav.space/api/galleries/olha-marta/archive-urls', { headers }), {
    params: { slug: 'olha-marta' },
  })

describe('маршрути завантаження', () => {
  test('увімкнено: одне фото → 302 на підписаний URL, архів → список файлів', async () => {
    const res = await one()
    assert.equal(res.status, 302)
    assert.match(res.headers.get('location') ?? '', /^https:\/\/r2\.test\//)
    assert.deepEqual(state.rpcs, ['record_gallery_download'])
    const list = await all()
    assert.equal(list.status, 200)
    assert.equal(((await list.json()) as { files: unknown[] }).files.length, 1)
  })

  test('вимкнено: обидва маршрути → 403 з людським текстом, без підписаного URL і без лічильника', async () => {
    state.downloadsEnabled = false
    const res = await one({ referer: 'https://proiav.space/uk/g/olha-marta' })
    assert.equal(res.status, 403)
    assert.match(res.headers.get('content-type') ?? '', /text\/plain/)
    assert.equal(await res.text(), uk.publicGallery.downloadsDisabled)
    assert.equal(res.headers.get('location'), null)
    assert.deepEqual(state.rpcs, [])

    const list = await all({ referer: 'https://proiav.space/en/g/olha-marta' })
    assert.equal(list.status, 403)
    assert.deepEqual(await list.json(), { error: 'downloads_disabled', message: en.publicGallery.downloadsDisabled })
    assert.deepEqual(state.rpcs, [])
  })

  test('вимкнено, але запит від власника галереї — завантаження працює', async () => {
    state.downloadsEnabled = false
    state.user = { id: OWNER }
    assert.equal((await one()).status, 302)
    assert.equal((await all()).status, 200)
  })

  test('інший користувач (не власник) при вимкненому — 403', async () => {
    state.downloadsEnabled = false
    state.user = { id: 'someone-else' }
    assert.equal((await one()).status, 403)
    assert.equal((await all()).status, 403)
  })

  test('колонки нема (0068 не накочено) — дозволено, нічого не падає', async () => {
    state.column = 'missing'
    assert.equal((await one()).status, 302)
    assert.equal((await all()).status, 200)
  })

  test('невідомий збій читання налаштування — закрито (це налаштування приватності)', async () => {
    state.column = 'boom'
    const originalError = console.error
    console.error = () => {}
    try {
      assert.equal((await one()).status, 403)
      assert.equal((await all()).status, 403)
    } finally {
      console.error = originalError
    }
  })

  test('мова тексту 403: ?lang → сторінка галереї (referer) → Accept-Language → uk', async () => {
    state.downloadsEnabled = false
    const pl = await downloadOne(new Request('https://proiav.space/api/assets/a-1/download?lang=pl'), { params: { id: 'a-1' } })
    assert.equal(await pl.text(), (await getDictionary('pl')).publicGallery.downloadsDisabled)
    assert.equal(await (await one({ 'accept-language': 'de-DE,de;q=0.9' })).text(), (await getDictionary('de')).publicGallery.downloadsDisabled)
    assert.equal(await (await one()).text(), uk.publicGallery.downloadsDisabled)
    const req = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) })
    assert.equal(requestLocale(req('https://x/a', { referer: 'https://x/fr/g/s' })), 'fr')
    assert.equal(requestLocale(req('https://x/a?lang=xx', { 'accept-language': 'it' })), 'it')
  })
})

describe('читання налаштування', () => {
  test('відсутня колонка / без гранту → «дозволено, недоступно»; true/false/null читаються як є', async () => {
    assert.ok(isMissingDownloadsColumn({ code: '42703' }))
    assert.ok(isMissingDownloadsColumn({ code: 'PGRST204' }))
    assert.ok(isMissingDownloadsColumn({ message: 'permission denied for column downloads_enabled' }))
    assert.ok(!isMissingDownloadsColumn({ code: '57014', message: 'timeout' }))
    assert.ok(!isMissingDownloadsColumn(null))

    const fake = (result: { data: unknown; error: unknown }) => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
    })
    const read = (result: { data: unknown; error: unknown }) =>
      readDownloadsSetting(fake(result) as never, 'g')
    assert.deepEqual(await read({ data: { downloads_enabled: false }, error: null }), { enabled: false, available: true })
    assert.deepEqual(await read({ data: { downloads_enabled: true }, error: null }), { enabled: true, available: true })
    assert.deepEqual(await read({ data: {}, error: null }), { enabled: true, available: true })
    assert.deepEqual(await read({ data: null, error: { code: '42703', message: 'x' } }), { enabled: true, available: false })
  })

  test('колонку читає окремий запит — основні select-и галереї її не згадують', () => {
    for (const path of [
      'src/app/[locale]/g/[slug]/page.tsx',
      'src/app/[locale]/dashboard/galleries/[id]/page.tsx',
      'src/app/api/assets/[id]/download/route.ts',
      'src/app/api/galleries/[slug]/archive-urls/route.ts',
    ]) {
      const text = source(path)
      assert.doesNotMatch(text, /select\([^)]*downloads_enabled/, path)
      assert.match(text, /readDownloadsSetting\(/, path)
    }
  })
})

describe('галерея клієнта', () => {
  let render: (downloadsEnabled: boolean) => string

  before(async () => {
    mock.module('next/navigation', { namedExports: { usePathname: () => '/uk/g/demo', useRouter: () => ({ refresh() {} }) } })
    for (const css of ['src/components/gallery/GalleryExperience.module.css', 'src/components/gallery/DeliveryStatus.module.css']) {
      // CSS-module class names, as the bundler would hand them out.
      const names = Object.fromEntries(
        [...source(css).matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(([, name]) => [name, name])
      )
      mock.module(pathToFileURL(join(ROOT, css)).href, { defaultExport: names, namedExports: names })
    }
    ;(globalThis as { React?: typeof React }).React = React
    const { GalleryExperience } = await import('@/components/gallery/GalleryExperience')
    const { galleryLabels } = await import('@/lib/gallery/labels')
    render = (downloadsEnabled) =>
      renderToStaticMarkup(
        createElement(GalleryExperience, {
          locale: 'uk',
          slug: 'demo',
          title: 'Марта',
          eventLine: null,
          brandName: null,
          logoUrl: null,
          coverUrl: null,
          items: [1, 2].map((n) => ({
            id: `a${n}`,
            kind: 'photo' as const,
            width: 1600,
            height: 1067,
            previewUrl: `https://x/${n}.jpg`,
            downloadHref: `/api/assets/a${n}/download`,
          })),
          initialFavorites: [],
          showBadge: false,
          tipUrl: null,
          theme: 'tysha',
          mode: 'day',
          labels: galleryLabels(uk as never),
          downloadsEnabled,
        } as never)
      )
  })

  test('увімкнено — «Завантажити все», підказка і «↓» на фото є', () => {
    const html = render(true)
    assert.ok(html.includes(uk.publicGallery.downloadAll))
    assert.ok(html.includes(uk.publicGallery.downloadHint))
    assert.ok(html.includes('/api/assets/a1/download'))
  })

  test('вимкнено — жодної кнопки завантаження, підказки й посилання на оригінал', () => {
    const html = render(false)
    assert.ok(!html.includes(uk.publicGallery.downloadAll))
    assert.ok(!html.includes(uk.publicGallery.downloadHint))
    assert.ok(!html.includes('/download'))
  })

  test('лайтбокс теж ховає кнопку «завантажити оригінал»', () => {
    const lightbox = source('src/components/gallery/GalleryLightbox.tsx')
    assert.match(lightbox, /downloadsEnabled\s*\?\s*\[<DownloadButton/)
    assert.match(source('src/components/gallery/GalleryExperience.tsx'), /downloadsEnabled=\{downloadsEnabled\}/)
  })
})

describe('кабінет, тексти, міграція', () => {
  test('перемикач у «Доступі» замість пояснювального блоку; лічильник лишився', () => {
    const page = source('src/app/[locale]/dashboard/galleries/[id]/page.tsx')
    assert.match(page, /<DownloadsToggle/)
    assert.match(page, /accessDownloadsCount/)
    assert.doesNotMatch(page, /accessDownloadsText/)
    assert.equal(uk.galleryManage.downloadsToggle, 'Клієнт може завантажувати фото')
    assert.equal(en.galleryManage.downloadsToggle, 'Client can download photos')
  })

  test('setGalleryDownloads: лише власник, без міграції — «migration», нічого не ламає', () => {
    const actions = source('src/lib/actions/galleries.ts')
    const body = actions.slice(actions.indexOf('export async function setGalleryDownloads'))
    assert.match(body, /\.eq\('owner_id', user\.id\)/)
    assert.match(body, /isMissingDownloadsColumn\(error\)\) return \{ ok: false, error: 'migration' \}/)
  })

  test('текст 403 є в усіх 9 мовах і відрізняється від англійського', async () => {
    for (const locale of locales) {
      const text = (await getDictionary(locale)).publicGallery.downloadsDisabled
      assert.ok(text && text.length > 20, locale)
      if (locale !== 'en') assert.notEqual(text, en.publicGallery.downloadsDisabled, locale)
    }
  })

  test('міграція 0068: колонка з дефолтом true, грант на читання; номер у реєстрі CLAUDE.md', () => {
    const sql = source('supabase/migrations/0068_gallery_downloads_enabled.sql')
    assert.match(sql, /add column if not exists downloads_enabled boolean not null default true/)
    assert.match(sql, /grant select \(downloads_enabled\) on public\.galleries to anon, authenticated/)
    const claude = source('CLAUDE.md')
    assert.match(claude, /`0068` — перемикач завантажень/)
    assert.match(claude, /наступний вільний номер — `0069`/)
  })
})

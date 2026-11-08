/**
 * Сайти й бронювання сховані до окремого релізу (src/lib/features/sites.ts):
 * без NEXT_PUBLIC_SITES_ENABLED=1 фотограф не бачить їх у меню, розділи
 * кабінету ведуть на /dashboard, публічні сторінки й API — 404. Власниця
 * платформи (ADMIN_EMAILS) бачить усе завжди. Увімкнення прапорця повертає все.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, beforeEach, describe, mock, test } from 'node:test'
import React, { type ReactNode } from 'react'
import { dashboardNavItems } from '@/lib/dashboard/nav'
import { canSeeSites, sitesEnabled } from '@/lib/features/sites'
import { getDictionary } from '@/lib/i18n'

const ROOT = join(__dirname, '..', '..')
const OWNER = 'dianahohol97@gmail.com'
const PHOTOGRAPHER = 'photographer@example.com'
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

let currentEmail: string | null = null
const withFlag = async (on: boolean, run: () => Promise<void> | void) => {
  const before = process.env.NEXT_PUBLIC_SITES_ENABLED
  if (on) process.env.NEXT_PUBLIC_SITES_ENABLED = '1'
  else delete process.env.NEXT_PUBLIC_SITES_ENABLED
  try {
    await run()
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_SITES_ENABLED
    else process.env.NEXT_PUBLIC_SITES_ENABLED = before
  }
}

class NotFound extends Error {}
class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`)
  }
}

before(() => {
  // tsx compiles the layouts' JSX in classic mode (React.createElement).
  ;(globalThis as { React?: typeof React }).React = React
  delete process.env.NEXT_PUBLIC_SITES_ENABLED
  delete process.env.ADMIN_EMAILS
  mock.module('next/navigation', {
    namedExports: {
      notFound: () => {
        throw new NotFound()
      },
      redirect: (to: string) => {
        throw new Redirect(to)
      },
    },
  })
  mock.module(pathToFileURL(join(ROOT, 'src/lib/supabase/server.ts')).href, {
    namedExports: {
      createSupabaseServerClient: () => ({
        auth: {
          getUser: async () => ({ data: { user: currentEmail ? { id: 'u1', email: currentEmail } : null } }),
        },
      }),
    },
  })
})
beforeEach(() => {
  currentEmail = null
})
after(() => {
  delete process.env.NEXT_PUBLIC_SITES_ENABLED
})

describe('прапорець', () => {
  test('за замовчуванням вимкнено; лише «1» вмикає', async () => {
    assert.equal(sitesEnabled(), false)
    await withFlag(true, () => assert.equal(sitesEnabled(), true))
    process.env.NEXT_PUBLIC_SITES_ENABLED = 'true'
    assert.equal(sitesEnabled(), false)
    delete process.env.NEXT_PUBLIC_SITES_ENABLED
  })

  test('власниця бачить завжди, фотограф — лише з прапорцем', async () => {
    assert.equal(canSeeSites(OWNER), true)
    assert.equal(canSeeSites(OWNER.toUpperCase()), true)
    assert.equal(canSeeSites(PHOTOGRAPHER), false)
    assert.equal(canSeeSites(null), false)
    await withFlag(true, () => {
      assert.equal(canSeeSites(PHOTOGRAPHER), true)
      assert.equal(canSeeSites(null), true)
    })
  })
})

describe('меню кабінету', () => {
  const hrefs = async (isAdmin: boolean) =>
    dashboardNavItems('uk', await getDictionary('uk'), isAdmin).map((item) => item.href)

  test('фотограф без прапорця: без «Сайт» і «Бронювання»', async () => {
    const items = await hrefs(false)
    assert.ok(!items.includes('/uk/dashboard/site'))
    assert.ok(!items.includes('/uk/dashboard/booking'))
    assert.ok(items.includes('/uk/dashboard'))
  })

  test('власниця бачить «Сайт» і «Бронювання» без прапорця', async () => {
    const items = await hrefs(true)
    assert.ok(items.includes('/uk/dashboard/site'))
    assert.ok(items.includes('/uk/dashboard/booking'))
  })

  test('з прапорцем фотограф бачить їх на тому ж місці, що й раніше', async () => {
    await withFlag(true, async () => {
      const items = await hrefs(false)
      assert.deepEqual(items.slice(0, 3), ['/uk/dashboard', '/uk/dashboard/site', '/uk/dashboard/booking'])
    })
  })

  test('десктоп і мобільне меню будуються з одного списку', () => {
    const layout = source('src/app/[locale]/dashboard/layout.tsx')
    assert.match(layout, /dashboardNavItems\(locale, dict, isAdminEmail\(user\.email\)\)/)
    assert.equal(layout.match(/<DashNav items=\{items\} \/>/g)?.length, 2)
  })
})

describe('кабінет: /dashboard/site і /dashboard/booking (з підсторінками) → /dashboard', () => {
  for (const section of ['site', 'booking']) {
    test(`${section}: фотограф → редирект, власниця й прапорець → сторінка`, async () => {
      const { default: Layout } = (await import(`@/app/[locale]/dashboard/${section}/layout`)) as {
        default: (props: { children: ReactNode; params: { locale: string } }) => Promise<ReactNode>
      }
      const props = { children: 'page', params: { locale: 'uk' } }

      currentEmail = PHOTOGRAPHER
      await assert.rejects(Layout(props), (error: unknown) => error instanceof Redirect && error.to === '/uk/dashboard')
      currentEmail = null
      await assert.rejects(Layout(props), (error: unknown) => error instanceof Redirect && error.to === '/uk/dashboard')

      currentEmail = OWNER
      assert.ok(await Layout(props))
      currentEmail = PHOTOGRAPHER
      await withFlag(true, async () => assert.ok(await Layout(props)))
    })
  }
})

describe('публічні /s/{handle}, /b/{handle}, /site-preview → 404, noindex', () => {
  for (const route of ['s/[handle]', 'b/[handle]', 'site-preview']) {
    test(`${route}: гість і фотограф — 404, власниця й прапорець — сторінка`, async () => {
      const mod = (await import(`@/app/[locale]/${route}/layout`)) as {
        default: (props: { children: ReactNode }) => Promise<ReactNode>
        generateMetadata: () => { robots?: { index?: boolean } }
      }
      const props = { children: 'page' }

      await assert.rejects(mod.default(props), NotFound)
      currentEmail = PHOTOGRAPHER
      await assert.rejects(mod.default(props), NotFound)
      assert.equal(mod.generateMetadata().robots?.index, false)

      currentEmail = OWNER
      assert.ok(await mod.default(props))
      currentEmail = null
      await withFlag(true, async () => {
        assert.ok(await mod.default(props))
        assert.equal(mod.generateMetadata().robots, undefined)
      })
    })
  }

  test('сторінка сайту не ставить index: true, поки сайти вимкнені; OG-картинка — 404', () => {
    assert.match(
      source('src/app/[locale]/s/[handle]/page.tsx'),
      /if \(!sitesEnabled\(\)\) return \{ robots: \{ index: false, follow: false \} \}/
    )
    assert.match(
      source('src/app/[locale]/s/[handle]/opengraph-image.tsx'),
      /if \(!sitesEnabled\(\)\) return new Response\('Not found', \{ status: 404 \}\)/
    )
  })
})

describe('API бронювання й лідів із сайту → 404', () => {
  const routes = [
    ['booking/book', 'POST'],
    ['booking/pay', 'POST'],
    ['sites/lead', 'POST'],
    ['booking/google/connect', 'GET'],
    ['booking/google/callback', 'GET'],
  ] as const

  for (const [path, method] of routes) {
    test(`${method} /api/${path}: 404 для гостя, далі — як раніше для власниці`, async () => {
      const mod = (await import(`@/app/api/${path}/route`)) as Record<string, (request: unknown) => Promise<Response>>
      const request = new Request(`http://localhost/api/${path}`, {
        method,
        ...(method === 'POST' ? { body: '{}', headers: { 'content-type': 'application/json' } } : {}),
      })
      Object.assign(request, { nextUrl: new URL(request.url) })
      const response = await mod[method](request)
      assert.equal(response.status, 404)
      // The gate is the first statement, so the owner's request reaches the old code.
      assert.match(
        source(`src/app/api/${path}/route.ts`),
        new RegExp(`export async function ${method}\\(request: NextRequest\\) \\{\\n  // Shelved[^\\n]*\\n  if \\(!\\(await viewerCanSeeSites\\(\\)\\)\\) return new NextResponse\\('Not found', \\{ status: 404 \\}\\)`)
      )
    })
  }

  test('вебхуки оплати не вимкнені: уже розпочаті платежі мають підтвердитися', () => {
    for (const provider of ['mono', 'wfp']) {
      assert.doesNotMatch(source(`src/app/api/booking/webhook/${provider}/route.ts`), /viewerCanSeeSites/)
    }
  })
})

describe('sitemap, головна кабінету, сповіщення', () => {
  test('sitemap без /s/, поки сайти вимкнені; /b/ там і не було', () => {
    const sitemap = source('src/app/sitemap.xml/route.ts')
    assert.match(sitemap, /async function publishedSites\(\): Promise<Entry\[\]> \{\n[^\n]*\n  if \(!sitesEnabled\(\)\) return \[\]/)
    assert.doesNotMatch(sitemap, /path: `\/uk\/b\//)
  })

  test('поки сайти вимкнені, /s/*, /b/* і /site-preview віддають X-Robots-Tag: noindex', () => {
    const config = source('next.config.js')
    assert.match(config, /if \(process\.env\.NEXT_PUBLIC_SITES_ENABLED !== '1'\) \{/)
    for (const path of ['/s/:path\\*', '/b/:path\\*', '/site-preview']) {
      assert.match(config, new RegExp(`\\$\\{locales\\}\\)${path}`), path)
    }
    assert.match(config, /key: 'X-Robots-Tag', value: 'noindex, nofollow'/)
  })

  test('robots не рекламує /s/ і /b/', () => {
    assert.doesNotMatch(source('src/app/robots.ts'), /\/s\/|\/b\//)
  })

  test('«Останні події від клієнтів» без бронювань, перемикач «бронювання» в сповіщеннях схований', () => {
    assert.match(source('src/app/[locale]/dashboard/page.tsx'), /recentClientEvents\(supabase, user\.id, galleries \?\? \[\], canSeeSites\(user\.email\)\)/)
    assert.match(source('src/app/[locale]/dashboard/settings/page.tsx'), /showBooking=\{canSeeSites\(user\.email\)\}/)
    assert.match(source('src/components/app/NotificationSettings.tsx'), /PUSH_KINDS\.filter\(\(kind\) => showBooking \|\| kind !== 'booking'\)/)
  })
})

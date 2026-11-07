import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Photographer's phone app (dashboard PWA) on the database-free test page
 * /uk/e2e/photographer-app (E2E_THEME_PREVIEW=1). API answers come from
 * page.route; push delivery itself is covered on the server with a mocked
 * push service (tests/audit-storage/push.test.ts).
 *
 * Runs on iPhone and Android (the desktop project checks only the manifest).
 */
const PAGE = '/uk/e2e/photographer-app'
const GALLERY_1 = '11111111-1111-4111-8111-111111111111'
const GALLERY_2 = '22222222-2222-4222-8222-222222222222'
const GALLERY_3 = '33333333-3333-4333-8333-333333333333'
const fixtures = path.join(__dirname, 'fixtures')

const phoneOnly = (name: string) => name === 'iphone' || name === 'android'

/** Answers /api/push/preferences like the real route (in memory). */
async function mockPreferences(page: Page) {
  const prefs = { client_picks: true, first_view: true, booking: true, storage_low: true, gallery_expiring: true }
  const puts: Record<string, boolean>[] = []
  await page.route('**/api/push/preferences', async (route) => {
    if (route.request().method() === 'PUT') {
      const patch = route.request().postDataJSON() as Record<string, boolean>
      puts.push(patch)
      Object.assign(prefs, patch)
    }
    await route.fulfill({ json: { preferences: prefs } })
  })
  return puts
}

/** Packs of the offline portfolio: real theme photos served by the dev server. */
async function mockPacks(page: Page) {
  await page.route('**/api/offline-pack/*', async (route) => {
    const id = route.request().url().split('/').pop()!
    const n = id === GALLERY_1 ? 4 : id === GALLERY_2 ? 3 : 2
    await route.fulfill({
      json: {
        id,
        title: id === GALLERY_1 ? 'Весілля Ані й Марка' : id === GALLERY_2 ? 'Сімейна прогулянка' : 'Інша',
        photos: Array.from({ length: n }, (_, i) => ({ url: `/themes/0${i + 1}-1080.webp`, width: 1080, height: 720 })),
      },
    })
  })
}

async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    // The offline screen must be precached before the network goes away.
    for (let i = 0; i < 50; i++) {
      const cache = await caches.open('proiav-app-shell-v1')
      if (await cache.match('/app/offline.html')) return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('offline page not precached')
  })
}

test.describe('застосунок фотографа: manifest', () => {
  test('окремий manifest кабінету: проЯв, іконки бренду, start_url /dashboard', async ({ page, request }) => {
    const response = await request.get('/dashboard.webmanifest')
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('application/manifest+json')
    const manifest = await response.json()
    expect(manifest).toMatchObject({ name: 'проЯв', short_name: 'проЯв', start_url: '/dashboard', display: 'standalone', id: '/dashboard' })
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) {
      const file = await request.get(icon.src)
      expect(file.ok(), icon.src).toBe(true)
    }
    const en = await (await request.get('/dashboard.webmanifest?lang=en')).json()
    expect(en.shortcuts[0].name).toBe('New gallery')

    // Dashboard <head>: this manifest (not the site's) and the iPhone icon.
    await page.goto(PAGE)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/dashboard.webmanifest?lang=uk')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/app/apple-touch-icon.png')
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'проЯв')
  })

  test('/dashboard відкривається мовою, якою фотограф користувався кабінетом', async ({ request, context, baseURL }) => {
    const plain = await request.get('/dashboard', { maxRedirects: 0 })
    expect(plain.headers().location).toMatch(/\/uk\/dashboard$/)
    await context.addCookies([{ name: 'dash_locale', value: 'en', url: baseURL! }])
    const en = await context.request.get('/dashboard', { maxRedirects: 0 })
    expect(en.headers().location).toMatch(/\/en\/dashboard$/)
  })

  test('service worker не перехоплює /api і завантаження', async ({ page }) => {
    await page.goto(PAGE)
    await swReady(page)
    await page.reload()
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    expect(controlled).toBe(true)
    // A request the SW answered carries no network timing of its own; ours must
    // reach the network (page.route sees it) with method and body intact.
    let seen: { method: string; body: string | null } | null = null
    await page.route('**/api/uploads/presign', async (route) => {
      seen = { method: route.request().method(), body: route.request().postData() }
      await route.fulfill({ json: { ok: true } })
    })
    await page.evaluate(() =>
      fetch('/api/uploads/presign', { method: 'POST', body: '{"x":1}', headers: { 'Content-Type': 'application/json' } })
    )
    expect(seen).toEqual({ method: 'POST', body: '{"x":1}' })
  })
})

test.describe('застосунок фотографа на телефоні', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!phoneOnly(testInfo.project.name), 'мобільні сценарії — iPhone і Android')
    await mockPreferences(page)
  })

  test('швидкі дії: великі кнопки, «Поділитися останньою», події від клієнтів', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __shared: unknown[] }).__shared = []
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: unknown) => {
          ;(window as unknown as { __shared: unknown[] }).__shared.push(data)
        },
      })
    })
    await page.goto(PAGE)
    const actions = page.getByTestId('quick-actions')
    const newGallery = actions.getByTestId('quick-new')
    await expect(newGallery).toHaveText(/Нова галерея/)
    await expect(newGallery).toHaveAttribute('href', '/uk/dashboard/galleries/new')
    // One-thumb sizes: tall, full width.
    const viewport = page.viewportSize()!
    for (const id of ['quick-new', 'quick-share', 'quick-offline']) {
      const box = (await actions.getByTestId(id).boundingBox())!
      expect(box.height, id).toBeGreaterThanOrEqual(56)
    }
    expect((await newGallery.boundingBox())!.width).toBeGreaterThan(viewport.width * 0.85)

    await actions.getByTestId('quick-share').click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
      .toEqual([{ title: 'Весілля Ані й Марка', url: 'http://localhost/uk/g/anya-marko' }])

    const events = page.getByTestId('client-event')
    await expect(events).toHaveCount(3)
    await expect(events.nth(0)).toContainText('«Весілля Ані й Марка»: 5 фото на ретуш')
    await expect(events.nth(0)).toContainText('3 хв тому')
    await expect(events.nth(1)).toContainText('24 фото в обраному')
    await expect(events.nth(2)).toContainText('Заявка: Олена, 14.11, 11:00')
    await expect(events.nth(2)).toHaveAttribute('href', '/uk/dashboard/booking')
  })

  test('встановлення: iPhone — інструкція через «Поділитися», Android — системний діалог', async ({ page }, testInfo) => {
    await page.goto(PAGE)
    const card = page.getByTestId('install-card')
    await expect(card).toBeVisible()
    if (testInfo.project.name === 'iphone') {
      await card.getByTestId('install-button').click()
      const steps = page.getByTestId('install-ios')
      await expect(steps).toContainText('Відкрийте кабінет у Safari')
      await expect(steps).toContainText('«Поділитися»')
      await expect(steps).toContainText('«На початковий екран»')
      await expect(steps).toContainText('iOS 16.4')
    } else {
      // Chrome on Android fires beforeinstallprompt; the button opens its dialog.
      await page.evaluate(() => {
        const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }
        ;(window as unknown as { __prompted: boolean }).__prompted = false
        event.prompt = async () => {
          ;(window as unknown as { __prompted: boolean }).__prompted = true
        }
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        window.dispatchEvent(event)
      })
      await card.getByTestId('install-button').click()
      await expect(card).toContainText('Застосунок встановлено')
      expect(await page.evaluate(() => (window as unknown as { __prompted: boolean }).__prompted)).toBe(true)
    }
  })

  test('сповіщення: підписка цього пристрою і кожен тип окремо', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['notifications'], { origin: baseURL })
    // Headless Chromium always says «denied» and has no push service: the
    // permission prompt and the subscription are stubs with the real shapes.
    await page.addInitScript(() => {
      const w = window as unknown as { __sub: unknown; __subscribeKey: number; __perm: NotificationPermission }
      w.__perm = 'default'
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => w.__perm })
      Notification.requestPermission = async () => {
        w.__perm = 'granted'
        return 'granted'
      }
      PushManager.prototype.subscribe = async function (options?: PushSubscriptionOptionsInit) {
        w.__subscribeKey = (options?.applicationServerKey as Uint8Array).byteLength
        const sub = {
          endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device-123456',
          toJSON: () => ({
            endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device-123456',
            keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
          }),
          unsubscribe: async () => true,
        }
        w.__sub = sub
        return sub as unknown as PushSubscription
      }
      PushManager.prototype.getSubscription = async function () {
        return (w.__sub ?? null) as PushSubscription | null
      }
    })
    const subscribed: unknown[] = []
    await page.route('**/api/push/subscribe', async (route) => {
      subscribed.push(route.request().postDataJSON())
      await route.fulfill({ json: { ok: true } })
    })
    const puts = await mockPreferences(page)
    await page.goto(PAGE)
    const block = page.getByTestId('notify-settings')
    await block.getByTestId('notify-enable').click()
    await expect(block.getByTestId('notify-on')).toBeVisible()
    expect(subscribed).toEqual([
      {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device-123456',
          keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
        },
        locale: 'uk',
      },
    ])
    // The VAPID key reached pushManager.subscribe as 65 raw bytes.
    expect(await page.evaluate(() => (window as unknown as { __subscribeKey: number }).__subscribeKey)).toBe(65)

    // Each type is its own switch, saved separately.
    const retouch = block.getByTestId('notify-pref-client_picks')
    await expect(retouch).toBeChecked()
    await block.getByText('Клієнт обрав фото або позначив ретуш').click()
    await expect(retouch).not.toBeChecked()
    await expect(block.getByTestId('notify-message')).toHaveText('Збережено')
    await block.getByText('Галерея скоро закриється').click()
    await expect(block.getByTestId('notify-pref-gallery_expiring')).not.toBeChecked()
    await expect(block.getByTestId('notify-pref-booking')).toBeChecked()
    expect(puts).toEqual([{ client_picks: false }, { gallery_expiring: false }])
  })

  test('сповіщення без дозволу / без бази: нічого не ламається', async ({ page, context, baseURL }, testInfo) => {
    await context.clearPermissions()
    if (testInfo.project.name === 'iphone') {
      // Safari outside the installed app has no PushManager.
      await page.addInitScript(() => {
        delete (window as unknown as { PushManager?: unknown }).PushManager
      })
    }
    await page.unroute('**/api/push/preferences')
    await page.route('**/api/push/preferences', (route) =>
      route.fulfill({ status: 503, json: { error: 'migration_required' } })
    )
    await page.goto(PAGE)
    const block = page.getByTestId('notify-settings')
    await expect(block).toContainText('Сповіщення запрацюють після оновлення бази.')
    if (testInfo.project.name === 'iphone') {
      await expect(block.getByTestId('notify-ios')).toContainText('встановіть застосунок на початковий екран')
      await expect(block.getByTestId('notify-enable')).toHaveCount(0)
    } else {
      // Headless Chromium answers «denied»: the button is off, the reason is shown.
      await expect(block.getByTestId('notify-enable')).toBeDisabled()
      await expect(block).toContainText('Браузер заборонив сповіщення')
    }
    await expect(block.getByTestId('notify-pref-booking')).toBeDisabled()
    // The rest of the page still works.
    await expect(page.getByTestId('quick-new')).toBeVisible()
    void baseURL
  })

  test('портфоліо офлайн: до 3 галерей на телефоні, показ без інтернету', async ({ page, context }) => {
    await mockPacks(page)
    await page.goto(PAGE)
    await swReady(page)
    const items = page.getByTestId('offline-item')

    await items.nth(0).getByTestId('offline-save').click()
    await expect(items.nth(0).getByTestId('offline-state')).toContainText('На телефоні · 4 фото')
    await items.nth(1).getByTestId('offline-save').click()
    await expect(items.nth(1).getByTestId('offline-state')).toContainText('На телефоні · 3 фото')
    await items.nth(2).getByTestId('offline-save').click()
    await expect(items.nth(2).getByTestId('offline-state')).toContainText('На телефоні · 2 фото')
    await expect(page.getByTestId('offline-count')).toHaveText('3 / 3')
    // The fourth does not fit until one is removed.
    await expect(items.nth(3).getByTestId('offline-save')).toBeDisabled()
    await expect(page.getByTestId('offline-portfolio')).toContainText('Уже збережено 3 галереї')
    await items.nth(2).getByTestId('offline-remove').click()
    await expect(page.getByTestId('offline-count')).toHaveText('2 / 3')
    await expect(items.nth(3).getByTestId('offline-save')).toBeEnabled()
    // Only previews are kept, never originals.
    const kept = await page.evaluate(async () => {
      const cache = await caches.open('proiav-portfolio-v1')
      return (await cache.keys()).map((r) => new URL(r.url).pathname).sort()
    })
    expect(kept.filter((key) => key.startsWith(`/__portfolio/${GALLERY_3}`))).toEqual([])
    expect(kept.filter((key) => key.startsWith(`/__portfolio/${GALLERY_1}/`))).toHaveLength(4)

    // No internet: the dashboard opens the offline screen with the saved galleries.
    await context.setOffline(true)
    await page.goto('/uk/dashboard')
    await expect(page.getByTestId('offline-status')).toContainText('Немає інтернету')
    await expect(page.getByTestId('offline-status')).toContainText('Спробувати знову')
    await expect(page.getByRole('link', { name: '← До кабінету' })).toBeHidden()
    const galleries = page.getByTestId('offline-gallery')
    await expect(galleries).toHaveCount(2)
    await expect(galleries.nth(0)).toContainText('Весілля Ані й Марка')
    await expect(galleries.nth(0)).toContainText('4 фото')
    await galleries.nth(0).click()
    const viewer = page.getByTestId('offline-viewer')
    await expect(viewer).toBeVisible()
    await expect(page.getByTestId('offline-counter')).toHaveText('1 / 4')
    const first = viewer.getByTestId('offline-photo').first()
    await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    // Swipe to the next photo.
    await viewer.locator('#strip').evaluate((strip) => strip.scrollTo({ left: strip.clientWidth, behavior: 'instant' as ScrollBehavior }))
    await expect(page.getByTestId('offline-counter')).toHaveText('2 / 4')
    await context.setOffline(false)
  })

  test('завантаження з телефона: HEIC з галереї, пауза без мережі й продовження', async ({ page, context }) => {
    const puts: string[] = []
    let completes = 0
    let offline = false
    await page.route('**/api/uploads/presign', async (route) => {
      const body = route.request().postDataJSON() as { fileName: string }
      await route.fulfill({ json: { uploadUrl: `/__e2e_storage/${encodeURIComponent(body.fileName)}`, key: `k/${body.fileName}` } })
    })
    await page.route('**/__e2e_storage/**', async (route) => {
      puts.push(route.request().url())
      await route.fulfill({ status: 200, body: '' })
    })
    await page.route('**/api/uploads/complete', async (route) => {
      completes += 1
      await route.fulfill({ json: { ok: true } })
    })
    // page.route answers even in offline mode: while «offline», cut the
    // requests off the way a suspended phone / lost network does. Registered
    // last, so it runs first.
    await page.route(/\/api\/uploads\/|\/__e2e_storage\//, (route) =>
      offline ? route.abort('internetdisconnected') : route.fallback()
    )
    await page.goto(PAGE)
    const uploader = page.getByTestId('uploader')
    const pick = uploader.getByTestId('upload-pick-phone')
    await expect(pick).toBeVisible()
    expect((await pick.boundingBox())!.height).toBeGreaterThanOrEqual(56)

    // The network is gone when the photos are picked (lift, tunnel, app switched).
    offline = true
    await context.setOffline(true)
    const chooser = page.waitForEvent('filechooser')
    await pick.click()
    await (await chooser).setFiles([path.join(fixtures, 'iphone.heic'), path.join(fixtures, 'canon-rotated.jpg')])
    await expect(uploader.getByTestId('upload-paused')).toBeVisible({ timeout: 30_000 })
    expect(completes).toBe(0)

    offline = false
    await context.setOffline(false)
    await expect(uploader.getByTestId('upload-paused')).toHaveCount(0, { timeout: 60_000 })
    await expect(uploader.locator('li')).toHaveCount(2)
    await expect(uploader.locator('li').filter({ hasText: '✓' })).toHaveCount(2, { timeout: 60_000 })
    expect(completes).toBe(2)
    expect(puts.some((url) => url.includes('iphone.heic'))).toBe(true)
  })
})

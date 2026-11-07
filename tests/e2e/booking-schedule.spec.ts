import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { encryptSecret, decryptSecret } from '../../src/lib/booking/secrets'
import { FAKE_USER_ID, newState, sessionCookie, startFakeSupabase, type FakeState } from './helpers/fake-supabase'

/**
 * «Бронювання» → «Створити слоти за шаблоном» on phones: real page, real
 * server actions, Supabase replaced by an in-memory fake (helpers/fake-supabase).
 * Set BOOKING_SCREENSHOTS=<dir> to also save desktop/phone screenshots.
 */
test.use({ locale: 'uk-UA', timezoneId: 'Europe/Kyiv' })

let server: Server
let state: FakeState

test.beforeAll(async () => {
  state = newState()
  server = await startFakeSupabase(state)
})
test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

async function openBooking(page: Page) {
  const cookie = sessionCookie()
  await page.context().addCookies([{ ...cookie, domain: 'localhost', path: '/' }])
  await page.goto('/uk/dashboard/booking')
  await expect(page.getByRole('heading', { name: 'Створити слоти за шаблоном' })).toBeVisible()
}

function reset(settings: Record<string, unknown> | null = null) {
  state.rpc = {}
  state.settingsWrites = []
  state.slots = []
  state.inserts = []
  state.settings = settings
}

const form = (page: Page) => page.getByTestId('slot-template')
const weekday = (page: Page, name: string) => form(page).locator('label', { hasText: new RegExp(`^${name}$`) })

test.describe('розклад: шаблон слотів на телефоні', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'сценарій для телефонів')
  })

  test('пн/ср/пт × 3 часи за два тижні → прев\'ю 18, одна вставка, без дублів при повторі', async ({ page }) => {
    reset({ user_id: FAKE_USER_ID, enabled: true, handle: 'olena', google_calendar_id: 'primary', google_refresh_token: null })
    await openBooking(page)

    await form(page).locator('input[name="from"]').fill('2027-03-01')
    await form(page).locator('input[name="to"]').fill('2027-03-14')
    // типово пн–пт: знімаємо вт і чт
    await weekday(page, 'Вт').click()
    await weekday(page, 'Чт').click()
    await form(page).locator('input[name="price"]').fill('2500')

    const preview = page.getByTestId('template-preview')
    await expect(preview).toContainText('Буде створено слотів: 18')

    // нічого не вилазить за екран
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    await form(page).getByRole('button', { name: 'Створити слоти (18)' }).click()
    await expect(form(page).getByRole('status')).toContainText('Готово, створено слотів: 18')
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toHaveLength(18)
    expect(state.inserts[0][0]).toMatchObject({ owner_id: FAKE_USER_ID, starts_at: '2027-03-01T10:00:00', duration_minutes: 60, price_uah: 2500 })

    // список згруповано по днях: 6 днів × 3 слоти
    await expect(page.getByTestId('slot-day')).toHaveCount(6)
    await expect(page.getByTestId('slot-row')).toHaveCount(18)

    // той самий шаблон удруге — 0 нових, 18 уже існують
    await expect(preview).toContainText('Буде створено слотів: 0')
    await expect(preview).toContainText('вже існують: 18')
    await expect(form(page).getByRole('button', { name: /Створити слоти/ })).toBeDisabled()
  })

  test('«Весь день» 10–18: один слот на суботу', async ({ page }) => {
    reset()
    await openBooking(page)
    await form(page).getByRole('tab', { name: 'Весь день' }).click()
    await form(page).locator('input[name="from"]').fill('2027-03-06')
    await form(page).locator('input[name="to"]').fill('2027-03-07')
    for (const d of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']) await weekday(page, d).click()
    await weekday(page, 'Сб').click()
    const times = form(page).locator('input[type="time"]')
    await times.nth(1).fill('18:00')
    await expect(page.getByTestId('template-preview')).toContainText('Буде створено слотів: 1')
    await form(page).getByRole('button', { name: 'Створити слоти (1)' }).click()
    await expect(page.getByTestId('slot-row')).toHaveCount(1)
    await expect(page.getByTestId('slot-row')).toContainText('10:00–18:00')
    expect(state.inserts[0][0]).toMatchObject({ starts_at: '2027-03-06T10:00:00', duration_minutes: 480 })
  })

  test('масове видалення: вибрати два вільні слоти → «Видалити вибрані»', async ({ page }) => {
    reset()
    state.slots = ['10:00', '13:00', '16:00'].map((t, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      owner_id: FAKE_USER_ID,
      starts_at: `2027-04-05T${t}:00`,
      duration_minutes: 60,
      price_uah: 1000,
      status: i === 2 ? 'booked' : 'free',
      client_name: i === 2 ? 'Ірина' : null,
      client_phone: i === 2 ? '+380671112233' : null,
      client_email: i === 2 ? 'iryna@example.com' : null,
    }))
    await openBooking(page)
    const rows = page.getByTestId('slot-row')
    await expect(rows).toHaveCount(3)
    await rows.nth(0).getByRole('checkbox').check()
    await rows.nth(1).getByRole('checkbox').check()
    await expect(rows.nth(2).getByRole('checkbox')).toHaveCount(0) // заброньований не вибирається
    page.once('dialog', (d) => d.accept())
    await page.getByTestId('bulk-bar').getByRole('button', { name: 'Видалити вибрані' }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Ірина')
  })
})

test('скріншоти розділу «Бронювання»', async ({ page }, testInfo) => {
  const dir = process.env.BOOKING_SCREENSHOTS
  test.skip(!dir || testInfo.project.name === 'android', 'лише за BOOKING_SCREENSHOTS, десктоп і iPhone')
  // Підключено до релізу 6 → банер «Перепідключіть календар».
  reset({ user_id: FAKE_USER_ID, enabled: true, handle: 'olena', google_calendar_id: 'primary', google_refresh_token: 'rt', google_email: 'olena@gmail.com' })
  const day = (d: number, t: string, extra: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    owner_id: FAKE_USER_ID,
    starts_at: `2026-11-${String(d).padStart(2, '0')}T${t}:00`,
    duration_minutes: 90,
    price_uah: 2500,
    status: 'free',
    client_name: null,
    client_phone: null,
    client_email: null,
    ...extra,
  })
  state.slots = [
    day(9, '10:00'), day(9, '13:00', { status: 'paid', client_name: 'Ірина К.', client_phone: '+380671112233', client_email: 'iryna@example.com' }), day(9, '16:00'),
    day(11, '10:00', { status: 'booked', client_name: 'Марко', client_phone: '+380501234567', client_email: 'marko@example.com' }), day(11, '13:00'), day(11, '16:00'),
    day(14, '10:00', { duration_minutes: 720, price_uah: 18000 }),
    day(16, '10:00'), day(16, '13:00'),
  ]
  await openBooking(page)
  await expect(page.getByTestId('google-reconnect')).toContainText('Перепідключіть календар, щоб враховувати зайнятість')
  mkdirSync(dir!, { recursive: true })
  const name = testInfo.project.name === 'desktop' ? 'booking-desktop' : 'booking-phone'
  await page.screenshot({ path: join(dir!, `${name}.png`), fullPage: true })
})

test.describe('«Забронювати зйомку» на сайті з темою «Тиша»', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'android', 'досить десктопа й iPhone')
  })
  function tysha(freeSlots: unknown[]) {
    reset({ user_id: FAKE_USER_ID, enabled: true, handle: 'olena', google_refresh_token: null, google_calendar_id: 'primary' })
    state.rpc = {
      get_site: [
        {
          theme: 'tysha',
          mode: 'light',
          display_name: 'Олена Романюк',
          logo_key: null,
          content: {
            hero: { title: 'Олена Романюк', subtitle: 'Весільна фотографія' },
            about: { text: 'Знімаю тихо.' },
            pricing: { items: [] },
            contact: { email: 'olena@example.com', phone: '', instagram: '', bookingUrl: '' },
            settings: { languages: [], leadForm: true, booking: true },
          },
        },
      ],
      get_site_portfolio: [],
      get_booking_profile: [
        { display_name: 'Олена Романюк', logo_key: null, has_mono: false, has_wfp: false, manual_link: null, card_details: '4441 0000 0000 0000' },
      ],
      get_free_slots: freeSlots,
    }
  }
  const bookLinks = (page: Page) => page.locator('a', { hasText: /Забронювати (дату|зйомку)/ })
  const bookDate = (page: Page) => page.locator('a', { hasText: 'Забронювати дату' })

  test('є вільні дати → кнопка веде на #booking, секція бронювання на сторінці', async ({ page }) => {
    tysha([{ id: '00000000-0000-4000-8000-0000000000aa', starts_at: '2027-05-15T10:00:00', duration_minutes: 720, price_uah: 18000 }])
    await page.goto('/uk/s/olena')
    // Головна кнопка «Тиші» (hero) і кнопка внизу — обидві на #booking.
    expect(await bookDate(page).count()).toBeGreaterThan(0)
    for (const href of await bookDate(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toBe('#booking')
    }
    await expect(bookLinks(page).first()).toHaveAttribute('href', '#booking')
    await expect(page.locator('section#booking')).toContainText('15.05.2027 · 10:00–22:00')
    // На телефоні частина посилань — у згорнутому меню; клікаємо видиму кнопку.
    await bookDate(page).locator('visible=true').first().click()
    await expect(page).toHaveURL(/#booking$/)
  })

  test('вільних дат немає → кнопка веде на форму заявки (#contact), секції бронювання немає', async ({ page }) => {
    tysha([])
    await page.goto('/uk/s/olena')
    for (const href of await bookDate(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toBe('#contact')
    }
    await expect(bookLinks(page).first()).toHaveAttribute('href', '#contact')
    await expect(page.locator('section#booking')).toHaveCount(0)
    await expect(page.locator('#contact form')).toBeVisible()
  })
})

test.describe('секрети оплати не потрапляють у браузер', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'android', 'досить десктопа й iPhone')
  })

  test('HTML кабінету: лише «••••1234», ні токена, ні шифротексту; порожнє поле не стирає; старий текст перешифровується', async ({ page }) => {
    // Next dev і цей тест без BOOKING_SECRETS_KEY → обидва беруть тестовий ключ.
    const monoPlain = 'mono-acquiring-SECRET-9876'
    const monoEnc = encryptSecret(monoPlain, 'mono_token')
    const legacyWfp = 'legacy-wfp-PLAINTEXT-4321'
    const googlePlain = '1//0google-refresh-SECRET'
    reset({
      user_id: FAKE_USER_ID,
      enabled: true,
      handle: 'olena',
      mono_enabled: true,
      mono_token: monoEnc,
      wfp_enabled: true,
      wfp_merchant: 'olena_studio',
      wfp_secret: legacyWfp,
      mono_personal_token: null,
      google_refresh_token: encryptSecret(googlePlain, 'google_refresh_token'),
      google_calendar_id: 'primary',
      google_email: 'olena@gmail.com',
    })

    const html = await (await page.context().request.get('/uk/dashboard/booking', {
      headers: { cookie: `${sessionCookie().name}=${sessionCookie().value}` },
    })).text()
    for (const leaked of [monoPlain, monoEnc, legacyWfp, googlePlain, 'enc:v1:']) {
      expect(html, `не має бути в HTML: ${leaked.slice(0, 12)}…`).not.toContain(leaked)
    }
    expect(html).toContain('••••9876')
    expect(html).toContain('••••4321')

    await openBooking(page)
    const settings = page.locator('details', { hasText: 'Налаштування бронювання й оплати' })
    if (!(await settings.getAttribute('open'))) await settings.locator('summary').click()
    await expect(page.getByTestId('secret-mono_token')).toContainText('••••9876')
    await expect(page.getByTestId('secret-mono_token').locator('input[name="mono_token"]')).toHaveValue('')

    // Зберегти, нічого не вводячи в поля секретів.
    await settings.getByRole('button', { name: 'Зберегти налаштування' }).click()
    await expect.poll(() => state.settingsWrites.length).toBeGreaterThan(0)
    const write = state.settingsWrites[0]
    expect(write).not.toHaveProperty('mono_token') // порожнє поле = не змінювати
    expect(write).not.toHaveProperty('mono_personal_token')
    expect(String(write.wfp_secret)).toMatch(/^enc:v1:/) // старий текст перешифровано
    expect(decryptSecret(String(write.wfp_secret), 'wfp_secret')).toBe(legacyWfp)
    expect(write).not.toHaveProperty('google_refresh_token') // уже зашифрований
  })
})

test.describe('погодинний крон звільнення броней', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'серверний сценарій — досить десктопа')
  })

  test('прострочена неоплачена бронь звільняється кроном і знову видна на /b', async ({ page, request }) => {
    reset({
      user_id: FAKE_USER_ID,
      enabled: true,
      handle: 'olena',
      unpaid_release_hours: 24,
      google_refresh_token: null,
      google_calendar_id: 'primary',
    })
    state.slots = [
      {
        id: '00000000-0000-4000-8000-0000000000c1',
        owner_id: FAKE_USER_ID,
        starts_at: '2027-05-10T10:00:00',
        duration_minutes: 60,
        price_uah: 2500,
        status: 'booked',
        booked_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
        client_name: 'Марко',
        client_phone: '+380501234567',
        client_email: 'marko@example.com',
        google_event_id: 'evt-stale',
      },
    ]

    await page.goto('/uk/b/olena')
    await expect(page.getByText('10.05.2027 · 10:00')).toHaveCount(0)

    expect((await request.get('/api/cron/booking-release')).status()).toBe(401)
    expect(
      (await request.get('/api/cron/booking-release', { headers: { authorization: 'Bearer wrong' } })).status()
    ).toBe(401)
    const res = await request.get('/api/cron/booking-release', {
      headers: { authorization: 'Bearer e2e-cron-secret' },
    })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, owners: 1, released: 1, eventsCleared: 1, errors: 0 })
    expect(state.slots[0]).toMatchObject({ status: 'free', client_name: null, google_event_id: null })

    await page.goto('/uk/b/olena')
    await expect(page.getByText('10.05.2027 · 10:00–11:00')).toBeVisible()
  })
})

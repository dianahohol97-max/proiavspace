/**
 * Підтримка (0069): форма «Допомога» в кабінеті й публічна /contact.
 *   - обробник: валідний запит, порожній текст, задовгий текст, поганий email,
 *     honeypot, ліміт 5 на IP за годину (памʼять і таблиця), чужі скриншоти;
 *   - доставка: лист на hello@ з Reply-To фотографа й темою «[Підтримка] …»,
 *     копія фотографу з Reply-To hello@; без таблиці (insert падає) лист
 *     однаково йде, помилка — в Sentry; якщо не вийшло ні те, ні те — 502;
 *   - маршрут POST /api/support цілком (залежності підмінені mock.module);
 *   - тексти в усіх мовах, підвали, міграція й реєстр у CLAUDE.md, і що на
 *     публічних галереях і сайтах фотографів підтримки проЯв немає.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { before, beforeEach, describe, mock, test } from 'node:test'
import type { EmailInput } from '@/lib/email'
import { footerLines, SUPPORT_EMAIL } from '@/lib/email-layout'
import { locales } from '@/lib/i18n/config'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { en } from '@/lib/i18n/dictionaries/en'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { de } from '@/lib/i18n/dictionaries/de'
import { es } from '@/lib/i18n/dictionaries/es'
import { fr } from '@/lib/i18n/dictionaries/fr'
import { it as itDict } from '@/lib/i18n/dictionaries/it'
import { ro } from '@/lib/i18n/dictionaries/ro'
import { pt } from '@/lib/i18n/dictionaries/pt'
import {
  presignSupportUploads,
  submitSupportRequest,
  type SupportCopy,
  type SupportDeps,
  type SupportRow,
  type SupportSender,
} from '@/lib/support/handler'
import { MemoryRateLimiter, hashIp } from '@/lib/support/rate-limit'

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const USER_ID = '11111111-2222-4333-8444-555555555555'
const ACCOUNT: SupportSender = { kind: 'account', userId: USER_ID, email: 'olena@example.com', plan: 'галереї: basic, сайт: free' }
const PUBLIC: SupportSender = { kind: 'public' }
const SHOT = `support/${USER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`

const COPY: SupportCopy = {
  copySubject: uk.support.copySubject,
  copyGreeting: uk.support.copyGreeting,
  copyLead: uk.support.copyLead,
  copyTopic: uk.support.copyTopic,
  copyMessage: uk.support.copyMessage,
  copyAfter: uk.support.copyAfter,
  topics: { bug: uk.support.topicBug, question: uk.support.topicQuestion, billing: uk.support.topicBilling, idea: uk.support.topicIdea },
}

interface Fake {
  deps: SupportDeps
  mails: EmailInput[]
  rows: SupportRow[]
  errors: { error: unknown; context: Record<string, unknown> }[]
  /** What countRecent returns (null = no table yet). */
  saved: number | null
  insertFails: boolean
  mailFails: boolean
  objects: Map<string, { sizeBytes: number; contentType: string | null }>
}

function fake(): Fake {
  const f: Fake = {
    mails: [],
    rows: [],
    errors: [],
    saved: 0,
    insertFails: false,
    mailFails: false,
    objects: new Map(),
    deps: null as unknown as SupportDeps,
  }
  f.deps = {
    limiter: new MemoryRateLimiter(),
    now: () => new Date('2026-11-08T10:00:00Z'),
    countRecent: async () => f.saved,
    head: async (key) => f.objects.get(key) ?? null,
    signReadUrl: async (key) => `https://b2.example/${key}?X-Amz-Expires=604800`,
    sendEmail: async (input) => {
      if (f.mailFails) return false
      f.mails.push(input)
      return true
    },
    insert: async (row) => {
      if (f.insertFails) return { error: { code: '42P01', message: 'relation "support_requests" does not exist' } }
      f.rows.push(row)
      return { error: null }
    },
    reportError: async (error, context) => {
      f.errors.push({ error, context })
    },
  }
  return f
}

const facts = (ip = '203.0.113.7') => ({ ip, locale: 'uk', copy: COPY, userAgentFromServer: 'UA/1.0' })
const valid = (extra: Record<string, unknown> = {}) => ({
  topic: 'bug',
  message: 'Не завантажуються фото в галерею «Весілля».\n\nПише «помилка».',
  context: { url: 'https://proiav.space/uk/dashboard', userAgent: 'Mozilla/5.0', language: 'uk', viewport: '1440×900', time: 'Sun Nov 08 2026' },
  ...extra,
})

describe('звернення з кабінету', () => {
  test('валідний запит: лист на hello@ з Reply-To фотографа, копія фотографу, рядок у таблиці', async () => {
    const f = fake()
    f.objects.set(SHOT, { sizeBytes: 300_000, contentType: 'image/png' })
    const res = await submitSupportRequest(valid({ attachments: [SHOT] }), ACCOUNT, facts(), f.deps)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { ok: true, email: 'olena@example.com' })

    assert.equal(f.mails.length, 2)
    const [inbox, copy] = f.mails
    assert.equal(inbox.to, SUPPORT_EMAIL)
    assert.equal(inbox.replyTo, 'olena@example.com')
    assert.equal(inbox.subject, '[Підтримка] Щось не працює — olena@example.com')
    for (const part of [inbox.text, inbox.html!]) {
      assert.match(part, new RegExp(USER_ID))
      assert.match(part, /галереї: basic/)
      assert.match(part, /proiav\.space\/uk\/dashboard/)
      assert.match(part, /1440×900/)
      assert.match(part, /X-Amz-Expires=604800/, 'підписане посилання на скриншот на 7 днів')
    }

    assert.equal(copy.to, 'olena@example.com')
    assert.equal(copy.replyTo, SUPPORT_EMAIL)
    assert.equal(copy.subject, uk.support.copySubject)
    assert.match(copy.text, /Не завантажуються фото/)

    assert.equal(f.rows.length, 1)
    const row = f.rows[0]
    assert.equal(row.user_id, USER_ID)
    assert.equal(row.topic, 'bug')
    assert.deepEqual(row.attachments, [{ key: SHOT, type: 'image/png', size: 300_000 }])
    assert.equal(row.context.plan, 'галереї: basic, сайт: free')
    assert.equal(row.context.ipHash, undefined, 'для кабінету IP не потрібен')
    assert.equal(f.errors.length, 0)
  })

  test('email, user_id і тариф беруться з акаунта, а не з форми', async () => {
    const f = fake()
    await submitSupportRequest(valid({ email: 'evil@example.com' }), ACCOUNT, facts(), f.deps)
    assert.equal(f.rows[0].email, 'olena@example.com')
    assert.equal(f.mails[0].replyTo, 'olena@example.com')
  })

  test('порожній текст → 400, нічого не надіслано', async () => {
    const f = fake()
    for (const message of ['', '   \n  ', undefined]) {
      const res = await submitSupportRequest(valid({ message }), ACCOUNT, facts(), f.deps)
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'empty_message')
    }
    assert.equal(f.mails.length + f.rows.length, 0)
  })

  test('текст понад 5000 символів і невідома тема → 400', async () => {
    const f = fake()
    assert.equal((await submitSupportRequest(valid({ message: 'а'.repeat(5001) }), ACCOUNT, facts(), f.deps)).body.error, 'message_too_long')
    assert.equal((await submitSupportRequest(valid({ message: 'а'.repeat(5000) }), ACCOUNT, facts(), f.deps)).status, 200)
    assert.equal((await submitSupportRequest(valid({ topic: 'spam' }), ACCOUNT, facts(), f.deps)).body.error, 'invalid_topic')
  })

  test('скриншоти: лише свої ключі, до 3, і те, що справді лежить у бакеті', async () => {
    const f = fake()
    const other = 'support/99999999-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png'
    const gallery = `u/${USER_ID}/g/x/o/photo.jpg`
    for (const key of [other, gallery, 'support/public/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png']) {
      assert.equal((await submitSupportRequest(valid({ attachments: [key] }), ACCOUNT, facts(), f.deps)).body.error, 'invalid_attachments')
    }
    const four = [0, 1, 2, 3].map((n) => `support/${USER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee${n}.png`)
    assert.equal((await submitSupportRequest(valid({ attachments: four }), ACCOUNT, facts(), f.deps)).body.error, 'invalid_attachments')
    // Not uploaded / too big / wrong type in the bucket.
    assert.equal((await submitSupportRequest(valid({ attachments: [SHOT] }), ACCOUNT, facts(), f.deps)).body.error, 'attachment_missing')
    f.objects.set(SHOT, { sizeBytes: 6 * 1024 * 1024, contentType: 'image/png' })
    assert.equal((await submitSupportRequest(valid({ attachments: [SHOT] }), ACCOUNT, facts(), f.deps)).body.error, 'attachment_invalid')
    f.objects.set(SHOT, { sizeBytes: 1000, contentType: 'text/html' })
    assert.equal((await submitSupportRequest(valid({ attachments: [SHOT] }), ACCOUNT, facts(), f.deps)).body.error, 'attachment_invalid')
    assert.equal(f.mails.length, 0)
  })

  test('без міграції 0069: insert падає → лист однаково йде, помилка в Sentry', async () => {
    const f = fake()
    f.insertFails = true
    f.saved = null
    const res = await submitSupportRequest(valid(), ACCOUNT, facts(), f.deps)
    assert.equal(res.status, 200)
    assert.equal(f.mails.length, 2)
    assert.equal(f.errors.length, 1)
    assert.equal(f.errors[0].context.where, 'support_requests insert')
  })

  test('лист не пішов, але рядок збережено → 200 і помилка в Sentry; не вийшло нічого → 502', async () => {
    const f = fake()
    f.mailFails = true
    assert.equal((await submitSupportRequest(valid(), ACCOUNT, facts(), f.deps)).status, 200)
    assert.equal(f.rows.length, 1)
    assert.ok(f.errors.some((e) => e.context.where === 'support email'))

    const g = fake()
    g.mailFails = true
    g.insertFails = true
    const res = await submitSupportRequest(valid(), ACCOUNT, facts(), g.deps)
    assert.equal(res.status, 502)
    assert.equal(res.body.error, 'not_delivered')
  })
})

describe('публічна форма /contact', () => {
  test('потрібен коректний email; IP не зберігається, лише хеш', async () => {
    const f = fake()
    for (const email of [undefined, '', 'olena', 'olena@', 'a b@c.d']) {
      assert.equal((await submitSupportRequest(valid({ email }), PUBLIC, facts(), f.deps)).body.error, 'invalid_email')
    }
    const res = await submitSupportRequest(valid({ email: ' guest@example.com ', topic: 'question' }), PUBLIC, facts(), f.deps)
    assert.equal(res.status, 200)
    assert.equal(f.mails[0].replyTo, 'guest@example.com')
    assert.equal(f.mails[0].subject, '[Підтримка] Питання — guest@example.com')
    assert.equal(f.rows[0].user_id, null)
    assert.equal(f.rows[0].context.ipHash, hashIp('203.0.113.7'))
    assert.ok(!JSON.stringify(f.rows[0]).includes('203.0.113.7'), 'сам IP ніде не зберігаємо')
  })

  test('honeypot заповнено → «успіх» для бота, але нічого не надіслано й не збережено', async () => {
    const f = fake()
    const res = await submitSupportRequest(valid({ email: 'bot@example.com', website: 'http://spam.example' }), PUBLIC, facts(), f.deps)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { ok: true })
    assert.equal(f.mails.length + f.rows.length, 0)
  })

  test('ліміт: 5 звернень з одного IP за годину, шосте → 429; інший IP — окремо', async () => {
    const f = fake()
    for (let i = 0; i < 5; i++) {
      assert.equal((await submitSupportRequest(valid({ email: 'g@example.com' }), PUBLIC, facts(), f.deps)).status, 200)
    }
    const sixth = await submitSupportRequest(valid({ email: 'g@example.com' }), PUBLIC, facts(), f.deps)
    assert.equal(sixth.status, 429)
    assert.equal(sixth.body.error, 'rate_limited')
    assert.equal((await submitSupportRequest(valid({ email: 'g@example.com' }), PUBLIC, facts('198.51.100.1'), f.deps)).status, 200)
  })

  test('ліміт рахує й збережені звернення (інші інстанси): 5 у таблиці → 429', async () => {
    const f = fake()
    f.saved = 5
    assert.equal((await submitSupportRequest(valid({ email: 'g@example.com' }), PUBLIC, facts(), f.deps)).status, 429)
    assert.equal(f.mails.length, 0)
  })
})

describe('завантаження скриншотів (presign)', () => {
  test('png/jpg/webp до 5 МБ, до 3 файлів; ключі у приватній теці support/<user_id>/', async () => {
    const limiter = new MemoryRateLimiter()
    const signed: [string, string, number][] = []
    const deps = { limiter, getUploadUrl: async (key: string, type: string, size: number) => (signed.push([key, type, size]), `https://b2/${key}`) }
    const ok = await presignSupportUploads(
      { files: [{ type: 'image/png', size: 10 }, { type: 'image/jpeg', size: 20 }, { type: 'image/webp', size: 30 }] },
      ACCOUNT,
      '1.1.1.1',
      deps
    )
    assert.equal(ok.status, 200)
    const keys = signed.map(([k]) => k)
    assert.match(keys[0], new RegExp(`^support/${USER_ID}/[0-9a-f-]{36}\\.png$`))
    assert.match(keys[1], /\.jpg$/)
    assert.match(keys[2], /\.webp$/)
    assert.deepEqual(signed.map(([, , s]) => s), [10, 20, 30], 'розмір підписаний у URL')

    const pub = await presignSupportUploads({ files: [{ type: 'image/png', size: 10 }] }, PUBLIC, '1.1.1.1', deps)
    assert.match((pub.body.uploads as { key: string }[])[0].key, /^support\/public\/[0-9a-f-]{36}\.png$/)

    const bad = (files: unknown) => presignSupportUploads({ files }, ACCOUNT, '1.1.1.1', deps).then((r) => r.body.error)
    assert.equal(await bad([{ type: 'image/gif', size: 10 }]), 'file_type')
    assert.equal(await bad([{ type: 'image/png', size: 5 * 1024 * 1024 + 1 }]), 'file_size')
    assert.equal(await bad([{ type: 'image/png', size: 0 }]), 'file_size')
    assert.equal(await bad(Array(4).fill({ type: 'image/png', size: 1 })), 'invalid_files')
    assert.equal(await bad([]), 'invalid_files')
  })
})

describe('маршрут POST /api/support', () => {
  let POST: (request: Request) => Promise<Response>
  let f: Fake
  let sender: SupportSender = PUBLIC

  before(async () => {
    const serverUrl = pathToFileURL(join(ROOT, 'src/lib/support/server.ts')).href
    mock.module(serverUrl, {
      namedExports: {
        currentSender: async () => sender,
        submitDeps: () => f.deps,
        supportCopy: async () => COPY,
        supportLocale: () => 'uk',
        uploadDeps: () => ({ limiter: new MemoryRateLimiter(), getUploadUrl: async () => 'https://b2/x' }),
      },
    })
    ;({ POST } = (await import('../../src/app/api/support/route')) as unknown as { POST: typeof POST })
  })

  beforeEach(() => {
    f = fake()
    sender = PUBLIC
  })

  const call = (body: unknown, ip = '192.0.2.10') =>
    POST(
      new Request('http://localhost/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1`, 'user-agent': 'Route/1' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    )

  test('валідний запит з кабінету → 200 і два листи', async () => {
    sender = ACCOUNT
    const res = await call(valid())
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true, email: 'olena@example.com' })
    assert.equal(f.mails.length, 2)
    assert.equal(f.rows[0].context.serverUserAgent, 'Route/1')
  })

  test('порожній текст → 400', async () => {
    const res = await call(valid({ message: '', email: 'g@example.com' }))
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, 'empty_message')
  })

  test('не JSON → 400', async () => {
    assert.equal((await call('{oops')).status, 400)
  })

  test('honeypot → 200 без листів', async () => {
    const res = await call(valid({ email: 'g@example.com', website: 'x' }))
    assert.equal(res.status, 200)
    assert.equal(f.mails.length, 0)
  })

  test('перевищення ліміту: шосте звернення з IP за годину → 429 (IP з x-forwarded-for)', async () => {
    const limiter = new MemoryRateLimiter()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      f = fake()
      f.deps.limiter = limiter
      statuses.push((await call(valid({ email: 'g@example.com' }), '192.0.2.99')).status)
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429])
  })
})

describe('тексти, підвали, міграція', () => {
  const dicts = { uk, en, pl, de, es, fr, it: itDict, ro, pt } as Record<string, { support?: Record<string, string> }>

  test('розділ support перекладено в усіх мовах словника, без пропусків', () => {
    const keys = Object.keys(uk.support)
    assert.deepEqual(Object.keys(dicts).sort(), [...locales].sort())
    for (const [lang, dict] of Object.entries(dicts)) {
      assert.ok(dict.support, `${lang}: немає розділу support`)
      for (const key of keys) {
        assert.ok(dict.support![key]?.trim(), `${lang}: немає support.${key}`)
      }
      assert.match(dict.support!.thanks, /\{email\}/, `${lang}: «Дякуємо» має містити {email}`)
    }
    assert.equal(uk.support.helpButton, 'Допомога')
    assert.equal(uk.support.thanks, 'Дякуємо! Відповімо на {email} протягом доби.')
  })

  test('у підвалі кожного листа — посилання на підтримку', () => {
    assert.ok(footerLines().some((l) => l.includes('https://proiav.space/uk/contact')))
  })

  test('посилання «Підтримка» в підвалі лендингу й маркетингових сторінок (там і тарифи)', () => {
    assert.match(source('src/app/[locale]/page.tsx'), /\/contact`\}[^]*t\.footer\.support/)
    assert.match(source('src/lib/seo/nav.ts'), /Підтримка', href: '\/uk\/contact'/)
    assert.match(source('src/components/marketing/SiteFooter.tsx'), /\/contact`/)
    assert.match(source('src/app/[locale]/tsiny/page.tsx'), /ProductPage/, 'тарифи рендеряться з SiteFooter')
  })

  test('на публічних галереях і сайтах фотографів підтримки проЯв немає', () => {
    const walk = (dir: string): string[] =>
      readdirSync(join(ROOT, dir)).flatMap((name) => {
        const path = join(dir, name)
        return statSync(join(ROOT, path)).isDirectory() ? walk(path) : [path]
      })
    const files = [
      ...walk('src/components/gallery'),
      ...walk('src/components/site'),
      ...walk('src/app/[locale]/g'),
      ...walk('src/app/[locale]/s'),
      ...walk('src/app/[locale]/b'),
    ].filter((p) => /\.(tsx?|css)$/.test(p))
    assert.ok(files.length > 10)
    for (const file of files) {
      const text = source(file)
      assert.ok(!/components\/support|\/contact[`'"]|hello@proiav\.space/.test(text), `${file} показує підтримку проЯв`)
    }
  })

  test('панель «Допомога» — у спільному layout кабінету (усі сторінки /dashboard) і в мобільному меню', () => {
    const layout = source('src/app/[locale]/dashboard/layout.tsx')
    assert.equal(layout.match(/<SupportButton /g)?.length, 2, 'бокове меню + мобільне меню')
    assert.match(layout, /<SupportPanel/)
    assert.match(source('src/components/dashboard/MobileMenu.tsx'), /SUPPORT_OPEN_EVENT/)
    assert.match(source('src/components/support/SupportPanel.tsx'), /mailto:\$\{SUPPORT_MAILTO\}/)
  })

  test('міграція 0069: таблиця, RLS (insert лише service role, select — свої), реєстр у CLAUDE.md', () => {
    const sql = source('supabase/migrations/0069_support_requests.sql')
    assert.match(sql, /create table if not exists public\.support_requests/)
    assert.match(sql, /user_id uuid references auth\.users \(id\) on delete set null/)
    assert.match(sql, /status text not null default 'new' check \(status in \('new', 'answered', 'closed'\)\)/)
    assert.match(sql, /enable row level security/)
    assert.match(sql, /revoke all on table public\.support_requests from anon, authenticated/)
    assert.match(sql, /grant select on table public\.support_requests to authenticated/)
    assert.doesNotMatch(sql, /for insert|grant insert/i)
    assert.match(sql, /using \(user_id = \(select auth\.uid\(\)\)\)/)
    const registry = source('CLAUDE.md')
    assert.match(registry, /`0069` — підтримка/)
    // Після 0069 номери беруть інші гілки (0070 — перемикач завантажень), тож
    // перевіряємо лише, що наступний вільний уже за 0069.
    const next = Number(registry.match(/наступний вільний номер — `(\d{4})`/)?.[1])
    assert.ok(next > 69, `наступний вільний номер: ${next}`)
  })
})

/**
 * Блоки 1.2–1.4, 2.3 і таблиця «обіцяно / робить код»: тарифи з plans.ts,
 * ефективний тариф після grace, і тексти, що розходяться з кодом.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { GALLERY_PLANS, GRACE_PERIOD_DAYS, effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { IMPORT_PROMO, isPromoRunning } from '@/lib/promo'
import { geminiModel } from '@/lib/gemini'

const ROOT = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
const srcFiles = walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))

describe('тарифи (plans.ts — єдине джерело)', () => {
  test('ціни й обсяги платних тарифів відповідають брифу', () => {
    assert.deepEqual(
      Object.values(GALLERY_PLANS).map((p) => [p.id, p.storageGb, p.priceUahMonth]),
      [
        ['free', GALLERY_PLANS.free.storageGb, 0],
        ['basic', 100, 129],
        ['plus', 500, 519],
        ['pro', 1024, 899],
      ]
    )
  })

  test('річна = 10 місяців (2 в подарунок)', () => {
    for (const plan of Object.values(GALLERY_PLANS)) {
      assert.equal(plan.priceUahYear, plan.priceUahMonth * 10, plan.id)
    }
  })

  test('CP-03: Free = 3 ГБ скрізь (рішення 26.09) — plans.ts, дефолт БД і захардкоджені тексти', () => {
    assert.equal(GALLERY_PLANS.free.storageGb, 3)
    assert.match(source('supabase/migrations/0001_phase1_galleries.sql'), /default 3221225472/)
    // Місця, де «3 ГБ» прописано текстом, а не з plans.ts — мають збігатися.
    for (const f of ['src/app/[locale]/page.tsx', 'src/lib/landing/copy.ts', 'src/lib/blog/linking.ts']) {
      assert.match(source(f), /3 (ГБ|GB)/, f)
      assert.equal(/4 (ГБ|GB)/.test(source(f)), false, f)
    }
  })

  test('відео: Free — ні, Базовий/Плюс/Максимальний — так', () => {
    assert.deepEqual(
      Object.values(GALLERY_PLANS).map((p) => [p.id, p.features.video]),
      [
        ['free', false],
        ['basic', true],
        ['plus', true],
        ['pro', true],
      ]
    )
  })
})

describe('життєвий цикл тарифу (effectiveGalleryPlan)', () => {
  const day = 24 * 3600 * 1000
  test('grace у майбутньому → платний тариф діє', () => {
    const plan = effectiveGalleryPlan('plus', new Date(Date.now() + day).toISOString())
    assert.equal(plan.id, 'plus')
  })
  test('grace минув → поводиться як Free (ліміт 3 ГБ, без відео, з бейджем)', () => {
    const plan = effectiveGalleryPlan('pro', new Date(Date.now() - 1000).toISOString())
    assert.equal(plan.id, 'free')
    assert.equal(planStorageBytes(plan), GALLERY_PLANS.free.storageGb * 1024 ** 3)
  })
  test('grace_until = null → тариф безстроковий (автопродовження)', () => {
    assert.equal(effectiveGalleryPlan('basic', null).id, 'basic')
  })
  test('невідомий id тарифу (наприклад старий «start») → Free', () => {
    assert.equal(effectiveGalleryPlan('start', null).id, 'free')
  })
  test('grace після скасування/невдалого списання — 7 днів', () => {
    assert.equal(GRACE_PERIOD_DAYS, 7)
  })
  test('промо: «перші 30 або до 31.12.2026 (Київ)», нагадування за 7 днів', () => {
    assert.equal(IMPORT_PROMO.maxGrants, 30)
    assert.equal(new Date(IMPORT_PROMO.deadline).toISOString(), '2026-12-31T22:00:00.000Z')
    assert.equal(IMPORT_PROMO.plan.id, 'basic')
    assert.equal(isPromoRunning({ ends_at: new Date(Date.now() + day).toISOString(), autopay_at: null }), true)
    assert.equal(isPromoRunning({ ends_at: new Date(Date.now() - day).toISOString(), autopay_at: null }), false)
  })

  test('ST-02/ST-03: крон прибирання сиріт і незавершених multipart у vercel.json', () => {
    const vercel = JSON.parse(source('vercel.json')) as { crons?: { path: string }[] }
    const paths = (vercel.crons ?? []).map((c) => c.path)
    assert.ok(paths.includes('/api/cron/storage-cleanup'), paths.join(', '))
    assert.ok(paths.length <= 2, 'Vercel Hobby дозволяє не більше 2 cron-задач')
  })

  test('[LC-01] є крон retention, що видаляє файли акаунтів після закінчення тарифу', () => {
    const vercel = JSON.parse(source('vercel.json')) as { crons?: { path: string }[] }
    const paths = (vercel.crons ?? []).map((c) => c.path)
    assert.ok(
      paths.some((p) => /retention/i.test(p)),
      `крони: ${paths.join(', ')} — жоден не видаляє файли неплатників; політика 14 + 60 днів ще не реалізована (PR 2)`
    )
  })
})

describe('залишки старої логіки й тексти, що розходяться з кодом', () => {
  test('назви «Старт»/«Start» як тарифу ніде немає', () => {
    const hits = srcFiles.filter((f) => /['"«]Старт['"»]|plan[^\n]{0,20}['"]start['"]/.test(readFileSync(f, 'utf8')))
    assert.deepEqual(hits.map((f) => relative(ROOT, f)), [])
  })

  test('CP-01: тексти про відео не обмежують його Плюсом і Максимальним', () => {
    const pages = source('src/lib/landing/product-pages.ts')
    const stale = pages
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /(video|[Вв]ідео|тизер)/.test(line) && /Плюс і Максимальн/.test(line))
      .map(([n]) => `product-pages.ts:${n}`)
    assert.deepEqual(stale, [], 'сайт каже «відео з Плюс», код дає відео з Базового')
  })

  test('CP-02: сторінка оплати Monobank не показує стару назву «Про» і «1024 ГБ»', () => {
    const checkout = source('src/app/api/billing/checkout/route.ts')
    assert.equal(/pro:\s*'Про'/.test(checkout), false, "planNameUk: pro: 'Про' замість «Максимальний»")
    assert.match(checkout, /pro:\s*'Максимальний'/)
    assert.equal(/\$\{plan\.storageGb\} ГБ/.test(checkout), false, '«1024 ГБ» замість «1 ТБ»')
  })

  test('GM-01: назва моделі Gemini лише з env — без захардкодженого дефолту ніде', () => {
    const offenders = [...srcFiles, join(ROOT, '.github/workflows/blog-generate.yml'), join(ROOT, 'scripts/blog.ts')]
      .filter((f) => /['"`]gemini-\d/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
    assert.deepEqual(offenders, [])
    const saved = process.env.GEMINI_MODEL
    try {
      process.env.GEMINI_MODEL = 'gemini-test'
      assert.equal(geminiModel(), 'gemini-test')
      delete process.env.GEMINI_MODEL
      assert.throws(() => geminiModel(), /GEMINI_MODEL is not set/)
    } finally {
      if (saved !== undefined) process.env.GEMINI_MODEL = saved
    }
    assert.match(source('.env.example'), /^GEMINI_MODEL=/m)
  })

  test('Resend ніде не лишився (код, залежності, env-приклад, доки)', () => {
    const files = [
      'package.json',
      'package-lock.json',
      '.env.example',
      'README.md',
      'LAUNCH.md',
      'MANUAL_TASKS.md',
      'AUTOMATION_SETUP.md',
    ]
    const hits = [...files.map((f) => join(ROOT, f)), ...srcFiles].filter((f) =>
      /resend/i.test(readFileSync(f, 'utf8'))
    )
    assert.deepEqual(hits.map((f) => relative(ROOT, f)), [])
  })

  test('[EM-01] є шлях скидання пароля (resetPasswordForEmail)', () => {
    const hits = srcFiles.filter((f) => /resetPasswordForEmail/.test(readFileSync(f, 'utf8')))
    assert.ok(hits.length > 0, 'вхід паролем є, «Забули пароль?» — нема')
  })
})

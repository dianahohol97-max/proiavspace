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

  test('[CP-03] Free = 4 ГБ, як у брифі (у коді, на сайті і в БД зараз 3 ГБ)', () => {
    assert.equal(GALLERY_PLANS.free.storageGb, 4)
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

  test('[LC-01] є крон, що прибирає файли акаунтів без оплати / сироти в B2', () => {
    const vercel = JSON.parse(source('vercel.json')) as { crons?: { path: string }[] }
    const paths = (vercel.crons ?? []).map((c) => c.path)
    assert.ok(
      paths.some((p) => /storage|retention|cleanup|orphan|purge/i.test(p)),
      `крони: ${paths.join(', ')} — жоден не видаляє файли з B2; неоплачені акаунти зберігаються безстроково`
    )
  })
})

describe('залишки старої логіки й тексти, що розходяться з кодом', () => {
  test('назви «Старт»/«Start» як тарифу ніде немає', () => {
    const hits = srcFiles.filter((f) => /['"«]Старт['"»]|plan[^\n]{0,20}['"]start['"]/.test(readFileSync(f, 'utf8')))
    assert.deepEqual(hits.map((f) => relative(ROOT, f)), [])
  })

  test('[CP-01] тексти про відео не обмежують його Плюсом і Максимальним', () => {
    const pages = source('src/lib/landing/product-pages.ts')
    const stale = pages
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /(video|[Вв]ідео|тизер)/.test(line) && /Плюс і Максимальн/.test(line))
      .map(([n]) => `product-pages.ts:${n}`)
    assert.deepEqual(stale, [], 'сайт каже «відео з Плюс», код дає відео з Базового')
  })

  test('[CP-02] сторінка оплати Monobank не показує стару назву «Про» і «1024 ГБ»', () => {
    const checkout = source('src/app/api/billing/checkout/route.ts')
    assert.equal(/pro:\s*'Про'/.test(checkout), false, "planNameUk: pro: 'Про' замість «Максимальний»")
  })

  test('GEMINI_MODEL: усі виклики Gemini читають одну змінну через lib/gemini.ts', () => {
    const offenders = srcFiles
      .filter((f) => !f.endsWith(join('lib', 'gemini.ts')))
      .filter((f) => /['"`]gemini-\d/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
    assert.deepEqual(offenders, [])
    assert.match(source('src/lib/gemini.ts'), /process\.env\.GEMINI_MODEL \|\| '/)
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

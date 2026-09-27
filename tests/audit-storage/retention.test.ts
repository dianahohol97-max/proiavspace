/**
 * PR 2 — життєвий цикл тарифу (LC-01): кожен стан акаунта й наступний крок
 * крону /api/cron/storage-retention. Чисті правила з src/lib/retention.ts,
 * без БД; інтеграційний прохід крону — tests/lifecycle (npm run test:referrals).
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DAY_MS,
  FREE_LIMIT_BYTES,
  RETENTION_DAYS,
  planRetention,
  type RetentionAccount,
  type SentNotices,
} from '@/lib/retention'

const NOW = Date.parse('2026-10-01T06:00:00Z')
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY_MS).toISOString()
const OVER = FREE_LIMIT_BYTES + 1
const acc = (over: Partial<RetentionAccount> = {}): RetentionAccount => ({
  userId: 'u',
  plan: 'basic',
  graceUntil: null,
  galleryClosedAt: null,
  storageUsedBytes: OVER,
  ...over,
})
const plan = (a: RetentionAccount, n: SentNotices = {}, now = NOW) => planRetention(a, n, now)
const types = (a: RetentionAccount, n: SentNotices = {}, now = NOW) =>
  plan(a, n, now).actions.map((x) => (x.type === 'notify' ? `notify:${x.kind}` : x.type))

describe('стани, де нічого не відбувається', () => {
  test('Free без закриття — без строку, лише ліміт', () => {
    assert.equal(plan(acc({ plan: 'free', storageUsedBytes: 10 })).state, 'free')
    assert.deepEqual(types(acc({ plan: 'free', storageUsedBytes: OVER })), [])
  })

  test('платний з автопродовженням (grace_until = null)', () => {
    assert.equal(plan(acc({ graceUntil: null })).state, 'paid')
    assert.deepEqual(types(acc()), [])
  })

  test('оплачений період ще триває (до кінця > 14 днів запасу)', () => {
    assert.deepEqual(types(acc({ graceUntil: iso(20) })), [])
    assert.equal(plan(acc({ graceUntil: iso(20) })).state, 'paid')
  })
})

describe('початок grace (лист 3)', () => {
  test('період закінчився, понад Free → лист «14 днів усе працює», закриття через 14 днів', () => {
    const p = plan(acc({ graceUntil: iso(14) }))
    assert.equal(p.state, 'grace')
    assert.deepEqual(types(acc({ graceUntil: iso(14) })), ['notify:grace_start'])
    assert.equal(p.closesAt?.toISOString(), iso(14))
  })

  test('лист уже надіслано → чекаємо, нічого не робимо', () => {
    const n = { grace_start: iso(-3) }
    assert.deepEqual(types(acc({ graceUntil: iso(11) }), n), [])
  })

  test('вміщається в Free → жодного листа, в кінці просто стає Free', () => {
    assert.deepEqual(types(acc({ graceUntil: iso(5), storageUsedBytes: FREE_LIMIT_BYTES })), [])
    assert.deepEqual(types(acc({ graceUntil: iso(-1), storageUsedBytes: 100 })), ['normalize'])
  })

  test('невдале списання вже надіслало свій лист → лист 3 не дублюється', () => {
    assert.deepEqual(types(acc({ graceUntil: iso(14) }), { failed_charge: iso(0) }), [])
  })
})

describe('закриття галерей (лист 4)', () => {
  test('grace минув, лист 3 був ≥ 14 днів тому → лист 4 і закриття', () => {
    const p = plan(acc({ graceUntil: iso(0) }), { grace_start: iso(-14) })
    assert.equal(p.state, 'closing')
    assert.deepEqual(p.actions.map((a) => a.type), ['close'])
    const close = p.actions[0] as { deletesAt: Date }
    assert.equal(close.deletesAt.toISOString(), iso(RETENTION_DAYS))
  })

  test('акаунт, що «прострочився» ще до політики: спершу лист 3, закриття лише через 14 днів після нього', () => {
    const legacy = acc({ graceUntil: iso(-200) })
    assert.deepEqual(types(legacy), ['notify:grace_start'])
    assert.equal(plan(legacy).closesAt?.toISOString(), iso(14))
    assert.deepEqual(types(legacy, { grace_start: iso(-13) }), [])
    assert.deepEqual(types(legacy, { grace_start: iso(-14) }), ['close'])
  })

  test('закрито, але фотограф прибрав файли до ≤ 3 ГБ → стає Free, галереї відкриваються', () => {
    assert.deepEqual(types(acc({ graceUntil: iso(-20), galleryClosedAt: iso(-5), storageUsedBytes: 5 })), ['normalize'])
  })
})

describe('нагадування перед видаленням (лист 5)', () => {
  const closed = (daysAgo: number) => acc({ graceUntil: iso(-daysAgo - 1), galleryClosedAt: iso(-daysAgo) })

  test('за 30 / 7 / 1 день — по одному листу', () => {
    assert.deepEqual(types(closed(29)), [])
    assert.deepEqual(types(closed(30)), ['notify:delete_30'])
    assert.deepEqual(types(closed(53), { delete_30: iso(-23) }), ['notify:delete_7'])
    assert.deepEqual(types(closed(59), { delete_30: iso(-29), delete_7: iso(-6) }), ['notify:delete_1'])
  })

  test('крон пропустив дні → лише найпізніший лист, ранні позначаються без відправки', () => {
    const p = plan(closed(59.5))
    assert.deepEqual(p.actions.map((a) => (a.type === 'notify' ? a.kind : a.type)), ['delete_1'])
    assert.deepEqual((p.actions[0] as { alsoMark: string[] }).alsoMark, ['delete_30', 'delete_7'])
  })
})

describe('видалення', () => {
  const all = (lastAgoHours: number): SentNotices => ({
    grace_start: iso(-75),
    closed: iso(-60),
    delete_30: iso(-30),
    delete_7: iso(-7),
    delete_1: new Date(NOW - lastAgoHours * 3600 * 1000).toISOString(),
  })
  const due = acc({ graceUntil: iso(-61), galleryClosedAt: iso(-60) })

  test('60 днів після закриття і «завтра»-лист був ≥ 20 год тому → видалити', () => {
    assert.deepEqual(types(due, all(24)), ['delete'])
    assert.equal(plan(due, all(24)).state, 'deleting')
  })

  test('без листа «завтра» — не видаляємо ніколи', () => {
    const n = all(24)
    delete n.delete_1
    assert.deepEqual(types(due, n), ['notify:delete_1'])
  })

  test('«завтра»-лист пішов щойно (крон наздоганяв) → видалення переноситься', () => {
    assert.deepEqual(types(due, all(2)), [])
  })

  test('до дати видалення — ні, навіть з усіма листами', () => {
    assert.deepEqual(types(acc({ graceUntil: iso(-60), galleryClosedAt: iso(-59) }), all(24)), [])
  })
})

describe('повернення до оплати', () => {
  test('оплатив після закриття → reopen, нічого не видаляється', () => {
    const paid = acc({ graceUntil: null, galleryClosedAt: iso(-10) })
    assert.deepEqual(types(paid), ['reopen'])
    const paidNoRenew = acc({ graceUntil: iso(40), galleryClosedAt: iso(-10) })
    assert.deepEqual(types(paidNoRenew), ['reopen'])
  })

  test('новий промо (grace в майбутньому) теж відкриває', () => {
    assert.deepEqual(types(acc({ plan: 'basic', graceUntil: iso(44), galleryClosedAt: iso(-3) })), ['reopen'])
  })
})

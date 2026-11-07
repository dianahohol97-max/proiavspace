/**
 * AI-відбір кадрів (етап 3): чисті функції, що працюють у Web Worker —
 * різкість (варіація Лапласіана), dHash, групування серій і правила позначок.
 * Зображення синтетичні й детерміновані (сід PRNG), тож тести стабільні.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import { laplacianVariance, sharpness, toGray } from '@/lib/culling/sharpness'
import { dHash, hamming } from '@/lib/culling/dhash'
import { groupSeries } from '@/lib/culling/series'
import { computeVerdicts, hasClosedEyes } from '@/lib/culling/verdict'
import type { CullingPhoto, PhotoAnalysis } from '@/lib/culling/types'
import { diffRows, rowsFromState, stateFromRows } from '@/lib/culling/remote'
import { FACE_MODEL_URL, MEDIAPIPE_VERSION, MEDIAPIPE_WASM_BINARY, MEDIAPIPE_WASM_LOADER } from '@/lib/culling/config'

const W = 256
const H = 192

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A "scene": soft gradients + random rectangles with hard edges + fine noise. */
function scene(seed: number, width = W, height = H): Float32Array {
  const r = rng(seed)
  const g = new Float32Array(width * height)
  const gx = r() * 2 - 1
  const gy = r() * 2 - 1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) g[y * width + x] = 128 + 50 * (gx * (x / width) + gy * (y / height))
  for (let k = 0; k < 40; k++) {
    const x0 = Math.floor(r() * width)
    const y0 = Math.floor(r() * height)
    const w = 4 + Math.floor(r() * width * 0.3)
    const h = 4 + Math.floor(r() * height * 0.3)
    const v = r() * 255
    for (let y = y0; y < Math.min(height, y0 + h); y++) for (let x = x0; x < Math.min(width, x0 + w); x++) g[y * width + x] = v
  }
  for (let i = 0; i < g.length; i++) g[i] = Math.min(255, Math.max(0, g[i] + (r() - 0.5) * 12))
  return g
}

/** Separable box blur, repeated (≈ Gaussian). */
function blur(src: Float32Array, radius: number, passes = 3, width = W, height = H): Float32Array {
  let a = Float32Array.from(src)
  let b = new Float32Array(a.length)
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0
        let n = 0
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.min(width - 1, Math.max(0, x + k))
          s += a[y * width + xx]
          n++
        }
        b[y * width + x] = s / n
      }
    }
    ;[a, b] = [b, a]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0
        let n = 0
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.min(height - 1, Math.max(0, y + k))
          s += a[yy * width + x]
          n++
        }
        b[y * width + x] = s / n
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}

/** Shift right/down by d pixels (edge-clamped) — a tiny camera move in a burst. */
function shift(src: Float32Array, d: number): Float32Array {
  const out = new Float32Array(src.length)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = src[Math.max(0, y - d) * W + Math.max(0, x - d)]
  return out
}

describe('Різкість: варіація Лапласіана', () => {
  test('різке синтетичне зображення має значно вищу оцінку за розмите', () => {
    const sharp = scene(1)
    const soft = blur(sharp, 2)
    const verySoft = blur(sharp, 5)
    const s = laplacianVariance(sharp, W, H)
    const m = laplacianVariance(soft, W, H)
    const v = laplacianVariance(verySoft, W, H)
    assert.ok(s > m * 5, `різке ${s.toFixed(1)} vs розмите ${m.toFixed(1)}`)
    assert.ok(m > v, 'сильніше розмиття — ще нижча оцінка')
    assert.ok(sharpness(sharp, W, H).score > sharpness(soft, W, H).score * 5)
  })

  test('плоский кадр (небо, стіна) — нуль, без NaN', () => {
    const flat = new Float32Array(W * H).fill(120)
    assert.equal(laplacianVariance(flat, W, H), 0)
    assert.equal(sharpness(flat, W, H).score, 0)
  })

  test('боке: різкий обʼєкт на розмитому тлі оцінюється як різкий, а не як брак', () => {
    const sharp = scene(7)
    const background = blur(sharp, 6)
    const bokeh = Float32Array.from(background)
    // A crisp subject in one quarter of the frame.
    for (let y = 48; y < 144; y++) for (let x = 64; x < 160; x++) bokeh[y * W + x] = sharp[y * W + x]
    const missedFocus = blur(sharp, 2)
    const bokehScore = sharpness(bokeh, W, H).score
    const missedScore = sharpness(missedFocus, W, H).score
    assert.ok(bokehScore > missedScore * 3, `боке ${bokehScore.toFixed(1)} vs промах ${missedScore.toFixed(1)}`)
    // The global variance alone would rank the bokeh frame much lower than its tiles do.
    assert.ok(sharpness(bokeh, W, H).global < bokehScore)
  })

  test('toGray: RGBA → яскравість за Rec.601', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
    const g = toGray(rgba, 4, 1)
    assert.deepEqual([...g].map((v) => Math.round(v)), [76, 150, 29, 255])
  })
})

describe('dHash', () => {
  test('однакові зображення — однаковий хеш (відстань 0), 16 hex-символів', () => {
    const a = scene(3)
    assert.equal(dHash(a, W, H), dHash(Float32Array.from(a), W, H))
    assert.match(dHash(a, W, H), /^[0-9a-f]{16}$/)
    assert.equal(hamming(dHash(a, W, H), dHash(a, W, H)), 0)
  })

  test('схожі (шум, яскравість, зсув на 2 px, легке розмиття) — мала відстань', () => {
    const a = scene(3)
    const r = rng(99)
    const noisy = a.map((v) => Math.min(255, Math.max(0, v + (r() - 0.5) * 16)))
    const brighter = a.map((v) => Math.min(255, v * 1.1 + 8))
    const h = dHash(a, W, H)
    for (const [name, img] of [
      ['шум', noisy],
      ['яскравість', brighter],
      ['зсув', shift(a, 2)],
      ['розмиття', blur(a, 1)],
    ] as const) {
      const d = hamming(h, dHash(img, W, H))
      assert.ok(d <= 10, `${name}: відстань ${d}`)
    }
  })

  test('різні сцени — велика відстань', () => {
    const distances = [
      [3, 4],
      [5, 6],
      [10, 20],
    ].map(([x, y]) => hamming(dHash(scene(x), W, H), dHash(scene(y), W, H)))
    for (const d of distances) assert.ok(d >= 18, `відстань ${d}`)
  })

  test('hamming: окремі біти й різна довжина', () => {
    assert.equal(hamming('0000000000000000', '0000000000000001'), 1)
    assert.equal(hamming('ffffffffffffffff', '0000000000000000'), 64)
    assert.equal(hamming('ff', '0000000000000000'), 64)
  })
})

describe('Групування серій', () => {
  const h = (seed: number, variant = 0) => dHash(variant ? shift(scene(seed), variant) : scene(seed), W, H)

  test('сусідні схожі кадри — одна серія, різні сцени — окремо', () => {
    const items = [
      { id: 'a1', order: 0, hash: h(1) },
      { id: 'a2', order: 1, hash: h(1, 1) },
      { id: 'a3', order: 2, hash: h(1, 2) },
      { id: 'b1', order: 3, hash: h(2) },
      { id: 'c1', order: 4, hash: h(3) },
      { id: 'c2', order: 5, hash: h(3, 1) },
    ]
    assert.deepEqual(groupSeries(items), [
      ['a1', 'a2', 'a3'],
      ['c1', 'c2'],
    ])
  })

  test('той самий кадр далеко в галереї — не серія (близькість за порядком)', () => {
    const items = [
      { id: 'x', order: 0, hash: h(1) },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, order: i + 1, hash: h(100 + i) })),
      { id: 'y', order: 11, hash: h(1, 1) },
    ]
    assert.deepEqual(groupSeries(items), [])
  })

  test('з часом зйомки: велика пауза розриває серію', () => {
    const items = [
      { id: 'a', order: 0, hash: h(1), takenAt: 0 },
      { id: 'b', order: 1, hash: h(1, 1), takenAt: 1_000 },
      { id: 'c', order: 2, hash: h(1, 2), takenAt: 120_000 },
    ]
    assert.deepEqual(groupSeries(items), [['a', 'b']])
  })

  test('порядок вхідного масиву не важливий', () => {
    const items = [
      { id: 'a2', order: 1, hash: h(1, 1) },
      { id: 'a1', order: 0, hash: h(1) },
    ]
    assert.deepEqual(groupSeries(items), [['a1', 'a2']])
  })
})

describe('Позначки (відносний поріг, кращий у серії, очі)', () => {
  function gallery(scores: number[], hashOf: (i: number) => string = (i) => dHash(scene(500 + i), W, H)) {
    const photos: CullingPhoto[] = scores.map((_, i) => ({ id: `p${i}`, url: '', order: i }))
    const analysis: Record<string, PhotoAnalysis> = {}
    scores.forEach((s, i) => (analysis[`p${i}`] = { sharpness: s, globalSharpness: s, hash: hashOf(i) }))
    return { photos, analysis }
  }

  test('явно розмитий кадр серед різких позначено, решту — ні', () => {
    const scores = Array.from({ length: 30 }, (_, i) => 900 + ((i * 37) % 200))
    scores[13] = 120
    const { photos, analysis } = gallery(scores)
    const v = computeVerdicts(photos, analysis)
    const blurry = photos.filter((p) => v[p.id].flags.includes('blurry')).map((p) => p.id)
    assert.deepEqual(blurry, ['p13'])
  })

  test('серед схожих кадрів (та сама сцена) мʼякший у 2+ рази — «розмито»', () => {
    // Frames 10–14: one scene (close hashes, but not a burst: distance > 10).
    const sceneHash = (i: number) => (i >= 10 && i <= 14 ? dHash(shift(scene(42), (i - 10) * 6), W, H) : dHash(scene(500 + i), W, H))
    const scores = Array.from({ length: 30 }, (_, i) => 900 + ((i * 37) % 200))
    scores[12] = 300
    const { photos, analysis } = gallery(scores, sceneHash)
    const v = computeVerdicts(photos, analysis)
    assert.ok(v.p12.flags.includes('blurry'), `rel ${v.p12.relativeSharpness}`)
    assert.equal(v.p12.seriesId, null, 'це правило «серед схожих», а не серій')
    assert.equal(photos.filter((p) => v[p.id].flags.includes('blurry')).length, 1)
  })

  test('кадр без схожих (крупний план, боке) у 2–3 рази мʼякший за галерею — НЕ брак', () => {
    const scores = Array.from({ length: 30 }, (_, i) => 3000 + ((i * 37) % 900))
    scores[7] = 1300
    scores[15] = 1400
    const { photos, analysis } = gallery(scores)
    const v = computeVerdicts(photos, analysis)
    assert.equal(photos.filter((p) => v[p.id].flags.length > 0).length, 0)
  })

  test('уся галерея мʼяка (знято на відкритій діафрагмі) — жодного «розмито»', () => {
    const scores = Array.from({ length: 30 }, (_, i) => 60 + ((i * 13) % 25))
    const { photos, analysis } = gallery(scores)
    const v = computeVerdicts(photos, analysis)
    assert.equal(photos.filter((p) => v[p.id].flags.includes('blurry')).length, 0)
  })

  test('серія: найрізкіший — «кращий у серії», решта — «повтор»; помітно мʼякший — ще й «розмито»', () => {
    const base = dHash(scene(1), W, H)
    const scores = [800, 500, 1000, 300, 900]
    const { photos, analysis } = gallery(scores, (i) => (i < 4 ? dHash(shift(scene(1), i), W, H) : dHash(scene(2), W, H)))
    assert.ok(base)
    const v = computeVerdicts(photos, analysis)
    assert.equal(v.p2.bestInSeries, true)
    assert.deepEqual(v.p2.flags, [])
    for (const id of ['p0', 'p1', 'p3']) assert.ok(v[id].flags.includes('duplicate'), id)
    assert.ok(v.p3.flags.includes('blurry'), '300 ≤ 0.4 × 1000')
    assert.ok(!v.p0.flags.includes('blurry'))
    assert.equal(v.p4.seriesId, null)
  })

  test('вибір фотографа перекриває автоматичний «кращий»', () => {
    const { photos, analysis } = gallery([800, 1000], (i) => dHash(shift(scene(1), i), W, H))
    const auto = computeVerdicts(photos, analysis)
    const sid = auto.p0.seriesId!
    const v = computeVerdicts(photos, analysis, { [sid]: 'p0' })
    assert.equal(v.p0.bestInSeries, true)
    assert.ok(v.p1.flags.includes('duplicate'))
  })

  test('у серії кадр із розплющеними очима кращий за різкіший із заплющеними', () => {
    const { photos, analysis } = gallery([800, 1000], (i) => dHash(shift(scene(1), i), W, H))
    analysis.p1.faces = [{ size: 0.3, blinkLeft: 0.9, blinkRight: 0.85 }]
    analysis.p0.faces = [{ size: 0.3, blinkLeft: 0.1, blinkRight: 0.1 }]
    const v = computeVerdicts(photos, analysis)
    assert.equal(v.p0.bestInSeries, true)
    assert.ok(v.p1.flags.includes('eyes'))
  })

  test('очі: лише велике обличчя й обидва ока явно заплющені', () => {
    assert.equal(hasClosedEyes([{ size: 0.3, blinkLeft: 0.8, blinkRight: 0.8 }]), true)
    assert.equal(hasClosedEyes([{ size: 0.3, blinkLeft: 0.8, blinkRight: 0.3 }]), false, 'підморгування')
    assert.equal(hasClosedEyes([{ size: 0.05, blinkLeft: 0.9, blinkRight: 0.9 }]), false, 'дрібне обличчя')
    assert.equal(hasClosedEyes([{ size: 0.3, blinkLeft: 0.5, blinkRight: 0.5 }]), false, 'погляд униз')
    assert.equal(hasClosedEyes(undefined), false)
  })

  test('кадри з помилкою завантаження не беруть участі', () => {
    const { photos, analysis } = gallery([900, 900])
    analysis.p1 = { sharpness: NaN, globalSharpness: NaN, hash: '', error: 'fetch' }
    const v = computeVerdicts(photos, analysis)
    assert.ok(v.p0)
    assert.equal(v.p1, undefined)
  })
})

describe('Рішення відбору в акаунті (0059): рядки для бази', () => {
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  const C = '33333333-3333-4333-8333-333333333333'
  const ids = new Set([A, B, C, 'demo-1'])

  test('стан ↔ рядки: рішення і «кращий у серії» туди й назад', () => {
    const state = { decisions: { [A]: 'confirmed' as const, [B]: 'cleared' as const }, bestOverrides: { [`s:${A}`]: B } }
    const rows = rowsFromState(state, ids)
    assert.deepEqual(rows.get(A), { decision: 'confirmed', best_of_series: null })
    assert.deepEqual(rows.get(B), { decision: 'cleared', best_of_series: `s:${A}` })
    assert.deepEqual(stateFromRows(rows), state)
  })

  test('не-UUID (демо) і чужі кадри в базу не йдуть', () => {
    const rows = rowsFromState({ decisions: { 'demo-1': 'confirmed', [C]: 'confirmed' }, bestOverrides: {} }, new Set(['demo-1']))
    assert.equal(rows.size, 0)
  })

  test('diff: лише змінені рядки на upsert, прибрані — на видалення', () => {
    const before = rowsFromState({ decisions: { [A]: 'confirmed', [B]: 'cleared' }, bestOverrides: {} }, ids)
    const after = rowsFromState({ decisions: { [A]: 'cleared', [C]: 'confirmed' }, bestOverrides: {} }, ids)
    const { upsert, remove } = diffRows(before, after)
    assert.deepEqual(upsert.map(([id]) => id).sort(), [A, C].sort())
    assert.deepEqual(remove, [B])
    assert.deepEqual(diffRows(after, after), { upsert: [], remove: [] })
  })
})

describe('MediaPipe лежить у нас, без сторонніх CDN', () => {
  const root = path.resolve(__dirname, '..', '..')
  test('wasm у public/ — той самий, що в установленому пакеті, шлях з версією пакета', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'))
    assert.equal(pkg.version, MEDIAPIPE_VERSION, 'оновили пакет — оновіть public/vendor і MEDIAPIPE_VERSION')
    assert.equal(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies['@mediapipe/tasks-vision'], MEDIAPIPE_VERSION)
    for (const file of [MEDIAPIPE_WASM_LOADER, MEDIAPIPE_WASM_BINARY]) {
      const ours = readFileSync(path.join(root, 'public', file))
      const theirs = readFileSync(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', path.basename(file)))
      assert.ok(ours.equals(theirs), file)
    }
  })

  test('модель Face Landmarker на місці, розмір і MD5 як в опублікованої float16/1', () => {
    const model = readFileSync(path.join(root, 'public', FACE_MODEL_URL))
    assert.equal(model.length, 3_758_596)
    assert.equal(createHash('md5').update(model).digest('base64'), 'sOcnSQehZEQE/vZrKN1thQ==')
  })

  test('у коді відбору немає адрес jsdelivr / googleapis', () => {
    const dir = path.join(root, 'src/lib/culling')
    const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts'))
    for (const f of files) assert.doesNotMatch(readFileSync(path.join(dir, f), 'utf8'), /jsdelivr|googleapis/, f)
  })
})

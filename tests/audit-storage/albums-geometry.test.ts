/**
 * Конструктор альбомів: чиста геометрія (мм ↔ px при DPI, виліт), кадрування
 * і DPI слота, шаблони, автозаповнення, профілі друку.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  formatFor,
  mmToPx,
  mmToPt,
  pageBoxes,
  pxToMm,
  rectToSheetPx,
  safeBoxes,
  sheetSizePx,
  trimSizePx,
} from '../../src/lib/album/geometry'
import { computeCrop, dpiLevel, effectiveDpi, panFocal } from '../../src/lib/album/crop'
import {
  PAGE_TEMPLATES,
  SPREAD_TEMPLATES,
  layoutCount,
  layoutsWithCount,
  parseLayout,
  resolveLayout,
} from '../../src/lib/album/templates'
import { applyLayout, autoFillAlbum, autoFillSpread, chunkSizes, matchByAspect, pickLayout } from '../../src/lib/album/autofill'
import { EXAMPLE_PROFILES, describeSpec, normalizeSpec, profileFromRow, rowFromSpec } from '../../src/lib/album/profiles'
import type { AlbumPhoto, PrintSpec } from '../../src/lib/album/types'

const spec4030: PrintSpec = EXAMPLE_PROFILES.find((p) => p.id === 'example-40x30')!.spec
const spec3030: PrintSpec = EXAMPLE_PROFILES.find((p) => p.id === 'example-30x30')!.spec
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

let seq = 0
const ids = () => `id-${++seq}`
const photo = (id: string, width: number, height: number, extra: Partial<AlbumPhoto> = {}): AlbumPhoto => ({
  id,
  width,
  height,
  thumbUrl: '',
  previewUrl: '',
  name: id,
  ...extra,
})

describe('геометрія: мм ↔ px', () => {
  test('25,4 мм = 1 дюйм = DPI пікселів', () => {
    assert.equal(mmToPx(25.4, 300), 300)
    assert.equal(mmToPx(254, 300), 3000)
    close(pxToMm(300, 300), 25.4)
    close(mmToPt(25.4), 72)
  })

  test('розворот 40×30 (80×30 см) при 300 DPI ≈ 9449×3543 px; з вильотом 3 мм більший на 2×35 px', () => {
    const f = formatFor(spec4030, 'spread')
    assert.deepEqual(trimSizePx(f, 300), { width: 9449, height: 3543 })
    assert.deepEqual(sheetSizePx(f, 300), { width: mmToPx(806, 300), height: mmToPx(306, 300) })
    assert.deepEqual(sheetSizePx(f, 300), { width: 9520, height: 3614 })
  })

  test('обкладинка має свій формат, виліт і корінець', () => {
    const cover = formatFor(spec3030, 'cover')
    assert.equal(cover.widthMm, 615)
    assert.equal(cover.bleedMm, 15)
    const [back, front] = pageBoxes(cover)
    close(back.w, 300)
    close(front.x, 315)
    // Без окремої обкладинки — формат блоку.
    const plain = formatFor({ ...spec3030, cover: null }, 'cover')
    assert.equal(plain.widthMm, 600)
    assert.equal(plain.spineMm, 0)
  })

  test('прямокутник у мм → пікселі аркуша з вильотом; сусіди без шва', () => {
    const f = formatFor(spec3030, 'spread')
    const left = rectToSheetPx({ x: -3, y: -3, w: 303, h: 306 }, f, 300)
    assert.deepEqual([left.x, left.y], [0, 0])
    const right = rectToSheetPx({ x: 300, y: -3, w: 303, h: 306 }, f, 300)
    assert.equal(left.x + left.w, right.x, 'лівий слот закінчується там, де починається правий')
    assert.equal(right.x + right.w, sheetSizePx(f, 300).width)
  })

  test('безпечне поле — по сторінці', () => {
    const boxes = safeBoxes(formatFor(spec3030, 'spread'))
    assert.equal(boxes.length, 2)
    assert.deepEqual(boxes[0], { x: 8, y: 8, w: 284, h: 284 })
    assert.deepEqual(boxes[1], { x: 308, y: 8, w: 284, h: 284 })
  })
})

describe('кадрування і DPI слота', () => {
  test('cover-fit: горизонтальне фото у квадратному слоті обрізається з боків', () => {
    const c = computeCrop(6000, 4000, 100, 100, 1, 0.5, 0.5)
    close(c.h, 1)
    close(c.w, 4000 / 6000)
    close(c.x, (1 - c.w) / 2)
  })

  test('фокусна точка зсуває кадр, але не за край', () => {
    const left = computeCrop(6000, 4000, 100, 100, 1, 0, 0.5)
    close(left.x, 0)
    const right = computeCrop(6000, 4000, 100, 100, 1, 1, 0.5)
    close(right.x + right.w, 1)
    const zoomed = computeCrop(6000, 4000, 100, 100, 2, 0.5, 0.25)
    close(zoomed.h, 0.5)
    close(zoomed.y, 0)
  })

  test('DPI: 6000 px на слот 254 мм = 600 DPI; масштаб ×2 — удвічі менше', () => {
    close(effectiveDpi(6000, 4000, 254, 169.33, 1), 6000 / 10, 0.5)
    close(effectiveDpi(6000, 4000, 254, 169.33, 2), 300, 0.5)
  })

  test('DPI на весь розворот 40×30: 24 Мп кадр не тягне 300 DPI', () => {
    const f = formatFor(spec4030, 'spread')
    const dpi = effectiveDpi(6000, 4000, f.widthMm + 6, f.heightMm + 6, 1)
    assert.ok(dpi < 300)
    assert.equal(dpiLevel(dpi, 300), 'low')
    assert.equal(dpiLevel(140, 300), 'bad')
    assert.equal(dpiLevel(299.8, 300), 'ok')
  })

  test('перетягування фото праворуч відкриває його лівий край', () => {
    const next = panFocal(6000, 4000, 100, 100, 1, 0.5, 0.5, 10, 0)
    assert.ok(next.fx < 0.5)
    // Упор у край: далі не їде.
    const far = panFocal(6000, 4000, 100, 100, 1, 0.5, 0.5, 1000, 0)
    close(far.fx, (4000 / 6000) / 2)
  })
})

describe('шаблони', () => {
  test('є сторінкові шаблони на 1–6 фото і шаблони на розворот', () => {
    for (let n = 1; n <= 6; n++) assert.ok(PAGE_TEMPLATES.some((t) => t.cells.length === n), `${n} фото`)
    assert.ok(SPREAD_TEMPLATES.length >= 3)
  })

  test('шаблон з полями: поля й відступи точні, слоти всередині сторінки', () => {
    const f = formatFor(spec3030, 'spread')
    const rects = resolveLayout('pages:p2-v|p4-grid', f, { marginMm: 12, gapMm: 4 })
    assert.equal(rects.length, 6)
    const [a, b] = rects
    close(a!.x, 12)
    close(a!.y, 12)
    close(b!.x - (a!.x + a!.w), 4, 0.02)
    close(b!.x + b!.w, 300 - 12, 0.02)
    for (const r of rects) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 600 && r.y + r.h <= 300, JSON.stringify(r))
    }
  })

  test('шаблон під обріз заходить у виліт лише зовнішніми краями', () => {
    const f = formatFor(spec3030, 'spread')
    const [l, r] = resolveLayout('pages:p1-bleed|p1-bleed', f, { marginMm: 12, gapMm: 4 })
    assert.deepEqual(l, { x: -3, y: -3, w: 303, h: 306 })
    assert.deepEqual(r, { x: 300, y: -3, w: 303, h: 306 })
    const [pano] = resolveLayout('spread:pano-bleed', f, { marginMm: 12, gapMm: 4 })
    assert.deepEqual(pano, { x: -3, y: -3, w: 606, h: 306 })
  })

  test('розбір id розкладки і кількість фото', () => {
    assert.equal(layoutCount('pages:p3-big-left|p2-h'), 5)
    assert.equal(layoutCount('spread:s3-strip'), 3)
    assert.equal(parseLayout('pages:nope|p1-bleed').kind, 'blank')
    assert.equal(layoutCount('blank'), 0)
    for (let n = 1; n <= 12; n++) {
      const all = layoutsWithCount(n)
      assert.ok(all.length > 0, `${n}`)
      for (const id of all) assert.equal(layoutCount(id), n, id)
    }
  })
})

describe('автозаповнення', () => {
  test('зіставлення за пропорціями: вертикальне фото — у вертикальний слот', () => {
    const rects = [
      { x: 0, y: 0, w: 200, h: 100 },
      { x: 0, y: 0, w: 100, h: 200 },
    ]
    const { order } = matchByAspect([photo('p', 2000, 3000), photo('l', 3000, 2000)], rects)
    assert.deepEqual(order, [1, 0])
  })

  test('2 горизонтальні кадри → по одному на сторінку, 2 вертикальні → вертикальні слоти', () => {
    const f = formatFor(spec3030, 'spread')
    const opts = { marginMm: 12, gapMm: 4 }
    const pick = pickLayout([photo('a', 3000, 2000), photo('b', 3000, 2000)], f, opts)
    assert.equal(pick.rects.length, 2)
    for (const r of pick.rects) assert.ok(r.w >= r.h * 0.9, 'горизонтальний або квадратний слот')
    const portraits = pickLayout([photo('a', 2000, 3000), photo('b', 2000, 3000), photo('c', 2000, 3000)], f, opts)
    assert.equal(portraits.rects.length, 3)
    assert.deepEqual([...portraits.assetIds].sort(), ['a', 'b', 'c'])
  })

  test('автозаповнення розвороту ставить кожне фото рівно раз і бере фокус з галереї', () => {
    const photos = [
      photo('a', 3000, 2000, { focalX: 0.2, focalY: 0.3 }),
      photo('b', 2000, 3000),
      photo('c', 3000, 2000),
      photo('d', 3000, 3000),
    ]
    const spread = autoFillSpread({ id: 's', kind: 'spread', layout: 'blank', slots: [] }, photos, spec3030, ids)
    assert.equal(spread.slots.length, 4)
    assert.equal(layoutCount(spread.layout), 4)
    assert.deepEqual(spread.slots.map((s) => s.assetId).sort(), ['a', 'b', 'c', 'd'])
    const a = spread.slots.find((s) => s.assetId === 'a')!
    assert.deepEqual([a.fx, a.fy, a.zoom], [0.2, 0.3, 1])
  })

  test('альбом із 10 кадрів: розвороти по ~3, без однакових розкладок поспіль', () => {
    assert.deepEqual(chunkSizes(10, 3), [3, 3, 2, 2])
    assert.deepEqual(chunkSizes(0, 3), [])
    const photos = Array.from({ length: 10 }, (_, i) => photo(`p${i}`, i % 3 ? 3000 : 2000, i % 3 ? 2000 : 3000))
    const spreads = autoFillAlbum(photos, spec3030, 3, ids)
    assert.equal(spreads.length, 4)
    const used = spreads.flatMap((s) => s.slots.map((x) => x.assetId))
    assert.deepEqual(used.sort(), photos.map((p) => p.id).sort())
    for (let i = 1; i < spreads.length; i++) {
      if (layoutCount(spreads[i]!.layout) === layoutCount(spreads[i - 1]!.layout)) {
        assert.notEqual(spreads[i]!.layout, spreads[i - 1]!.layout)
      }
    }
  })

  test('зміна розкладки зберігає фото й кадрування', () => {
    const spread = autoFillSpread({ id: 's', kind: 'spread', layout: 'blank', slots: [] }, [photo('a', 3000, 2000), photo('b', 3000, 2000)], spec3030, ids)
    spread.slots[0]!.zoom = 1.7
    const next = applyLayout(spread, 'pages:p2-h|p1-margin', spec3030, ids)
    assert.equal(next.slots.length, 3)
    assert.equal(next.slots[0]!.assetId, spread.slots[0]!.assetId)
    assert.equal(next.slots[0]!.zoom, 1.7)
    assert.equal(next.slots[2]!.assetId, null)
  })
})

describe('профілі друку', () => {
  test('готові приклади валідні', () => {
    for (const p of EXAMPLE_PROFILES) assert.deepEqual(normalizeSpec(p.spec), p.spec, p.name)
  })

  test('валідація: межі як у БД, кома як десятковий роздільник', () => {
    const spec = normalizeSpec({ spreadWidthMm: '600', spreadHeightMm: '300', bleedMm: '2,5', dpi: '' as unknown as number })
    assert.equal(spec.bleedMm, 2.5)
    assert.throws(() => normalizeSpec({ spreadWidthMm: 600, spreadHeightMm: 300, dpi: 30 }), /DPI/)
    assert.throws(() => normalizeSpec({ spreadWidthMm: 600, spreadHeightMm: 300, bleedMm: 40 }), /Виліт/)
  })

  test('рядок БД ↔ spec без втрат (numeric приходить рядком)', () => {
    const row = { id: 'x', ...rowFromSpec('A', spec3030) }
    const asStrings = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' && k !== 'dpi' ? String(v) : v]))
    assert.deepEqual(profileFromRow(asStrings as typeof row).spec, spec3030)
    assert.match(describeSpec(spec3030), /^30×30 см · виліт 3 мм · 300 DPI · sRGB$/)
  })
})

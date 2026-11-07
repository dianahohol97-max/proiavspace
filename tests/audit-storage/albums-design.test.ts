/**
 * Конструктор альбомів 1.1: поворот кадру, корінець і обкладинка, текст,
 * варіанти розкладки, автодизайн із серіями.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { computeCrop, effectiveDpi, normalizeRotation, panFocal, placement } from '../../src/lib/album/crop'
import { formatFor, pageBoxes } from '../../src/lib/album/geometry'
import { COVER_PRESETS, adaptCoverToSpine, applyCoverPreset, innerSpreadCount, spineFontPt, spineText, spineWidthMm } from '../../src/lib/album/cover'
import { applyVariant, autoDesignAlbum, frameNumber, layoutVariants, splitSeries } from '../../src/lib/album/autofill'
import { baselineOffsets, sanitizeText, textBox, textLines } from '../../src/lib/album/texts'
import { ALBUM_FONTS, fontById } from '../../src/lib/album/fonts'
import { EXAMPLE_PROFILES } from '../../src/lib/album/profiles'
import { layoutCount } from '../../src/lib/album/templates'
import type { AlbumPhoto, AlbumSpread, PrintSpec } from '../../src/lib/album/types'

const spec3030: PrintSpec = EXAMPLE_PROFILES.find((p) => p.id === 'example-30x30')!.spec
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)
let seq = 0
const ids = () => `id-${++seq}`
const photo = (id: string, width: number, height: number, name = `${id}.jpg`): AlbumPhoto => ({
  id, width, height, thumbUrl: '', previewUrl: '', name,
})

describe('поворот кадру', () => {
  test('нормалізація кута', () => {
    assert.equal(normalizeRotation(270), -90)
    assert.equal(normalizeRotation(-190), 170)
    assert.equal(normalizeRotation(undefined), 0)
    assert.equal(normalizeRotation(360), 0)
  })

  test('90°: вертикальне фото у горизонтальному слоті заповнює його без обрізання по ширині', () => {
    // 2000×3000 rotated 90° behaves like 3000×2000.
    const p = placement(2000, 3000, 300, 200, 1, 0.5, 0.5, 90)
    close(p.k, 0.1) // 300 mm across 3000 px
    close(p.hx, 1000)
    close(p.hy, 1500)
    close(effectiveDpi(2000, 3000, 300, 200, 1, 90), 254)
  })

  test('вільний поворот: кадр збільшується рівно настільки, щоб не було порожніх кутів', () => {
    const W = 6000
    const H = 4000
    const w = 300
    const h = 200
    for (const deg of [3, -7.5, 15, 33]) {
      const p = placement(W, H, w, h, 1, 0.5, 0.5, deg)
      const t = (deg * Math.PI) / 180
      // Every corner of the slot, mapped into image px, lies inside the image.
      for (const [sx, sy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]] as const) {
        const ix = p.cx + (sx * Math.cos(t) + sy * Math.sin(t)) / p.k
        const iy = p.cy + (-sx * Math.sin(t) + sy * Math.cos(t)) / p.k
        assert.ok(ix >= -1e-6 && ix <= W + 1e-6 && iy >= -1e-6 && iy <= H + 1e-6, `${deg}°: (${ix}, ${iy})`)
      }
      // …and it is tight: at least one extent touches the image edge.
      assert.ok(Math.abs(2 * p.hx - W) < 1e-6 || Math.abs(2 * p.hy - H) < 1e-6)
      assert.ok(effectiveDpi(W, H, w, h, 1, deg) < effectiveDpi(W, H, w, h, 1, 0))
    }
  })

  test('без повороту — та сама обрізка, що й раніше', () => {
    const c = computeCrop(6000, 4000, 100, 100, 1, 0.5, 0.5, 0)
    close(c.w, 4000 / 6000)
    close(c.h, 1)
  })

  test('зсув повернутого кадру йде в екранному напрямку', () => {
    // Rotated 90° clockwise, the image's +y axis points to the screen's left.
    // Dragging the picture right reveals what was on the screen-left of the
    // centre, i.e. larger image y.
    const next = panFocal(6000, 6000, 100, 100, 2, 0.5, 0.5, 10, 0, 90)
    assert.ok(next.fy > 0.5, `fy=${next.fy}`)
    close(next.fx, 0.5)
  })
})

describe('обкладинка з корінцем', () => {
  const growing: PrintSpec = { ...spec3030, cover: { ...spec3030.cover!, spineMm: 8, spinePerSpreadMm: 0.6 } }

  test('корінець = база + приріст на розворот; обкладинка ширшає рівно на приріст', () => {
    assert.equal(spineWidthMm(growing, 0), 8)
    assert.equal(spineWidthMm(growing, 15), 17)
    assert.equal(spineWidthMm(spec3030, 40), 15, 'фіксований корінець')
    const f = formatFor(growing, { kind: 'cover', spineMm: 17 })
    assert.equal(f.widthMm, growing.cover!.widthMm + 9)
    const [back, front] = pageBoxes(f)
    close(back.w, front.w)
    close(front.x - (back.x + back.w), 17)
    assert.equal(innerSpreadCount([{ id: 'c', kind: 'cover', layout: 'blank', slots: [] }, { id: 's', kind: 'spread', layout: 'blank', slots: [] }]), 1)
  })

  test('коли корінець росте, лицева сторона зсувається, задня стоїть, панорама ширшає', () => {
    const cover: AlbumSpread = {
      id: 'c',
      kind: 'cover',
      layout: 'blank',
      spineMm: 8,
      slots: [
        { id: 'back', x: 10, y: 10, w: 100, h: 100, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 },
        { id: 'front', x: 320, y: 10, w: 100, h: 100, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 },
        { id: 'wrap', x: -15, y: -15, w: 638, h: 330, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 },
      ],
      texts: [spineText(formatFor(growing, { kind: 'cover', spineMm: 8 }), 't', 'Аня & Тарас', '#fff')!],
    }
    const next = adaptCoverToSpine(cover, growing, 14)
    assert.equal(next.spineMm, 14)
    assert.equal(next.slots[0]!.x, 10)
    assert.equal(next.slots[1]!.x, 326)
    assert.equal(next.slots[2]!.w, 644)
    close(next.texts![0]!.x, cover.texts![0]!.x + 3)
  })

  test('текст на корінці: повернутий на 90°, по центру, розмір під ширину; тонкий корінець — без тексту', () => {
    const f = formatFor(growing, { kind: 'cover', spineMm: 15 })
    const t = spineText(f, 't', 'Весілля', '#000')!
    assert.equal(t.rotation, 90)
    assert.equal(t.align, 'center')
    close(t.y, f.heightMm / 2)
    assert.ok(t.x > (f.widthMm - 15) / 2 && t.x < (f.widthMm + 15) / 2)
    assert.ok(spineFontPt(15) > 10 && spineFontPt(15) <= 22)
    assert.equal(spineFontPt(3), 0)
    assert.equal(spineText(formatFor(growing, { kind: 'cover', spineMm: 3 }), 't', 'X', '#000'), null)
  })

  test('шаблони обкладинки: фото + назва на лицевій + текст на корінці', () => {
    const base: AlbumSpread = { id: 'c', kind: 'cover', layout: 'blank', slots: [], spineMm: 15 }
    for (const preset of COVER_PRESETS) {
      const out = applyCoverPreset(base, preset, spec3030, 'Аня & Тарас', ids)
      assert.equal(layoutCount(out.layout), layoutCount(preset.layout), preset.id)
      const spine = out.texts!.find((t) => t.rotation === 90)
      assert.ok(spine, `${preset.id}: текст на корінці`)
      if (preset.title) {
        const front = pageBoxes(formatFor(spec3030, out))[1]
        const title = out.texts!.find((t) => t.rotation === 0)!
        close(title.x, front.x + front.w / 2)
      }
    }
  })
})

describe('текст', () => {
  test('рядки лише за \\n, базові лінії через size×lineHeight', () => {
    assert.deepEqual(textLines('Аня\r\nТарас\n2026'), ['Аня', 'Тарас', '2026'])
    const offsets = baselineOffsets({ text: 'a\nb\nc', sizePt: 72, lineHeight: 1.25 })
    close(offsets[2]!, 2 * 25.4 * 1.25)
  })

  test('рамка тексту з урахуванням вирівнювання й повороту', () => {
    const t = sanitizeText({ id: 't', x: 100, y: 50, text: 'Аня', sizePt: 72, align: 'center', rotation: 0, color: '#ffffff', font: 'lora' })!
    const box = textBox(t, 60)
    close(box.x, 70)
    close(box.w, 60)
    const turned = textBox({ ...t, rotation: 90 }, 60)
    close(turned.h, 60)
    close(turned.y, 20)
  })

  test('недовірені дані тексту нормалізуються', () => {
    const t = sanitizeText({ id: 'x', text: 'Привіт', x: '12', y: 1e9, sizePt: 1, color: 'red', align: 'justify', rotation: 45 })!
    assert.equal(t.x, 12)
    assert.equal(t.y, 5000)
    assert.equal(t.sizePt, 4)
    assert.equal(t.color, '#1f1f1f')
    assert.equal(t.align, 'center')
    assert.equal(t.rotation, 0)
    assert.equal(sanitizeText({ id: 'x' }), null)
  })

  test('шрифти з кирилицею: унікальні id і CSS-імена', () => {
    assert.ok(ALBUM_FONTS.length >= 5)
    assert.equal(new Set(ALBUM_FONTS.map((f) => f.family)).size, ALBUM_FONTS.length)
    assert.equal(fontById('nope').id, ALBUM_FONTS[0]!.id)
  })
})

describe('варіанти розкладки і автодизайн', () => {
  test('кілька фото → кілька різних варіантів, найкращий перший, кожен з усіма фото', () => {
    const photos = [photo('a', 3000, 2000), photo('b', 2000, 3000), photo('c', 2000, 3000)]
    const variants = layoutVariants(photos, formatFor(spec3030, 'spread'), { marginMm: 12, gapMm: 4 }, 8)
    assert.ok(variants.length >= 4)
    for (let i = 1; i < variants.length; i++) assert.ok(variants[i]!.cost >= variants[i - 1]!.cost)
    const sigs = new Set(variants.map((v) => JSON.stringify(v.rects)))
    assert.equal(sigs.size, variants.length)
    for (const v of variants) assert.deepEqual([...v.assetIds].sort(), ['a', 'b', 'c'])
    const spread = applyVariant({ id: 's', kind: 'spread', layout: 'blank', slots: [], texts: [] }, variants[2]!, new Map(), ids)
    assert.equal(spread.layout, variants[2]!.layout)
    assert.deepEqual(spread.texts, [])
  })

  test('номер кадру з імені файлу і серії', () => {
    assert.equal(frameNumber('IMG_1234.JPG'), 1234)
    assert.equal(frameNumber('DSC01234-edit2.jpg'), 1234)
    assert.equal(frameNumber('2026-05-01_IMG_0042.jpg'), 42)
    assert.equal(frameNumber('vesillia.jpg'), null)
    const shots = [
      photo('1', 2000, 3000, 'IMG_0100.jpg'),
      photo('2', 2000, 3000, 'IMG_0101.jpg'),
      photo('3', 2000, 3000, 'IMG_0102.jpg'),
      photo('4', 3000, 2000, 'IMG_0103.jpg'), // orientation changes → new series
      photo('5', 3000, 2000, 'IMG_0250.jpg'), // far in time → new series
    ]
    assert.deepEqual(splitSeries(shots).map((s) => s.map((p) => p.id)), [['1', '2', '3'], ['4'], ['5']])
  })

  test('автодизайн: серії не розриваються, кожне фото рівно раз, герой-панорама, без повторів поспіль', () => {
    const shots: AlbumPhoto[] = []
    let n = 1000
    const series = (count: number, w: number, h: number) => {
      for (let i = 0; i < count; i++) shots.push(photo(`p${n}`, w, h, `IMG_${n++}.jpg`))
      n += 50
    }
    series(3, 2000, 3000)
    series(2, 3000, 2000)
    series(1, 3000, 2000)
    series(4, 2000, 3000)
    series(1, 3000, 2000)
    series(2, 2000, 3000)
    series(1, 3000, 2000)
    const spreads = autoDesignAlbum(shots, spec3030, 'normal', ids)
    const used = spreads.flatMap((s) => s.slots.map((x) => x.assetId))
    assert.deepEqual([...used].sort(), shots.map((p) => p.id).sort())
    // The 4-frame series sits on one spread.
    const four = shots.slice(6, 10).map((p) => p.id)
    assert.ok(spreads.some((s) => four.every((id) => s.slots.some((x) => x.assetId === id))), 'серія з 4 кадрів на одному розвороті')
    assert.ok(spreads.some((s) => s.layout === 'spread:pano-bleed'), 'є розворот-панорама')
    for (let i = 1; i < spreads.length; i++) {
      if (spreads[i]!.slots.length > 1) assert.notEqual(spreads[i]!.layout, spreads[i - 1]!.layout)
    }
    // Story order: spreads follow the gallery order.
    const firstIndex = spreads.map((s) => Math.min(...s.slots.map((x) => shots.findIndex((p) => p.id === x.assetId))))
    assert.deepEqual(firstIndex, [...firstIndex].sort((a, b) => a - b))
  })

  test('щільність: «повітряно» дає більше розворотів, ніж «щільно»', () => {
    const shots = Array.from({ length: 24 }, (_, i) => photo(`q${i}`, i % 2 ? 3000 : 2000, i % 2 ? 2000 : 3000, `x${i}.jpg`))
    const airy = autoDesignAlbum(shots, spec3030, 'airy', ids).length
    const dense = autoDesignAlbum(shots, spec3030, 'dense', ids).length
    assert.ok(airy > dense, `${airy} vs ${dense}`)
  })
})

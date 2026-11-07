/**
 * «Магічна збірка» альбому: історія (taken_at / назва файлу), розділи за
 * паузами з адаптивним порогом, відбір за сигналами AI-відбору, герої й пари,
 * фокус з облич, обкладинка, три стилі, кількість розворотів, жодних дублів і
 * прихованих кадрів, швидкість.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { hamming } from '../../src/lib/culling/dhash'
import { palette, paletteChroma, paletteDistance } from '../../src/lib/culling/palette'
import { subjectOf, toGray } from '../../src/lib/culling/sharpness'
import type { FaceInfo, PhotoAnalysis } from '../../src/lib/culling/types'
import { spineWidthMm } from '../../src/lib/album/cover'
import { EXAMPLE_PROFILES } from '../../src/lib/album/profiles'
import type { AlbumPhoto, AlbumSpread, PrintSpec } from '../../src/lib/album/types'
import { buildMagicAlbum, buildMagicVariants, capacity, type MagicInput, type MagicStyle } from '../../src/lib/album/magic'
import { STYLE_RULES, groupCost, partition, shotScale, spreadBudgets, type Item } from '../../src/lib/album/magic/compose'
import { focalPoint, headsFit, visibleWindow } from '../../src/lib/album/magic/focal'
import { apportion } from '../../src/lib/album/magic/select'
import { chapterStarts, MINUTE, pauseThreshold, splitAt, storyOrder } from '../../src/lib/album/magic/story'

const spec4030: PrintSpec = EXAMPLE_PROFILES.find((p) => p.id === 'example-40x30')!.spec
const spec3030: PrintSpec = EXAMPLE_PROFILES.find((p) => p.id === 'example-30x30')!.spec

// ---------------------------------------------------------------------------
// A synthetic wedding: seeded random, 4 chapters with real pauses, bursts of
// near-identical frames, a blurry and a blinking frame in some bursts, client
// hearts and retouch, a few hidden frames and frames without a capture time.
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const hex = (r: () => number) => Array.from({ length: 16 }, () => Math.floor(r() * 16).toString(16)).join('')
function flipBits(hash: string, bits: number, r: () => number): string {
  const n = BigInt('0x' + hash)
  let out = n
  for (let i = 0; i < bits; i++) out ^= 1n << BigInt(Math.floor(r() * 64))
  return out.toString(16).padStart(16, '0')
}

interface Gallery {
  photos: AlbumPhoto[]
  analysis: Record<string, PhotoAnalysis>
  chapterOf: Map<string, number>
  burstOf: Map<string, string>
}

const T0 = Date.UTC(2026, 8, 12, 10, 0, 0)
const CHAPTER_STARTS = [0, 150, 300, 560].map((m) => T0 + m * MINUTE) // 10:00, 12:30, 15:00, 19:20

function makeGallery(n: number, seed = 7, { undated = 0 } = {}): Gallery {
  const r = rng(seed)
  const photos: AlbumPhoto[] = []
  const analysis: Record<string, PhotoAnalysis> = {}
  const chapterOf = new Map<string, number>()
  const burstOf = new Map<string, string>()
  const per = Math.ceil(n / 4)
  let frame = 1000
  const tones = [
    { l: 70, a: 2, b: 8 },
    { l: 55, a: -12, b: 20 },
    { l: 62, a: 4, b: 30 },
    { l: 40, a: 18, b: 35 },
  ]
  for (let c = 0; c < 4; c++) {
    let t = CHAPTER_STARTS[c]!
    let made = 0
    while (made < per && photos.length < n) {
      const burst = r() < 0.35 ? 2 + Math.floor(r() * 3) : 1
      const sceneHash = hex(r)
      const landscape = r() < 0.55
      const faceSize = r() < 0.75 ? 0.05 + r() * 0.35 : 0
      const baseSharp = 80 + r() * 60
      const burstId = `b${photos.length}`
      for (let k = 0; k < burst && made < per && photos.length < n; k++) {
        const id = `p${String(photos.length + 1).padStart(4, '0')}`
        frame += 1
        const blurry = burst > 1 && k === 1 && r() < 0.5
        const eyes = burst > 1 && k === 2
        const tone = tones[c]!
        const faces: FaceInfo[] = faceSize
          ? [{ size: faceSize, blinkLeft: eyes ? 0.9 : 0.05, blinkRight: eyes ? 0.9 : 0.05, x: 0.55, y: 0.18, w: faceSize * 0.6, h: faceSize * 0.8 }]
          : []
        photos.push({
          id,
          width: landscape ? 6000 : 4000,
          height: landscape ? 4000 : 6000,
          thumbUrl: '',
          previewUrl: '',
          name: `IMG_${frame}.jpg`,
          takenAt: t,
        })
        analysis[id] = {
          sharpness: blurry ? baseSharp * 0.15 : baseSharp * (0.9 + r() * 0.2),
          globalSharpness: 10,
          hash: k === 0 ? sceneHash : flipBits(sceneHash, 2, r),
          faces,
          palette: [
            { l: tone.l + r() * 6, a: tone.a + r() * 4, b: tone.b + r() * 4, weight: 0.6 },
            { l: tone.l - 30, a: tone.a, b: tone.b, weight: 0.4 },
          ],
          subject: { x: 0.5, y: 0.4, size: faceSize ? 0.4 : 0.2 },
        }
        chapterOf.set(id, c)
        if (burst > 1) burstOf.set(id, burstId)
        t += burst > 1 ? 1000 : (20 + r() * 70) * 1000
        made++
      }
    }
  }
  // Client picks, hidden frames, frames without a capture time.
  photos.forEach((p, i) => {
    if (i % 23 === 5) p.favorites = 1 + (i % 3)
    if (i % 41 === 9) p.retouch = true
    if (i % 31 === 12) p.hidden = true
  })
  for (let i = 0; i < undated; i++) photos[10 + i * 7]!.takenAt = null
  return { photos, analysis, chapterOf, burstOf }
}

let seq = 0
const newId = () => `x${++seq}`

function input(g: Gallery, spreads: number, style: MagicStyle = 'editorial', spec = spec4030): MagicInput {
  return { photos: g.photos, analysis: g.analysis, spec, targetSpreads: spreads, style, title: 'Аня й Тарас', newId }
}

const assetsOf = (s: AlbumSpread) => s.slots.map((x) => x.assetId).filter((x): x is string => !!x)

// ---------------------------------------------------------------------------

describe('історія: порядок і розділи', () => {
  test('порядок за taken_at; без дати — за назвою файлу (після попередника за назвою)', () => {
    const p = (id: string, name: string, takenAt: number | null): AlbumPhoto => ({ id, name, takenAt, width: 3, height: 2, thumbUrl: '', previewUrl: '' })
    const story = storyOrder([
      p('c', 'IMG_0003.jpg', T0 + 3000),
      p('a', 'IMG_0001.jpg', T0 + 1000),
      p('x', 'IMG_0002.jpg', null), // no EXIF: goes after IMG_0001
      p('z', 'DSC_9000.jpg', T0 - 5000), // another camera, earlier
    ])
    assert.deepEqual(story.photos.map((x) => x.id), ['z', 'a', 'x', 'c'])
    assert.equal(story.order, 'time')
  })

  test('жодної дати — природний порядок назв (IMG_2 перед IMG_10)', () => {
    const p = (id: string, name: string): AlbumPhoto => ({ id, name, width: 3, height: 2, thumbUrl: '', previewUrl: '' })
    const story = storyOrder([p('b', 'IMG_10.jpg'), p('a', 'IMG_2.jpg'), p('c', 'IMG_100.jpg')])
    assert.deepEqual(story.photos.map((x) => x.id), ['a', 'b', 'c'])
    assert.equal(story.order, 'name')
  })

  test('весілля: три паузи між подіями знайдено, серії й зміна залу — ні', () => {
    const g = makeGallery(240)
    const story = storyOrder(g.photos)
    const starts = chapterStarts(story.values!, { maxChapters: 10, minSize: 3, minGap: 12 * MINUTE, burstGap: 2000 })
    const chapters = splitAt(story.photos, starts)
    assert.equal(chapters.length, 4)
    chapters.forEach((c, i) => assert.ok(c.every((p) => g.chapterOf.get(p.id) === i), `розділ ${i} змішаний`))
  })

  test('поріг адаптивний: рівні паузи по 5 хв у портретній зйомці — один розділ', () => {
    const values = Array.from({ length: 60 }, (_, i) => T0 + i * 5 * MINUTE)
    assert.deepEqual(chapterStarts(values, { maxChapters: 10, minSize: 3, minGap: 3 * MINUTE }), [])
    // Same pause, but in a shoot with 20-second rhythm — a real break.
    const busy = [...Array.from({ length: 30 }, (_, i) => T0 + i * 20_000), ...Array.from({ length: 30 }, (_, i) => T0 + 30 * MINUTE + i * 20_000)]
    assert.deepEqual(chapterStarts(busy, { maxChapters: 10, minSize: 3, minGap: 3 * MINUTE }), [30])
    assert.ok(pauseThreshold(busy, 3 * MINUTE) >= 3 * MINUTE)
  })

  test('розділів не більше за ліміт (лишаються найдовші паузи) і без дрібних розділів', () => {
    const g = makeGallery(240)
    const story = storyOrder(g.photos)
    const two = chapterStarts(story.values!, { maxChapters: 2, minSize: 3, minGap: 12 * MINUTE, burstGap: 2000 })
    assert.equal(two.length, 1)
    // The longest pause: 15:00 → 19:20.
    assert.equal(g.chapterOf.get(story.photos[two[0]!]!.id), 3)
    const values = [0, 1, 2, 3, 100, 101, 200, 201, 202, 203].map((m) => T0 + m * MINUTE)
    for (const s of chapterStarts(values, { maxChapters: 10, minSize: 3, minGap: 10 * MINUTE })) {
      assert.ok(s >= 3 && values.length - s >= 3)
    }
  })
})

describe('збірка альбому', () => {
  const g = makeGallery(320, 11, { undated: 6 })
  const hidden = new Set(g.photos.filter((p) => p.hidden).map((p) => p.id))
  const picks = g.photos.filter((p) => !p.hidden && (p.favorites || p.retouch)).map((p) => p.id)

  for (const style of ['calm', 'rich', 'editorial'] as MagicStyle[]) {
    test(`${style}: рівно N розворотів + обкладинка, жодних дублів і прихованих`, () => {
      for (const n of [6, 15, 30]) {
        const result = buildMagicAlbum(input(g, n, style))
        const [cover, ...inner] = result.spreads
        assert.equal(cover!.kind, 'cover')
        assert.equal(inner.length, n)
        assert.ok(inner.every((s) => s.kind === 'spread' && assetsOf(s).length > 0), 'порожній розворот')
        const all = result.spreads.flatMap(assetsOf)
        assert.equal(new Set(all).size, all.length, 'кадр повторюється')
        assert.ok(all.every((id) => !hidden.has(id)), 'прихований кадр в альбомі')
        assert.equal(result.report.spreads, n)
      }
    })
  }

  test('сердечка й ретуш клієнта — у альбомі (пріоритет)', () => {
    const result = buildMagicAlbum(input(g, 30, 'rich'))
    const all = new Set(result.spreads.flatMap(assetsOf))
    for (const id of picks) {
      if (all.has(id)) continue
      // Two picks from one burst: the near-identical twin is in, never both.
      const twin = [...all].some((x) => hamming(g.analysis[x]!.hash, g.analysis[id]!.hash) <= 6)
      assert.ok(twin, `${id} (вибір клієнта) не потрапив`)
    }
    // Even a small album keeps the client's picks before anything else.
    const small = buildMagicAlbum(input(g, 6, 'calm'))
    const inSmall = small.spreads.flatMap(assetsOf)
    const pickShare = inSmall.filter((id) => picks.includes(id)).length
    assert.ok(pickShare >= Math.min(picks.length, inSmall.length - 1), `вибраних клієнтом лише ${pickShare}`)
  })

  test('відхилене фотографом не береться; «прибрати позначку» знімає штраф', () => {
    const victim = g.photos.find((p) => !p.hidden && p.favorites)!.id
    const result = buildMagicAlbum({ ...input(g, 20, 'rich'), decisions: { [victim]: 'confirmed' } })
    assert.ok(!result.spreads.flatMap(assetsOf).includes(victim))
    assert.equal(result.report.rejected, 1)
  })

  test('з серії — лише кращий кадр (різкий, з розплющеними очима); розмиті й моргання не беруться', () => {
    const result = buildMagicAlbum(input(g, 12, 'calm'))
    const used = result.spreads.flatMap(assetsOf)
    const perBurst = new Map<string, number>()
    for (const id of used) {
      const p = g.photos.find((x) => x.id === id)!
      if (p.favorites || p.retouch) continue // the client's choice wins over the culling flags
      const b = g.burstOf.get(id)
      if (b) perBurst.set(b, (perBurst.get(b) ?? 0) + 1)
      const a = g.analysis[id]!
      assert.ok(!(a.faces ?? []).some((f) => f.blinkLeft > 0.6 && f.size >= 0.12), `${id}: заплющені очі`)
    }
    for (const [b, count] of perBurst) assert.equal(count, 1, `серія ${b}: ${count} кадри`)
  })

  test('кожен розділ починається з нового розвороту (жоден розворот не змішує розділи)', () => {
    for (const style of ['calm', 'rich', 'editorial'] as MagicStyle[]) {
      const result = buildMagicAlbum(input(g, 20, style))
      assert.equal(result.report.chapters, 4)
      const inner = result.spreads.slice(1)
      let last = -1
      for (const s of inner) {
        const ch = new Set(assetsOf(s).map((id) => g.chapterOf.get(id)))
        assert.equal(ch.size, 1, `${style}: розворот змішує розділи`)
        const c = [...ch][0]!
        assert.ok(c >= last, `${style}: розділи не по черзі`)
        last = c
      }
    }
  })

  test('історія: усередині альбому кадри йдуть за часом зйомки', () => {
    const result = buildMagicAlbum(input(g, 20, 'editorial'))
    const order = new Map(storyOrder(g.photos.filter((p) => !p.hidden)).photos.map((p, i) => [p.id, i]))
    const firsts = result.spreads.slice(1).map((s) => Math.min(...assetsOf(s).map((id) => order.get(id)!)))
    for (let i = 1; i < firsts.length; i++) assert.ok(firsts[i]! > firsts[i - 1]!, `розворот ${i + 1} раніше за ${i}`)
  })

  test('ритм: герой на весь розворот приблизно кожен 3–5-й, лише горизонтальні різкі кадри', () => {
    for (const style of ['calm', 'rich', 'editorial'] as MagicStyle[]) {
      const n = 30
      const result = buildMagicAlbum(input(g, n, style))
      const heroes = result.spreads.slice(1).filter((s) => s.layout.startsWith('spread:pano'))
      assert.equal(heroes.length, result.report.heroes)
      assert.ok(heroes.length >= Math.floor(n / 5) - 1 && heroes.length <= Math.ceil(n / 3) + 1, `${style}: героїв ${heroes.length}`)
      for (const h of heroes) {
        const p = g.photos.find((x) => x.id === h.slots[0]!.assetId)!
        assert.ok(p.width > p.height, 'герой вертикальний')
      }
      // Two heroes are never next to each other.
      const idx = result.spreads.slice(1).map((s, i) => (s.layout.startsWith('spread:pano') ? i : -1)).filter((i) => i >= 0)
      for (let i = 1; i < idx.length; i++) assert.ok(idx[i]! - idx[i - 1]! >= 2, `${style}: герої поспіль`)
    }
  })

  test('пари: два майже однакові кадри ніколи не стоять на одному розвороті', () => {
    for (const style of ['calm', 'rich', 'editorial'] as MagicStyle[]) {
      const result = buildMagicAlbum(input(g, 25, style))
      for (const s of result.spreads) {
        const ids = assetsOf(s)
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++)
            assert.ok(hamming(g.analysis[ids[i]!]!.hash, g.analysis[ids[j]!]!.hash) > 12, `${style}: схожі ${ids[i]} і ${ids[j]}`)
      }
    }
  })

  test('три стилі — різна щільність: спокійний < редакційний < насичений', () => {
    const [calm, rich, editorial] = buildMagicVariants({ ...input(g, 20), style: undefined } as never)
    assert.equal(calm!.report.style, 'calm')
    assert.ok(calm!.report.chosen < editorial!.report.chosen, `${calm!.report.chosen} vs ${editorial!.report.chosen}`)
    assert.ok(editorial!.report.chosen < rich!.report.chosen)
    assert.deepEqual(capacity('calm', 10), { heroes: 3, photos: 3 + Math.round(7 * STYLE_RULES.calm.perSpread) })
  })

  test('обкладинка: найкращий кадр, назва галереї, дата зйомки; корінець за профілем', () => {
    const result = buildMagicAlbum(input(g, 18, 'rich', spec3030))
    const cover = result.spreads[0]!
    assert.equal(cover.spineMm, spineWidthMm(spec3030, 18))
    const texts = (cover.texts ?? []).map((t) => t.text)
    assert.ok(texts.includes('Аня й Тарас'))
    assert.ok(texts.includes('12 вересня 2026'), texts.join(' | '))
    // Spine text, rotated, when the spine is wide enough.
    assert.ok((cover.texts ?? []).some((t) => t.rotation === 90))
    const coverPhoto = assetsOf(cover)[0]!
    assert.ok(g.photos.find((p) => p.id === coverPhoto)!.favorites || g.photos.find((p) => p.id === coverPhoto)!.retouch, 'обкладинка — не вибір клієнта')
  })

  test('мало фото: розворотів не більше, ніж кадрів; усе без дублів', () => {
    const small = makeGallery(8, 3)
    const result = buildMagicAlbum(input(small, 20, 'calm'))
    const inner = result.spreads.slice(1)
    const visible = small.photos.filter((p) => !p.hidden).length
    assert.ok(inner.length <= visible)
    const all = result.spreads.flatMap(assetsOf)
    assert.equal(new Set(all).size, all.length)
  })

  test('без аналізу (кадри не прочиталися) — альбом однаково збирається', () => {
    const result = buildMagicAlbum({ ...input(g, 10, 'editorial'), analysis: {} })
    assert.equal(result.spreads.length, 11)
  })

  test('швидкість: 800 кадрів → три варіанти < 3 с (у браузері ще швидше — без tsx)', () => {
    const big = makeGallery(800, 5)
    const t = performance.now()
    const all = buildMagicVariants({ ...input(big, 30), style: undefined } as never)
    const ms = performance.now() - t
    assert.equal(all.length, 3)
    assert.ok(ms < 3000, `${Math.round(ms)} мс`)
  })
})

describe('пари, гармонія, фокус', () => {
  const item = (id: string, a: Partial<PhotoAnalysis>, w = 6000, h = 4000): Item => {
    const analysis = { sharpness: 100, globalSharpness: 1, hash: a.hash ?? '0000000000000000', ...a } as PhotoAnalysis
    const photo: AlbumPhoto = { id, width: w, height: h, name: id, thumbUrl: '', previewUrl: '' }
    return {
      photo,
      analysis,
      focal: focalPoint(photo, analysis),
      scale: shotScale(analysis),
      score: { id, score: 0, flags: [], seriesId: null, bestInSeries: false, clientPick: false, relativeSharpness: 1, faceSize: 0, hash: analysis.hash },
    }
  }
  const warm = [{ l: 60, a: 20, b: 40, weight: 1 }]
  const cold = [{ l: 60, a: -10, b: -35, weight: 1 }]
  const bw = [{ l: 50, a: 0, b: 0, weight: 1 }]

  test('крупний план + загальний доповнюють один одного краще, ніж два загальні', () => {
    const rules = STYLE_RULES.editorial
    const close = item('c', { faces: [{ size: 0.4, blinkLeft: 0, blinkRight: 0 }], palette: warm, hash: 'ffff000000000000' })
    const wide1 = item('w1', { faces: [], subject: { x: 0.5, y: 0.5, size: 0.9 }, palette: warm, hash: '0000ffff00000000' })
    const wide2 = item('w2', { faces: [], subject: { x: 0.5, y: 0.5, size: 0.9 }, palette: warm, hash: '00000000ffff0000' })
    assert.ok(groupCost([close, wide1], rules) < groupCost([wide1, wide2], rules))
    assert.equal(shotScale(close.analysis), 'close')
    assert.equal(shotScale(item('d', { faces: [], subject: { x: 0.3, y: 0.3, size: 0.1 } }).analysis), 'detail')
  })

  test('майже однакові кадри на одному розвороті — дуже дорого', () => {
    const rules = STYLE_RULES.rich
    const a = item('a', { hash: 'abcdef0123456789' })
    const b = item('b', { hash: 'abcdef0123456788' })
    const c = item('c', { hash: '1234567890abcdef' })
    assert.ok(groupCost([a, b], rules) > groupCost([a, c], rules) + 3)
  })

  test('гармонія кольорів: теплі з теплими, ч/б не змішується з кольоровими', () => {
    const rules = STYLE_RULES.calm
    const w1 = item('w1', { palette: warm, hash: '1000000000000000' })
    const w2 = item('w2', { palette: warm, hash: '0100ff0000000000' })
    const c1 = item('c1', { palette: cold, hash: '00100000ff000000' })
    const b1 = item('b1', { palette: bw, hash: '000100000000ff00' })
    assert.ok(groupCost([w1, w2], rules) < groupCost([w1, c1], rules))
    assert.ok(groupCost([w1, w2], rules) < groupCost([w1, b1], rules))
    // DP keeps the story order and puts the cut where the colour changes.
    const groups = partition([w1, w2, c1, item('c2', { palette: cold, hash: '0000000100ffff00' })], 2, { ...rules, perSpread: 2, min: 1, max: 3 })
    assert.deepEqual(groups.map((g) => g.map((x) => x.photo.id)), [['w1', 'w2'], ['c1', 'c2']])
  })

  test('фокус з облич: голови цілі в панорамному кадруванні', () => {
    // A couple near the top of a 3:2 frame; the spread is 8:3.
    const faces: FaceInfo[] = [
      { size: 0.2, blinkLeft: 0, blinkRight: 0, x: 0.3, y: 0.12, w: 0.08, h: 0.1 },
      { size: 0.19, blinkLeft: 0, blinkRight: 0, x: 0.45, y: 0.14, w: 0.08, h: 0.1 },
    ]
    const photo = { width: 6000, height: 4000, focalX: null, focalY: null }
    const f = focalPoint(photo, { sharpness: 1, globalSharpness: 1, hash: '', faces })
    assert.equal(f.source, 'faces')
    assert.ok(f.fy < 0.25, `fy ${f.fy}`)
    const aspect = 8 / 3
    assert.ok(headsFit(photo, f, aspect))
    // The centre crop would cut them.
    assert.ok(!headsFit(photo, { ...f, fx: 0.5, fy: 0.5 }, aspect))
    const win = visibleWindow(1.5, aspect, f.fx, f.fy)
    assert.ok(win.y0 <= f.heads!.y0 && win.y1 >= f.heads!.y1)
  })

  test('фокус: власна точка фотографа важливіша; без облич — головний об\'єкт', () => {
    assert.equal(focalPoint({ focalX: 0.2, focalY: 0.8 }, undefined).source, 'photographer')
    const s = focalPoint({}, { sharpness: 1, globalSharpness: 1, hash: '', faces: [], subject: { x: 0.7, y: 0.3, size: 0.1 } })
    assert.deepEqual([s.source, s.fx, s.fy], ['subject', 0.7, 0.3])
  })

  test('бюджет розворотів на розділи: сума = N, щонайменше 1, не більше, ніж кадрів', () => {
    assert.deepEqual(spreadBudgets([30, 3, 12], 10), [6, 1, 3])
    assert.equal(spreadBudgets([1, 1, 40], 10).reduce((a, b) => a + b, 0), 10)
    assert.deepEqual(spreadBudgets([1, 1, 40], 10).slice(0, 2), [1, 1])
    assert.deepEqual(apportion(10, [1, 1, 1]), [4, 3, 3])
  })
})

describe('сигнали кадру (воркер відбору)', () => {
  test('палітра: два кольори з вагами, ΔE між кадрами', () => {
    const w = 64
    const h = 32
    const rgba = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4
        const red = x < w * 0.75
        rgba[p] = red ? 220 : 30
        rgba[p + 1] = red ? 40 : 60
        rgba[p + 2] = red ? 30 : 200
        rgba[p + 3] = 255
      }
    const pal = palette(rgba, w, h)
    assert.ok(pal.length >= 2)
    assert.ok(pal[0]!.a > 40, 'перший колір — червоний')
    assert.ok(Math.abs(pal.reduce((s, c) => s + c.weight, 0) - 1) < 0.01)
    assert.ok(Math.abs(pal[0]!.weight - 0.75) < 0.05)
    assert.equal(paletteDistance(pal, pal), 0)
    const grey = palette(new Uint8ClampedArray(w * h * 4).fill(128), w, h)
    assert.ok(paletteChroma(grey)! < 1)
    assert.ok(paletteDistance(pal, grey)! > 30)
  })

  test('головний об\'єкт: різка ділянка на розмитому тлі', () => {
    const w = 120
    const h = 120
    const rgba = new Uint8ClampedArray(w * h * 4).fill(120)
    // A checkerboard (crisp detail) in the top-right corner.
    for (let y = 10; y < 40; y++)
      for (let x = 80; x < 110; x++) {
        const v = (x + y) % 2 ? 250 : 10
        const p = (y * w + x) * 4
        rgba[p] = rgba[p + 1] = rgba[p + 2] = v
      }
    const s = subjectOf(toGray(rgba, w, h), w, h)
    assert.ok(s.x > 0.6 && s.y < 0.4, JSON.stringify(s))
    assert.ok(s.size < 0.2)
  })
})


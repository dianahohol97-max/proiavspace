/**
 * «Відбір із папки»: рішення (пропозиції + ручні позначки), XMP-sidecar для
 * Lightroom/Capture One (без затирання чужих полів), план експорту з відкотом
 * власних значень, пари RAW+JPEG, CSV.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { outcomeOf, orderItems } from '@/lib/folder-cull/decide'
import { csvReport, fieldsFor, planExport, recordExport, wanted } from '@/lib/folder-cull/export'
import { buildItems } from '@/lib/folder-cull/source'
import { newSession } from '@/lib/folder-cull/store'
import { DEFAULT_EXPORT, type FolderItem, type FolderSession } from '@/lib/folder-cull/types'
import { newSidecar, readFields, updateSidecar } from '@/lib/folder-cull/xmp'
import type { PhotoVerdict } from '@/lib/culling/types'
import { EXISTING_XMP } from '../folder-cull/make-set'
import { extractPreview } from '@/lib/folder-cull/raw/extract'
import { BytesReader } from '@/lib/folder-cull/raw/reader'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { makeRaf, makeCr2 } from '../folder-cull/make-raw'

const v = (flags: PhotoVerdict['flags'], extra: Partial<PhotoVerdict> = {}): PhotoVerdict => ({
  flags,
  seriesId: null,
  bestInSeries: false,
  relativeSharpness: 1,
  ...extra,
})
const S = DEFAULT_EXPORT

describe('Рішення: пропозиції й ручні позначки', () => {
  test('розмито / очі → брак (Rating -1, мітка, pick -1); повтор — ні (за замовчуванням)', () => {
    for (const f of ['blurry', 'eyes'] as const) {
      const o = outcomeOf('a', v([f]), undefined, S)
      assert.deepEqual([o.reject, o.autoReject, o.rating, o.label, o.pick], [true, true, -1, 'Red', -1])
    }
    const dup = outcomeOf('a', v(['duplicate'], { seriesId: 's:x' }), undefined, S)
    assert.equal(dup.reject, false)
    assert.equal(outcomeOf('a', v(['duplicate'], { seriesId: 's:x' }), undefined, { ...S, duplicatesAreRejects: true }).reject, true)
  })

  test('кращий у серії → ★★★ (налаштовується), мітка серії — за бажанням', () => {
    const best = v([], { seriesId: 's:1', bestInSeries: true })
    assert.equal(outcomeOf('a', best, undefined, S).rating, 3)
    assert.equal(outcomeOf('a', best, undefined, { ...S, bestStars: 5 }).rating, 5)
    assert.equal(outcomeOf('a', best, undefined, { ...S, bestStars: 0 }).rating, null)
    assert.equal(outcomeOf('a', best, undefined, { ...S, seriesLabel: 'Yellow' }).label, 'Yellow')
  })

  test('без позначок і пропозицій — нічого не міняємо', () => {
    const o = outcomeOf('a', v([]), undefined, S)
    assert.deepEqual([o.reject, o.rating, o.label, o.pick], [false, null, null, null])
  })

  test('ручні позначки сильніші: P рятує розмитий, X бракує хороший, зірки скасовують авто-брак', () => {
    assert.equal(outcomeOf('a', v(['blurry']), { flag: 'pick' }, S).reject, false)
    assert.equal(outcomeOf('a', v(['blurry']), { flag: 'pick' }, S).pick, 1)
    const x = outcomeOf('a', v([]), { flag: 'reject' }, S)
    assert.deepEqual([x.reject, x.autoReject], [true, false])
    const starred = outcomeOf('a', v(['eyes']), { stars: 4 }, S)
    assert.deepEqual([starred.reject, starred.rating], [false, 4])
    assert.equal(outcomeOf('a', v([], { seriesId: 's', bestInSeries: true }), { stars: 1 }, S).rating, 1)
  })

  test('порядок: за часом зйомки, далі за назвою (числовий)', () => {
    const items = ['IMG_10.CR2', 'IMG_9.CR2', 'IMG_2.CR2'].map((n) => ({ id: n, name: n, dir: '', kind: 'raw' as const, size: 1, lastModified: 1 }))
    const meta = { 'IMG_10.CR2': { takenAt: 1000 }, 'IMG_9.CR2': { takenAt: 1000 }, 'IMG_2.CR2': { takenAt: 2000 } } as unknown as FolderSession['meta']
    assert.deepEqual(orderItems(items, { meta }).map((p) => p.id), ['IMG_9.CR2', 'IMG_10.CR2', 'IMG_2.CR2'])
  })
})

describe('XMP sidecar', () => {
  test('новий файл: Rating, Label, xmpDM:pick/good, MetadataDate, валідні простори імен', () => {
    const xml = newSidecar({ rating: '-1', label: 'Red', pick: '-1', good: 'False' }, new Date(2026, 10, 7, 12, 0, 0))
    assert.match(xml, /xmlns:xmp="http:\/\/ns\.adobe\.com\/xap\/1\.0\/"/)
    assert.match(xml, /xmlns:xmpDM="http:\/\/ns\.adobe\.com\/xmp\/1\.0\/DynamicMedia\/"/)
    assert.deepEqual(readFields(xml), { rating: '-1', label: 'Red', pick: '-1', good: 'False' })
    assert.match(xml, /xmp:MetadataDate="2026-11-07T12:00:00[+-]\d\d:\d\d"/)
  })

  test('наявний файл Lightroom: оновлюємо лише свої поля, налаштування обробки — байт у байт', () => {
    const out = updateSidecar(EXISTING_XMP, { rating: '3', label: 'Green', pick: undefined }, new Date(2026, 0, 1))!
    assert.deepEqual(readFields(out), { rating: '3', label: 'Green', pick: null, good: null })
    for (const keep of ['crs:Exposure2012="+0.35"', 'crs:WhiteBalance="As Shot"', '<rdf:li>0, 0</rdf:li>', 'x:xmptk="Adobe XMP Core 7.0"']) {
      assert.ok(out.includes(keep), keep)
    }
    // Nothing else changed: removing our attributes gives back the original.
    const stripped = out
      .replace(/\s*xmp:Label="Green"/, '')
      .replace(/\s*xmp:MetadataDate="[^"]*"/, '')
      .replace('xmp:Rating="3"', 'xmp:Rating="2"')
    assert.equal(stripped, EXISTING_XMP)
  })

  test('простір імен xmpDM додається, якщо його не було', () => {
    const out = updateSidecar(EXISTING_XMP, { pick: '-1', good: 'False' })!
    assert.match(out, /xmlns:xmpDM="http:\/\/ns\.adobe\.com\/xmp\/1\.0\/DynamicMedia\/"/)
    assert.equal(readFields(out).pick, '-1')
  })

  test('форма-елемент і чужий префікс (xap) теж оновлюються на місці', () => {
    const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xap="http://ns.adobe.com/xap/1.0/"><xap:Rating>4</xap:Rating><xap:Label>Blue</xap:Label></rdf:Description></rdf:RDF></x:xmpmeta>`
    const out = updateSidecar(xml, { rating: '-1', label: null })!
    assert.match(out, /<xap:Rating>-1<\/xap:Rating>/)
    assert.doesNotMatch(out, /Label/)
    assert.doesNotMatch(out, /xmlns:xmp="/, 'не додаємо другий префікс для того ж простору імен')
  })

  test('не XMP — null (файл не чіпаємо)', () => {
    assert.equal(updateSidecar('hello', { rating: '1' }), null)
  })

  test('екранування значень', () => {
    const out = newSidecar({ label: 'A&B "x"' })
    assert.equal(readFields(out).label, 'A&B "x"')
    assert.match(out, /A&amp;B &quot;x&quot;/)
  })
})

describe('План експорту', () => {
  const item = (name: string, kind: FolderItem['kind'] = 'raw'): FolderItem => ({ id: name, name, dir: '', kind, size: 1, lastModified: 1 })
  const session = (): FolderSession => {
    const s = newSession('t', 'shoot', [item('A.CR3'), item('B.CR3'), item('C.CR3'), item('D.JPG', 'jpeg')], false)
    for (const it of s.items) s.analysis[it.id] = { sharpness: 1, globalSharpness: 1, hash: '0000000000000000' }
    return s
  }
  const outcomes = (map: Record<string, Partial<ReturnType<typeof outcomeOf>>>) =>
    new Map(Object.entries(map).map(([k, o]) => [k, { reject: false, autoReject: false, best: false, seriesId: null, rating: null, label: null, pick: null, ...o }]))

  test('лише RAW, лише де є що писати; JPEG — ні; наявний sidecar оновлюється', () => {
    const s = session()
    const o = outcomes({ 'A.CR3': { reject: true, rating: -1, label: 'Red', pick: -1 }, 'B.CR3': { best: true, rating: 3 }, 'D.JPG': { reject: true, rating: -1 } })
    const plan = planExport(s, o, new Map([['/b', EXISTING_XMP]]), new Map([['/b', 'B.XMP']]))
    assert.deepEqual(plan.sidecars.map((x) => [x.path, x.existed]), [['A.xmp', false], ['B.XMP', true]])
    assert.equal(plan.untouched, 1) // C: nothing to say
    assert.deepEqual(readFields(plan.sidecars[0].xml), { rating: '-1', label: 'Red', pick: '-1', good: 'False' })
    assert.equal(readFields(plan.sidecars[1].xml).rating, '3')
    assert.ok(plan.sidecars[1].xml.includes('crs:Exposure2012="+0.35"'))
    assert.deepEqual(plan.sidecars[1].original, { rating: '2', label: null, pick: null, good: null })
  })

  test('рішення змінилось — відкочуємо СВОЄ до початкового значення файлу', () => {
    let s = session()
    const first = planExport(s, outcomes({ 'B.CR3': { reject: true, rating: -1, label: 'Red', pick: -1 } }), new Map([['/b', EXISTING_XMP]]))
    s = recordExport(s, first.sidecars)
    const written = first.sidecars[0].xml
    // Photographer pressed P: no longer a reject, nothing of ours to say.
    const second = planExport(s, outcomes({ 'B.CR3': {} }), new Map([['/b', written]]))
    const f = readFields(second.sidecars[0].xml)
    assert.deepEqual(f, { rating: '2', label: null, pick: null, good: null }, 'повернуто Rating=2, наші мітки прибрано')
  })

  test('прапорець Lightroom можна вимкнути', () => {
    assert.deepEqual(wanted({ reject: true, autoReject: true, best: false, seriesId: null, rating: -1, label: 'Red', pick: -1 }, false), {
      rating: '-1',
      label: 'Red',
      pick: null,
      good: null,
    })
    assert.deepEqual(fieldsFor('x', { rating: null, label: null, pick: null, good: null }, {}), {})
  })

  test('CSV: усі кадри разом із JPEG, BOM, екранування', () => {
    const s = session()
    const o = outcomes({ 'A.CR3': { reject: true, autoReject: true, rating: -1, label: 'Red' }, 'D.JPG': { best: true, rating: 3 } })
    const csv = csvReport(s, s.items, o, (id) => (id === 'A.CR3' ? ['blurry'] : []))
    assert.ok(csv.startsWith('\ufefffile,path,decision'))
    assert.match(csv, /A\.CR3,A\.CR3,reject \(suggested\),blurry,-1,Red/)
    assert.match(csv, /D\.JPG,D\.JPG,best of burst,,3/)
  })
})

describe('Папка: пари RAW+JPEG, sidecar, чужі файли', () => {
  const ref = { getFile: async () => new File([], 'x') }
  const e = (p: string) => ({ path: p, dir: p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '', name: p.split('/').pop()!, size: 1, lastModified: 1, ref })
  test('RAW+JPEG — один кадр (RAW), окремий JPEG — свій кадр, .xmp — sidecar, txt — пропуск', () => {
    const r = buildItems([e('A/IMG_1.CR3'), e('A/IMG_1.JPG'), e('A/IMG_2.jpg'), e('A/IMG_1.xmp'), e('A/notes.txt'), e('B/IMG_1.NEF')])
    assert.deepEqual(r.items.map((i) => [i.id, i.kind, i.companion ?? null]), [
      ['A/IMG_1.CR3', 'raw', 'A/IMG_1.JPG'],
      ['A/IMG_2.jpg', 'jpeg', null],
      ['B/IMG_1.NEF', 'raw', null],
    ])
    assert.deepEqual([...r.sidecars.keys()], ['a/img_1'])
    assert.equal(r.skipped, 1)
  })
})

describe('Орієнтація вбудованого JPEG', () => {
  const FIX = path.resolve(__dirname, '..', 'fixtures', 'folder-cull')
  const big = new Uint8Array(readFileSync(path.join(FIX, 'a1.jpg')))
  const thumb = new Uint8Array(readFileSync(path.join(FIX, 'thumb.jpg')))
  test('RAF: JPEG має власну EXIF-орієнтацію → декодер застосує сам (без подвійного повороту)', async () => {
    const info = await extractPreview(new BytesReader(makeRaf(big, { date: '2026:01:01 00:00:00', orientation: 6 })), 'a.RAF')
    assert.equal(info!.preview.selfOriented, true)
  })
  test('CR2: прев’ю без власної орієнтації → повертаємо за орієнтацією RAW', async () => {
    const info = await extractPreview(new BytesReader(makeCr2(big, thumb, { date: '2026:01:01 00:00:00', orientation: 8 }, [1200, 800])), 'a.CR2')
    assert.equal(info!.preview.selfOriented, undefined)
    assert.equal(info!.orientation, 8)
  })
})

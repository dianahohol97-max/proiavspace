/**
 * «Відбір із папки»: витяг вбудованого JPEG-прев'ю з RAW без декодування й без
 * читання файлу цілком. Синтетичні контейнери (tests/folder-cull/make-raw.ts)
 * повторюють структури справжніх камер; на справжніх CC0-зразках
 * raw.pixls.us (CR2, CR3, NEF, ARW, RAF, DNG, ORF, RW2) парсер перевірено
 * вручну — див. docs/FOLDER_CULLING.md.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import { extractPreview, kindOf } from '@/lib/folder-cull/raw/extract'
import { BytesReader } from '@/lib/folder-cull/raw/reader'
import { exifDateToMs } from '@/lib/folder-cull/raw/tiff'
import { makeCr2, makeCr3, makeDng, makeNefOrArw, makeOrf, makeRaf, makeRw2, withExif } from '../folder-cull/make-raw'

const FIX = path.resolve(__dirname, '..', 'fixtures', 'folder-cull')
const big = new Uint8Array(readFileSync(path.join(FIX, 'a1.jpg'))) // 1200 px long side
const thumb = new Uint8Array(readFileSync(path.join(FIX, 'thumb.jpg'))) // 160 px
const o = { date: '2026:09:14 15:02:03', subSec: '42', orientation: 6, make: 'Test', model: 'Cam' }
const expectedMs = Date.UTC(2026, 8, 14, 15, 2, 3) + 420

function jpegSize(bytes: Uint8Array): [number, number] {
  for (let p = 2; p < bytes.length; ) {
    const m = bytes[p + 1]
    const len = (bytes[p + 2] << 8) | bytes[p + 3]
    if (m >= 0xc0 && m <= 0xc2) return [(bytes[p + 7] << 8) | bytes[p + 8], (bytes[p + 5] << 8) | bytes[p + 6]]
    p += 2 + len
  }
  throw new Error('no SOF')
}
const [W, H] = jpegSize(big)

describe('RAW: вбудоване прев’ю, час зйомки, орієнтація', () => {
  const cases: [string, Uint8Array][] = [
    ['IMG_0001.CR2', makeCr2(big, thumb, o, [W, H])],
    ['DSC_0001.NEF', makeNefOrArw('nef', big, o)],
    ['DSC00001.ARW', makeNefOrArw('arw', big, o)],
    ['IMG_0001.DNG', makeDng(big, o, [W, H])],
    ['P0000001.ORF', makeOrf(big, o)],
    ['P1000001.RW2', makeRw2(withExif(big, o), o)],
    ['DSCF0001.RAF', makeRaf(big, o)],
    ['IMG_0001.CR3', makeCr3(big, big, o, [W, H])],
    ['IMG_0001.JPG', withExif(big, o)],
  ]
  for (const [name, bytes] of cases) {
    test(`${name}: знайдено JPEG ${W}×${H}, час і орієнтацію`, async () => {
      const reader = new BytesReader(bytes)
      const info = await extractPreview(reader, name)
      assert.ok(info, 'прев’ю знайдено')
      assert.equal(info.preview.width, W)
      assert.equal(info.preview.height, H)
      const jpeg = bytes.subarray(info.preview.offset, info.preview.offset + 2)
      assert.deepEqual([...jpeg], [0xff, 0xd8], 'зміщення вказує на SOI')
      assert.equal(info.takenAt, expectedMs)
      assert.equal(info.orientation, 6)
    })
  }

  test('CR2: мініатюра 160 px не обирається, коли є ≥ 1000 px', async () => {
    const info = await extractPreview(new BytesReader(makeCr2(big, thumb, o, [W, H])), 'a.CR2')
    assert.equal(Math.max(info!.preview.width, info!.preview.height), Math.max(W, H))
  })

  test('лише мініатюра — береться найбільше, що є', async () => {
    const info = await extractPreview(new BytesReader(makeNefOrArw('arw', thumb, o)), 'a.ARW')
    assert.equal(Math.max(info!.preview.width, info!.preview.height), 160)
  })

  test('читаються лише заголовки: файл із «сирими» 40 МБ — кілька КБ', async () => {
    const raw = makeNefOrArw('nef', big, o)
    const padded = new Uint8Array(raw.length + 40 * 1024 * 1024)
    padded.set(raw)
    const reader = new BytesReader(padded)
    await extractPreview(reader, 'a.NEF')
    assert.ok(reader.bytesRead <= 256 * 1024, `прочитано ${reader.bytesRead} Б`)
  })

  test('биті й чужі файли — null, без винятків', async () => {
    for (const [name, bytes] of [
      ['x.NEF', new Uint8Array(100)],
      ['x.CR3', Uint8Array.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70])],
      ['x.RAF', Uint8Array.from([...'FUJIFILMCCD-RAW '].map((c) => c.charCodeAt(0)))],
      ['x.txt', new Uint8Array(10)],
    ] as const) {
      assert.equal(await extractPreview(new BytesReader(bytes as Uint8Array), name).catch(() => 'threw'), null, name)
    }
  })

  test('kindOf і дата EXIF', () => {
    assert.equal(kindOf('A.CR3'), 'raw')
    assert.equal(kindOf('a.jpeg'), 'jpeg')
    assert.equal(kindOf('a.HEIC'), 'heif')
    assert.equal(kindOf('a.xmp'), null)
    assert.equal(exifDateToMs('2026:01:02 03:04:05'), Date.UTC(2026, 0, 2, 3, 4, 5))
    assert.equal(exifDateToMs('0000:00:00 00:00:00'), null)
    assert.equal(exifDateToMs(undefined), null)
  })
})

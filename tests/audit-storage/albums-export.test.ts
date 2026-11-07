/**
 * Конструктор альбомів, експорт: DPI і ICC у JPEG, валідність ICC-профілів,
 * перерахунок sRGB → Adobe RGB, структура PDF (бокси, виліт, мітки обрізу),
 * PSD з шаром на фото. Зовнішні перевірки (Pillow, pdfinfo) — коли є.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, test } from 'node:test'
import { readPsd } from 'ag-psd'
import { embedIccInJpeg, finalizeJpeg, readJpegDpi, readJpegIcc, setJpegDpi } from '../../src/lib/album/export/jpeg-meta'
import { iccProfile } from '../../src/lib/album/export/icc'
import { srgbToAdobeRgbInPlace } from '../../src/lib/album/export/color'
import { MARK_AREA_MM, buildAlbumPdf } from '../../src/lib/album/export/pdf'
import { buildSpreadPsd } from '../../src/lib/album/export/psd'
import { mmToPt } from '../../src/lib/album/geometry'

const ROOT = resolve(__dirname, '..', '..')
const jpeg = () => new Uint8Array(readFileSync(join(ROOT, 'public/showcase/05.jpg')))
const has = (cmd: string, args: string[] = ['--version']) => spawnSync(cmd, args).status === 0
const hasPillow = spawnSync('python3', ['-c', 'import PIL.ImageCms']).status === 0
const hasPdfinfo = has('pdfinfo', ['-v'])

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'album-export-'))
}

describe('JPEG: DPI і колірний профіль у метаданих', () => {
  test('DPI пишеться в JFIF (одиниці — дюйми), розмір і зображення не змінюються', () => {
    const src = jpeg()
    assert.deepEqual(readJpegDpi(src), { units: 0, x: 1, y: 1 })
    const out = setJpegDpi(src, 300)
    assert.equal(out.length, src.length)
    assert.deepEqual(readJpegDpi(out), { units: 1, x: 300, y: 300 })
    assert.deepEqual(out.subarray(40), src.subarray(40))
  })

  test('JPEG без JFIF отримує сегмент APP0', () => {
    const src = jpeg()
    const len = (src[4]! << 8) | src[5]!
    const stripped = new Uint8Array([0xff, 0xd8, ...src.subarray(4 + len)])
    assert.equal(readJpegDpi(stripped), null)
    assert.deepEqual(readJpegDpi(setJpegDpi(stripped, 600)), { units: 1, x: 600, y: 600 })
  })

  test('ICC вбудовується й читається назад без змін', () => {
    const icc = iccProfile('adobe_rgb')
    const out = embedIccInJpeg(setJpegDpi(jpeg(), 300), icc)
    assert.deepEqual(readJpegIcc(out), icc)
    assert.deepEqual(readJpegDpi(out), { units: 1, x: 300, y: 300 })
  })

  test('Pillow відкриває результат: dpi = 300, профіль Adobe RGB', { skip: hasPillow ? false : 'немає python3 + Pillow' }, () => {
    const dir = tmp()
    try {
      const file = join(dir, 'a.jpg')
      writeFileSync(file, finalizeJpeg(jpeg(), 300, iccProfile('adobe_rgb')))
      const r = spawnSync('python3', [
        '-c',
        `import io,sys
from PIL import Image, ImageCms
im = Image.open(sys.argv[1]); im.load()
p = ImageCms.ImageCmsProfile(io.BytesIO(im.info['icc_profile']))
print(im.info['dpi'][0], ImageCms.getProfileDescription(p).strip())`,
        file,
      ], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stdout.trim(), /^300(\.0)? Adobe RGB \(1998\) compatible/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ICC-профілі', () => {
  for (const kind of ['srgb', 'adobe_rgb'] as const) {
    test(`${kind}: заголовок і таблиця тегів коректні`, () => {
      const icc = iccProfile(kind)
      const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength)
      assert.equal(view.getUint32(0), icc.length)
      assert.equal(String.fromCharCode(...icc.subarray(36, 40)), 'acsp')
      assert.equal(String.fromCharCode(...icc.subarray(12, 16)), 'mntr')
      const count = view.getUint32(128)
      assert.equal(count, 9)
      for (let i = 0; i < count; i++) {
        const offset = view.getUint32(132 + i * 12 + 4)
        const size = view.getUint32(132 + i * 12 + 8)
        assert.ok(offset % 4 === 0 && offset + size <= icc.length)
      }
    })
  }

  test('LittleCMS (через Pillow) будує перетворення sRGB-профілю → наш Adobe RGB', { skip: hasPillow ? false : 'немає python3 + Pillow' }, () => {
    const dir = tmp()
    try {
      writeFileSync(join(dir, 'a.icc'), iccProfile('adobe_rgb'))
      writeFileSync(join(dir, 's.icc'), iccProfile('srgb'))
      const r = spawnSync('python3', [
        '-c',
        `import sys
from PIL import Image, ImageCms
src = ImageCms.getOpenProfile(sys.argv[1]); dst = ImageCms.getOpenProfile(sys.argv[2])
t = ImageCms.buildTransform(src, dst, 'RGB', 'RGB', renderingIntent=1)
print(*ImageCms.applyTransform(Image.new('RGB', (1, 1), (255, 0, 0)), t).getpixel((0, 0)))`,
        join(dir, 's.icc'),
        join(dir, 'a.icc'),
      ], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      const [red, green, blue] = r.stdout.trim().split(' ').map(Number)
      // Червоний sRGB в Adobe RGB ≈ (219, 0, 0).
      assert.ok(Math.abs(red! - 219) <= 2 && green! <= 2 && blue! <= 2, r.stdout)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('sRGB → Adobe RGB', () => {
  test('білий/чорний/сірий лишаються нейтральними, червоний ≈ (219, 0, 0)', () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 255, 0, 0, 128])
    srgbToAdobeRgbInPlace(px)
    assert.deepEqual([...px.subarray(0, 8)], [255, 255, 255, 255, 0, 0, 0, 255])
    assert.equal(px[8], px[9])
    assert.equal(px[9], px[10])
    assert.ok(Math.abs(px[12]! - 219) <= 1 && px[13]! <= 1 && px[14]! <= 1, `${[...px.subarray(12)]}`)
    assert.equal(px[15], 128, 'альфа не змінюється')
  })
})

describe('PDF альбому', () => {
  const pages = () => [
    { jpeg: new Blob([jpeg()]), widthPx: 2000, heightPx: 1335, trimWidthMm: 600, trimHeightMm: 300, bleedMm: 3 },
    { jpeg: new Blob([jpeg()]), widthPx: 2000, heightPx: 1335, trimWidthMm: 600, trimHeightMm: 300, bleedMm: 3 },
  ]

  test('xref вказує точно на об’єкти; бокси з вильотом', async () => {
    const blob = await buildAlbumPdf(pages(), { title: 'Весілля Ані й Тараса', cropMarks: false, icc: iccProfile('srgb'), date: new Date(0) })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = Buffer.from(bytes).toString('latin1')
    assert.ok(text.startsWith('%PDF-1.6'))
    const startxref = Number(text.match(/startxref\n(\d+)/)![1])
    assert.ok(text.slice(startxref).startsWith('xref'))
    const rows = text.slice(startxref).split('\n').slice(3).filter((l) => / n $/.test(l))
    assert.equal(rows.length, 4 + 2 * 3)
    rows.forEach((row, i) => {
      const at = Number(row.slice(0, 10))
      assert.ok(text.startsWith(`${i + 1} 0 obj`, at), `об’єкт ${i + 1}`)
    })
    const w = mmToPt(606)
    assert.match(text, new RegExp(`/MediaBox \\[0 0 ${(Math.round(w * 1000) / 1000).toString().replace('.', '\\.')} `))
    assert.match(text, /\/TrimBox \[8\.504 8\.504 /)
    assert.match(text, /\/Filter \/DCTDecode/)
    assert.match(text, /\/ColorSpace \[\/ICCBased 3 0 R\]/)
  })

  test('pdfinfo читає 2 сторінки потрібного розміру, з мітками обрізу сторінка більша', { skip: hasPdfinfo ? false : 'немає pdfinfo' }, async () => {
    const dir = tmp()
    try {
      for (const marks of [false, true]) {
        const blob = await buildAlbumPdf(pages(), { title: 'A', cropMarks: marks, icc: iccProfile('srgb') })
        const file = join(dir, `a-${marks}.pdf`)
        writeFileSync(file, new Uint8Array(await blob.arrayBuffer()))
        const r = spawnSync('pdfinfo', ['-box', file], { encoding: 'utf8' })
        assert.equal(r.status, 0, r.stderr)
        assert.match(r.stdout, /Pages:\s+2/)
        const extra = marks ? 2 * MARK_AREA_MM : 0
        const size = r.stdout.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/)!
        assert.ok(Math.abs(Number(size[1]) - mmToPt(606 + extra)) < 0.01, size[0])
        assert.ok(Math.abs(Number(size[2]) - mmToPt(306 + extra)) < 0.01, size[0])
        const trim = r.stdout.match(/TrimBox:\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)!
        assert.ok(Math.abs(Number(trim[3]) - Number(trim[1]) - mmToPt(600)) < 0.01, trim[0])
        assert.doesNotMatch(r.stderr, /Syntax Error|Error/)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('PSD розвороту', () => {
  test('шар на кожне фото + фон, роздільна здатність і ICC у ресурсах', () => {
    const W = 64
    const H = 32
    const composite = new Uint8ClampedArray(W * H * 4).fill(200)
    const layer = (w: number, h: number, v: number) => new Uint8ClampedArray(w * h * 4).fill(v)
    const bytes = buildSpreadPsd({
      width: W,
      height: H,
      dpi: 300,
      icc: iccProfile('srgb'),
      composite,
      background: [255, 255, 255],
      layers: [
        { name: 'Фото 1 — a.jpg', left: 0, top: 0, width: 30, height: 32, data: layer(30, 32, 90) },
        { name: 'Фото 2 — b.jpg', left: 34, top: 4, width: 30, height: 24, data: layer(30, 24, 160) },
      ],
    })
    const psd = readPsd(bytes, { useImageData: true, skipThumbnail: true, skipCompositeImageData: true, skipLayerImageData: true })
    assert.equal(psd.width, W)
    assert.equal(psd.height, H)
    assert.deepEqual(psd.children!.map((l) => l.name), ['Фон', 'Фото 1 — a.jpg', 'Фото 2 — b.jpg'])
    assert.deepEqual([psd.children![2]!.left, psd.children![2]!.top, psd.children![2]!.right], [34, 4, 64])
    assert.equal(psd.imageResources!.resolutionInfo!.horizontalResolution, 300)
    assert.deepEqual(psd.imageResources!.iccProfile, iccProfile('srgb'))
  })
})

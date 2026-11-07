/**
 * A small, dependency-free PDF writer for print-ready albums: one page per
 * spread, the spread JPEG embedded as-is (DCTDecode — no re-encode, no
 * decode in memory), MediaBox / BleedBox / TrimBox set, the colour profile
 * attached as an ICCBased colour space, optional crop marks.
 *
 * Memory: the output is assembled from Blob parts (the JPEGs stay Blobs the
 * browser may keep on disk), so a 40-spread album does not need one giant
 * ArrayBuffer the way general PDF libraries build it.
 */
import { mmToPt } from '../geometry'
import type { TextAlign } from '../types'
import { tjArray, toUnicodeCMap, widthsArray, type PdfFontData, type ShapedLine } from './pdf-fonts'

/** A text block on a page: already shaped with the embedded font subset. */
export interface PdfText {
  fontKey: string
  sizePt: number
  rgb: [number, number, number]
  /** Anchor in trim-relative mm (y down), rotation clockwise in degrees. */
  x: number
  y: number
  rotation: number
  align: TextAlign
  lineStepMm: number
  lines: ShapedLine[]
}

export interface PdfPage {
  jpeg: Blob
  widthPx: number
  heightPx: number
  /** Trim size and bleed, mm. The JPEG covers trim + bleed on every side. */
  trimWidthMm: number
  trimHeightMm: number
  bleedMm: number
  /** Live text over the image (the JPEG then carries photos only). */
  texts?: PdfText[]
}

export interface PdfOptions {
  title: string
  cropMarks: boolean
  icc: Uint8Array
  /** Embedded font subsets, referenced by PdfText.fontKey. */
  fonts?: { key: string; data: PdfFontData }[]
  /** Fixed in tests for reproducible bytes. */
  date?: Date
}

/** Slug area outside the bleed that holds crop marks. */
export const MARK_AREA_MM = 10
const MARK_OFFSET_MM = 2 // gap between the bleed edge and a mark
const MARK_LINE_PT = 0.25

const enc = new TextEncoder()
const f = (n: number) => (Math.round(n * 1000) / 1000).toString()

function pdfString(text: string): string {
  // UTF-16BE with BOM, hex-encoded: safe for Ukrainian titles.
  let hex = 'FEFF'
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code > 0xffff) {
      const v = code - 0x10000
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0')
    } else {
      hex += code.toString(16).padStart(4, '0')
    }
  }
  return `<${hex.toUpperCase()}>`
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`
}

/** Crop-mark drawing operators for one page (in points). */
export function cropMarkOps(trimX: number, trimY: number, trimW: number, trimH: number, bleedPt: number): string {
  const off = bleedPt + mmToPt(MARK_OFFSET_MM)
  const len = mmToPt(MARK_AREA_MM - MARK_OFFSET_MM - 1)
  const lines: string[] = []
  const xs = [trimX, trimX + trimW]
  const ys = [trimY, trimY + trimH]
  for (const x of xs) {
    // vertical marks above and below
    lines.push(`${f(x)} ${f(trimY - off)} m ${f(x)} ${f(trimY - off - len)} l S`)
    lines.push(`${f(x)} ${f(trimY + trimH + off)} m ${f(x)} ${f(trimY + trimH + off + len)} l S`)
  }
  for (const y of ys) {
    lines.push(`${f(trimX - off)} ${f(y)} m ${f(trimX - off - len)} ${f(y)} l S`)
    lines.push(`${f(trimX + trimW + off)} ${f(y)} m ${f(trimX + trimW + off + len)} ${f(y)} l S`)
  }
  return `q ${MARK_LINE_PT} w 0 G\n${lines.join('\n')}\nQ`
}

const n3 = (n: number) => f(n)

/** Content-stream operators for live text (page coordinates in pt, y up). */
export function textOps(texts: PdfText[], trimX: number, trimTop: number, fontRes: Map<string, string>): string {
  const out: string[] = []
  for (const t of texts) {
    const res = fontRes.get(t.fontKey)
    if (!res || !t.lines.length) continue
    const a = (t.rotation * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const X = trimX + mmToPt(t.x)
    const Y = trimTop - mmToPt(t.y)
    const step = mmToPt(t.lineStepMm)
    out.push(`q ${n3(t.rgb[0] / 255)} ${n3(t.rgb[1] / 255)} ${n3(t.rgb[2] / 255)} rg`)
    // Clockwise visual rotation = −θ in PDF's y-up space.
    out.push(`${n3(cos)} ${n3(-sin)} ${n3(sin)} ${n3(cos)} ${n3(X)} ${n3(Y)} cm`)
    out.push(`BT /${res} ${n3(t.sizePt)} Tf`)
    t.lines.forEach((line, i) => {
      const w = (line.width1000 / 1000) * t.sizePt
      const sx = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0
      out.push(`1 0 0 1 ${n3(sx)} ${n3(-i * step)} Tm ${tjArray(line)} TJ`)
    })
    out.push('ET Q')
  }
  return out.join('\n')
}

export async function buildAlbumPdf(pages: PdfPage[], options: PdfOptions): Promise<Blob> {
  const parts: BlobPart[] = []
  let size = 0
  const offsets: number[] = [] // object number → byte offset (index = number)
  const push = (part: string | Uint8Array | Blob) => {
    if (typeof part === 'string') {
      const bytes = enc.encode(part)
      parts.push(bytes)
      size += bytes.length
    } else if (part instanceof Uint8Array) {
      parts.push(part as Uint8Array<ArrayBuffer>)
      size += part.length
    } else {
      parts.push(part)
      size += part.size
    }
  }
  const begin = (num: number) => {
    offsets[num] = size
    push(`${num} 0 obj\n`)
  }

  // Header + a comment with high-bit bytes, so tools treat the file as binary.
  push('%PDF-1.6\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  // Fixed objects: 1 catalog, 2 pages, 3 ICC, 4 info; then 3 per page.
  const ICC = 3
  const INFO = 4
  const fonts = options.fonts ?? []
  const FONT_OBJS = 5 // Type0, CIDFont, descriptor, FontFile2, ToUnicode
  const fontObj = (i: number) => 5 + i * FONT_OBJS
  const fontRes = new Map(fonts.map((font, i) => [font.key, `F${i + 1}`]))
  const fontDict = fonts.length ? ` /Font << ${fonts.map((_, i) => `/F${i + 1} ${fontObj(i)} 0 R`).join(' ')} >>` : ''
  const firstPageObj = 5 + fonts.length * FONT_OBJS
  const pageObj = (i: number) => firstPageObj + i * 3

  begin(1)
  push(`<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)

  begin(2)
  push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`)

  begin(ICC)
  push(`<< /N 3 /Alternate /DeviceRGB /Length ${options.icc.length} >>\nstream\n`)
  push(options.icc)
  push(`\nendstream\nendobj\n`)

  begin(INFO)
  const date = pdfDate(options.date ?? new Date())
  push(`<< /Title ${pdfString(options.title)} /Producer (proYav album builder) /CreationDate ${date} /ModDate ${date} >>\nendobj\n`)

  for (let i = 0; i < fonts.length; i++) {
    const { data } = fonts[i]!
    const base = fontObj(i)
    const name = data.postscriptName
    begin(base)
    push(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${base + 1} 0 R] /ToUnicode ${base + 4} 0 R >>\nendobj\n`)
    begin(base + 1)
    push(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>` +
        ` /FontDescriptor ${base + 2} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${widthsArray(data.widths)}] >>\nendobj\n`
    )
    begin(base + 2)
    push(
      `<< /Type /FontDescriptor /FontName /${name} /Flags ${data.flags} /FontBBox [${data.bbox.join(' ')}] /ItalicAngle ${data.italicAngle}` +
        ` /Ascent ${data.ascent} /Descent ${data.descent} /CapHeight ${data.capHeight} /StemV 80 /FontFile2 ${base + 3} 0 R >>\nendobj\n`
    )
    begin(base + 3)
    push(`<< /Length ${data.file.length} /Length1 ${data.file.length} >>\nstream\n`)
    push(data.file)
    push(`\nendstream\nendobj\n`)
    const cmap = enc.encode(toUnicodeCMap(data.unicode))
    begin(base + 4)
    push(`<< /Length ${cmap.length} >>\nstream\n`)
    push(cmap)
    push(`\nendstream\nendobj\n`)
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    const slug = options.cropMarks ? mmToPt(MARK_AREA_MM) : 0
    const bleed = mmToPt(page.bleedMm)
    const trimW = mmToPt(page.trimWidthMm)
    const trimH = mmToPt(page.trimHeightMm)
    const mediaW = trimW + 2 * (bleed + slug)
    const mediaH = trimH + 2 * (bleed + slug)
    const trimX = slug + bleed
    const trimY = slug + bleed
    const pObj = pageObj(i)
    const cObj = pObj + 1
    const iObj = pObj + 2

    let content = `q ${f(trimW + 2 * bleed)} 0 0 ${f(trimH + 2 * bleed)} ${f(slug)} ${f(slug)} cm /Im0 Do Q`
    if (page.texts?.length) content += `\n${textOps(page.texts, trimX, trimY + trimH, fontRes)}`
    if (options.cropMarks) content += `\n${cropMarkOps(trimX, trimY, trimW, trimH, bleed)}`
    const contentBytes = enc.encode(content)

    begin(pObj)
    push(
      `<< /Type /Page /Parent 2 0 R` +
        ` /MediaBox [0 0 ${f(mediaW)} ${f(mediaH)}]` +
        ` /BleedBox [${f(slug)} ${f(slug)} ${f(mediaW - slug)} ${f(mediaH - slug)}]` +
        ` /TrimBox [${f(trimX)} ${f(trimY)} ${f(trimX + trimW)} ${f(trimY + trimH)}]` +
        ` /Resources << /XObject << /Im0 ${iObj} 0 R >>${fontDict} >>` +
        ` /Contents ${cObj} 0 R >>\nendobj\n`
    )

    begin(cObj)
    push(`<< /Length ${contentBytes.length} >>\nstream\n`)
    push(contentBytes)
    push(`\nendstream\nendobj\n`)

    begin(iObj)
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx}` +
        ` /ColorSpace [/ICCBased ${ICC} 0 R] /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.size} >>\nstream\n`
    )
    push(page.jpeg)
    push(`\nendstream\nendobj\n`)
  }

  const count = firstPageObj + pages.length * 3
  const xref = size
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  push(table)
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${INFO} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

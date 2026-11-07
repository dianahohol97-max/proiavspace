/**
 * Real text in the album PDF: each font used is embedded whole (CIDFontType2,
 * Identity-H, CID = the font's own glyph id, CIDToGIDMap /Identity) with a
 * ToUnicode map, so Cyrillic stays selectable/searchable and prints with the
 * exact outlines. Shaping (kerning, ligatures) comes from fontkit
 * (@pdf-lib/fontkit, MIT) — the same OpenType features the browser applies on
 * canvas.
 *
 * Why whole fonts, not subsets: fontkit's TrueType subsetter writes broken
 * glyph data for several of our fonts (Cormorant, Great Vibes — glyphs
 * vanish in the PDF). A whole font costs 0.1–0.7 MB per family in a print
 * PDF of hundreds of MB; correctness wins.
 */
import type { Font, Glyph } from '@pdf-lib/fontkit'

export interface ShapedLine {
  /** Glyph ids (CIDs). */
  cids: number[]
  /** TJ adjustment after each glyph, in 1/1000 em (kerning). */
  adjust: number[]
  /** Line width in em (1000 units). */
  width1000: number
}

export interface PdfFontData {
  postscriptName: string
  /** The TrueType file embedded as FontFile2. */
  file: Uint8Array
  /** Advance per used CID, 1000 units. */
  widths: Map<number, number>
  /** CID → unicode text it stands for. */
  unicode: Map<number, string>
  ascent: number
  descent: number
  capHeight: number
  bbox: [number, number, number, number]
  italicAngle: number
  /** PDF font descriptor flags (symbolic + serif/script hints). */
  flags: number
}

export class FontSubsetter {
  private readonly scale: number
  private readonly widths = new Map<number, number>()
  private readonly unicode = new Map<number, string>()

  constructor(
    private readonly font: Font,
    private readonly kind: 'serif' | 'sans' | 'script' = 'serif',
    private readonly file?: Uint8Array
  ) {
    this.scale = 1000 / font.unitsPerEm
  }

  private cid(glyph: Glyph): number {
    const id = glyph.id
    if (!this.widths.has(id)) this.widths.set(id, Math.round(glyph.advanceWidth * this.scale))
    if (!this.unicode.has(id) && glyph.codePoints?.length) this.unicode.set(id, String.fromCodePoint(...glyph.codePoints))
    return id
  }

  shape(text: string): ShapedLine {
    const run = this.font.layout(text)
    const cids: number[] = []
    const adjust: number[] = []
    let width = 0
    run.glyphs.forEach((glyph, i) => {
      const cid = this.cid(glyph)
      const advance = (run.positions[i]?.xAdvance ?? glyph.advanceWidth) * this.scale
      cids.push(cid)
      // Kerning: the TJ number moves the next glyph left by n/1000 em.
      adjust.push(Math.round(this.widths.get(cid)! - advance))
      width += advance
    })
    return { cids, adjust, width1000: width }
  }

  async finish(): Promise<PdfFontData> {
    const f = this.font
    const s = this.scale
    const b = f.bbox
    let flags = 4 // symbolic (custom encoding)
    if (this.kind === 'serif') flags |= 2
    if (this.kind === 'script') flags |= 8
    const file = this.file ?? (f as unknown as { stream?: { buffer?: Uint8Array } }).stream?.buffer
    if (!file) throw new Error('немає файла шрифту для вбудовування')
    return {
      postscriptName: (f.postscriptName ?? 'AlbumFont').replace(/[^A-Za-z0-9-]/g, ''),
      file,
      widths: this.widths,
      unicode: this.unicode,
      ascent: Math.round(f.ascent * s),
      descent: Math.round(f.descent * s),
      capHeight: Math.round((f.capHeight || f.ascent * 0.7) * s),
      bbox: [Math.round(b.minX * s), Math.round(b.minY * s), Math.round(b.maxX * s), Math.round(b.maxY * s)],
      italicAngle: f.italicAngle || 0,
      flags,
    }
  }
}

/** /W array: «cid [w] cid [w] …» for the glyphs actually used. */
export function widthsArray(widths: Map<number, number>): string {
  return [...widths.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cid, w]) => `${cid} [${w}]`)
    .join(' ')
}

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0')

function utf16Hex(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code > 0xffff) {
      const v = code - 0x10000
      out += hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff))
    } else out += hex4(code)
  }
  return out
}

/** ToUnicode CMap stream content. */
export function toUnicodeCMap(unicode: Map<number, string>): string {
  const entries = [...unicode.entries()].sort((a, b) => a[0] - b[0])
  const chunks: string[] = []
  for (let i = 0; i < entries.length; i += 100) {
    const part = entries.slice(i, i + 100)
    chunks.push(`${part.length} beginbfchar\n${part.map(([cid, text]) => `<${hex4(cid)}> <${utf16Hex(text)}>`).join('\n')}\nendbfchar`)
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...chunks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n')
}

/** TJ operand for a shaped line. */
export function tjArray(line: ShapedLine): string {
  const parts: string[] = []
  let run = ''
  line.cids.forEach((cid, i) => {
    run += hex4(cid)
    const adj = line.adjust[i]!
    if (adj !== 0 && i < line.cids.length - 1) {
      parts.push(`<${run}>`, String(adj))
      run = ''
    }
  })
  if (run) parts.push(`<${run}>`)
  return `[${parts.join(' ')}]`
}

/** fontkit's create(), whichever module shape the bundler hands over (ESM default vs CJS). */
export async function fontkitCreate(): Promise<(bytes: Uint8Array) => Font> {
  const mod = (await import('@pdf-lib/fontkit')) as unknown as { create?: (b: Uint8Array) => Font; default?: { create: (b: Uint8Array) => Font } }
  const create = mod.create ?? mod.default?.create
  if (!create) throw new Error('fontkit недоступний')
  return create
}

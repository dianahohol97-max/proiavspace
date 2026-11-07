/**
 * Minimal TIFF/EXIF walker for RAW containers (CR2, NEF, ARW, DNG, ORF, RW2,
 * PEF…) and for EXIF blocks inside JPEGs and CR3. It only follows the
 * pointers that can lead to an embedded JPEG preview or to the capture time;
 * pixel data is never touched.
 */
import { View, type RangeReader } from './reader'

export interface JpegCandidate {
  /** Absolute offset of the JPEG (SOI) in the file. */
  offset: number
  length: number
  /** From the container, when it says so (verified against the SOF later). */
  width?: number
  height?: number
  source: string
}

export interface TiffInfo {
  little: boolean
  make?: string
  model?: string
  orientation?: number
  /** "YYYY:MM:DD HH:MM:SS" (+ sub-seconds) as written by the camera. */
  dateTimeOriginal?: string
  subSec?: string
  candidates: JpegCandidate[]
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 }
const MAX_ENTRIES = 1000
const MAX_IFDS = 40

interface Entry {
  tag: number
  type: number
  count: number
  /** Offset (relative to the TIFF base) of the value, or of the inline 4 bytes. */
  valueAt: number
  inline: boolean
}

export class Tiff {
  private visited = new Set<number>()
  readonly info: TiffInfo

  /**
   * @param base absolute offset of the TIFF header ("II*\0" / "MM\0*" / ORF / RW2 magic)
   */
  constructor(
    private reader: RangeReader,
    private base: number,
    private little: boolean
  ) {
    this.info = { little, candidates: [] }
  }

  static async open(reader: RangeReader, base = 0): Promise<Tiff | null> {
    if (base + 8 > reader.size) return null
    const h = await reader.read(base, 8)
    const order = String.fromCharCode(h[0], h[1])
    if (order !== 'II' && order !== 'MM') return null
    const little = order === 'II'
    const v = new View(h, little)
    const magic = v.u16(2)
    // 42 = TIFF; 0x4F52/0x5352 = Olympus ORF ("IIRO"/"IIRS", "MMOR"); 0x55 = Panasonic RW2.
    if (![42, 0x4f52, 0x5352, 0x524f, 0x55].includes(magic)) return null
    return new Tiff(reader, base, little)
  }

  async firstIfdOffset(): Promise<number> {
    const h = await this.reader.read(this.base, 8)
    return new View(h, this.little).u32(4)
  }

  private async readEntries(ifdOffset: number): Promise<{ entries: Entry[]; next: number } | null> {
    const abs = this.base + ifdOffset
    if (ifdOffset < 8 || abs + 2 > this.reader.size) return null
    const head = await this.reader.read(abs, 2)
    const count = new View(head, this.little).u16(0)
    if (count === 0 || count > MAX_ENTRIES || abs + 2 + count * 12 + 4 > this.reader.size) return null
    const raw = await this.reader.read(abs + 2, count * 12 + 4)
    const v = new View(raw, this.little)
    const entries: Entry[] = []
    for (let i = 0; i < count; i++) {
      const p = i * 12
      const type = v.u16(p + 2)
      const cnt = v.u32(p + 4)
      const size = (TYPE_SIZE[type] ?? 1) * cnt
      const inline = size <= 4
      entries.push({ tag: v.u16(p), type, count: cnt, inline, valueAt: inline ? ifdOffset + 2 + p + 8 : v.u32(p + 8) })
    }
    return { entries, next: v.u32(count * 12) }
  }

  /** Numeric values (SHORT/LONG/IFD; first `max`). */
  async numbers(e: Entry, max = 64): Promise<number[]> {
    const n = Math.min(e.count, max)
    const size = TYPE_SIZE[e.type] ?? 1
    if (this.base + e.valueAt + n * size > this.reader.size) return []
    const bytes = await this.reader.read(this.base + e.valueAt, n * size)
    const v = new View(bytes, this.little)
    const out: number[] = []
    for (let i = 0; i < n; i++) out.push(size === 2 ? v.u16(i * 2) : size === 4 ? v.u32(i * 4) : v.u8(i))
    return out
  }

  async text(e: Entry): Promise<string> {
    const n = Math.min(e.count, 256)
    if (this.base + e.valueAt + n > this.reader.size) return ''
    const bytes = await this.reader.read(this.base + e.valueAt, n)
    return new View(bytes, this.little).ascii(0, n).trim()
  }

  /** Orientation tag of one IFD only (no walking). */
  async orientationOf(ifdOffset: number): Promise<number | undefined> {
    const listed = await this.readEntries(ifdOffset)
    const e = listed?.entries.find((x) => x.tag === 0x112)
    return e ? (await this.numbers(e, 1))[0] : undefined
  }

  /** Walks IFD0 → next IFDs, SubIFDs and the EXIF IFD. */
  async walk(firstIfd?: number): Promise<TiffInfo> {
    const start = firstIfd ?? (await this.firstIfdOffset())
    let ifd = start
    let index = 0
    while (ifd && index < MAX_IFDS) {
      await this.walkIfd(ifd, `ifd${index}`, index === 0)
      const listed = await this.readEntries(ifd)
      ifd = listed?.next ?? 0
      index++
    }
    return this.info
  }

  /** Reads an IFD whose entries are EXIF tags (EXIF IFD, CR3 CMT2). */
  async walkExif(ifdOffset: number) {
    await this.walkIfd(ifdOffset, 'exif', false)
  }

  private async walkIfd(ifdOffset: number, name: string, top: boolean): Promise<void> {
    if (this.visited.has(ifdOffset) || this.visited.size > MAX_IFDS) return
    this.visited.add(ifdOffset)
    const listed = await this.readEntries(ifdOffset)
    if (!listed) return
    const tags = new Map(listed.entries.map((e) => [e.tag, e]))
    const num = async (tag: number) => {
      const e = tags.get(tag)
      return e ? (await this.numbers(e, 1))[0] : undefined
    }
    const info = this.info

    if (top) {
      if (tags.has(0x10f)) info.make ??= await this.text(tags.get(0x10f)!)
      if (tags.has(0x110)) info.model ??= await this.text(tags.get(0x110)!)
      const o = await num(0x112)
      if (o && info.orientation === undefined) info.orientation = o
    }
    if (tags.has(0x9003)) info.dateTimeOriginal ??= await this.text(tags.get(0x9003)!)
    if (tags.has(0x9291)) info.subSec ??= await this.text(tags.get(0x9291)!)
    // Fallback capture time: IFD0 DateTime.
    if (top && tags.has(0x132) && !info.dateTimeOriginal) {
      const dt = await this.text(tags.get(0x132)!)
      if (dt) info.dateTimeOriginal = dt
    }

    const width = await num(0x100)
    const height = await num(0x101)
    // (a) JPEGInterchangeFormat / Length
    const jOff = await num(0x201)
    const jLen = await num(0x202)
    if (jOff && jLen) info.candidates.push({ offset: this.base + jOff, length: jLen, source: `${name}:0x201` })
    // (b) a single JPEG-compressed strip (CR2 IFD0, DNG previews).
    const compression = await num(0x103)
    if ((compression === 6 || compression === 7) && tags.has(0x111) && tags.has(0x117)) {
      const offsets = await this.numbers(tags.get(0x111)!, 2)
      const counts = await this.numbers(tags.get(0x117)!, 2)
      if (offsets.length === 1 && counts.length === 1 && counts[0] > 0) {
        info.candidates.push({ offset: this.base + offsets[0], length: counts[0], width, height, source: `${name}:strip` })
      }
    }
    // (c) Panasonic RW2: JpgFromRaw blob in IFD0.
    const rw2 = tags.get(0x2e)
    if (rw2 && !rw2.inline && rw2.count > 0) info.candidates.push({ offset: this.base + rw2.valueAt, length: rw2.count, source: 'rw2:0x2e' })
    const subIfds = tags.get(0x14a)
    if (subIfds) for (const sub of await this.numbers(subIfds, 8)) await this.walkIfd(sub, `${name}.sub`, false)
    const exif = await num(0x8769)
    if (exif) await this.walkIfd(exif, 'exif', false)
    const maker = tags.get(0x927c)
    if (maker && !maker.inline) await this.walkMakerNote(maker)
  }

  /** Olympus/OM maker note: preview lives in CameraSettings (0x2020). */
  private async walkMakerNote(e: Entry) {
    const at = this.base + e.valueAt
    if (at + 16 > this.reader.size) return
    const head = await this.reader.read(at, 16)
    const sig = new View(head, true).ascii(0, 12)
    let noteBase: number
    let ifd: number
    let little = this.little
    if (sig.startsWith('OLYMPUS') || sig.startsWith('OM SYSTEM')) {
      // "OLYMPUS\0" "II" 0x0300 → IFD at +12, offsets relative to the note.
      const hdr = sig.startsWith('OM SYSTEM') ? 16 : 12
      const order = String.fromCharCode(head[hdr - 4], head[hdr - 3])
      little = order !== 'MM'
      noteBase = at
      ifd = hdr
    } else if (sig.startsWith('OLYMP')) {
      noteBase = this.base
      ifd = e.valueAt + 8
    } else {
      return
    }
    const note = new Tiff(this.reader, noteBase, little)
    note.info.candidates = this.info.candidates
    const listed = await note.readEntries(ifd)
    if (!listed) return
    const cs = listed.entries.find((x) => x.tag === 0x2020)
    if (!cs) return
    const csOffset = cs.type === 13 || cs.type === 4 ? (await note.numbers(cs, 1))[0] : cs.valueAt
    const sub = await note.readEntries(csOffset)
    if (!sub) return
    const get = async (tag: number) => {
      const x = sub.entries.find((y) => y.tag === tag)
      return x ? (await note.numbers(x, 1))[0] : undefined
    }
    const start = await get(0x101)
    const length = await get(0x102)
    if (start && length) this.info.candidates.push({ offset: noteBase + start, length, source: 'olympus:0x2020' })
  }
}

/** "2024:05:04 14:03:22" + ".57" → epoch ms (as local wall time; only differences matter). */
export function exifDateToMs(dt?: string, subSec?: string): number | null {
  if (!dt) return null
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(dt)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m.map(Number)
  if (y < 1990) return null
  const ms = Date.UTC(y, mo - 1, d, h, mi, s)
  const frac = subSec && /^\d+$/.test(subSec) ? Number(`0.${subSec}`) * 1000 : 0
  return ms + Math.round(frac)
}

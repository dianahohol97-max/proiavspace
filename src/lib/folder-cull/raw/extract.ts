/**
 * Finds the embedded JPEG previews (and capture time / orientation) in a RAW
 * or JPEG file without decoding the RAW and without reading the file whole.
 *
 *   TIFF-based: CR2, NEF, ARW, DNG, ORF (maker note), RW2 (JpgFromRaw), PEF, SRW
 *   CR3: ISO-BMFF — PRVW box (~1620 px) and the full-size JPEG track
 *   RAF: Fujifilm header → embedded JPEG (with its own EXIF)
 *   JPEG: the file itself
 *
 * Every candidate is verified by its own SOF header: only JPEGs a browser can
 * decode (baseline/progressive) count, so CR2's lossless raw strip is ignored.
 */
import { readJpegHeader } from './jpeg'
import { asciiAt, View, type RangeReader } from './reader'
import { exifDateToMs, Tiff, type JpegCandidate } from './tiff'

export const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'raf', 'dng', 'orf', 'rw2', 'pef', 'srw'] as const
export const JPEG_EXTENSIONS = ['jpg', 'jpeg'] as const
export const HEIF_EXTENSIONS = ['heic', 'heif'] as const

export type FileKind = 'raw' | 'jpeg' | 'heif'

export function kindOf(name: string): FileKind | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if ((RAW_EXTENSIONS as readonly string[]).includes(ext)) return 'raw'
  if ((JPEG_EXTENSIONS as readonly string[]).includes(ext)) return 'jpeg'
  if ((HEIF_EXTENSIONS as readonly string[]).includes(ext)) return 'heif'
  return null
}

export interface EmbeddedJpeg {
  offset: number
  length: number
  width: number
  height: number
}

export interface PreviewInfo {
  format: string
  /** The smallest preview with a long side ≥ MIN_LONG_SIDE (or the largest one). */
  preview: EmbeddedJpeg
  /** The largest preview — for the 100 % focus check. */
  full: EmbeddedJpeg
  /** EXIF orientation of the RAW (1 = as stored). */
  orientation: number
  takenAt: number | null
  make?: string
  model?: string
  candidates: number
}

export const MIN_LONG_SIDE = 1000

interface Box {
  type: string
  start: number
  body: number
  end: number
}

async function boxes(reader: RangeReader, start: number, end: number, limit = 64): Promise<Box[]> {
  const out: Box[] = []
  let p = start
  while (p + 8 <= end && out.length < limit) {
    const h = await reader.read(p, Math.min(16, end - p))
    const v = new View(h, false)
    let size = v.u32(0)
    const type = asciiAt(h, 4, 4)
    let header = 8
    if (size === 1 && h.length >= 16) {
      size = v.u32(8) * 2 ** 32 + v.u32(12)
      header = 16
    } else if (size === 0) {
      size = end - p
    }
    if (size < header || p + size > end) break
    out.push({ type, start: p, body: p + header, end: p + size })
    p += size
  }
  return out
}

async function uuidOf(reader: RangeReader, box: Box): Promise<string> {
  const u = await reader.read(box.body, 16)
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CANON_META_UUID = '85c0b687820f11e08111f4ce462b6a48'
const CANON_PRVW_UUID = 'eaf42b5e1c984b88b9fbb7dc406e4d16'

async function cr3(reader: RangeReader, info: { candidates: JpegCandidate[]; tiffs: Tiff[] }) {
  const top = await boxes(reader, 0, reader.size)
  for (const box of top) {
    if (box.type === 'uuid' && (await uuidOf(reader, box)) === CANON_PRVW_UUID) {
      // uuid(16) + 8 bytes, then the PRVW box: hdr(8) u32 u16 w(u16) h(u16) u16 size(u32) JPEG.
      const inner = await boxes(reader, box.body + 24, box.end)
      const prvw = inner.find((b) => b.type === 'PRVW')
      if (prvw) {
        const h = await reader.read(prvw.body, 16)
        const v = new View(h, false)
        const size = v.u32(12)
        info.candidates.push({ offset: prvw.body + 16, length: Math.min(size, prvw.end - prvw.body - 16), width: v.u16(6), height: v.u16(8), source: 'cr3:PRVW' })
      }
    }
    if (box.type !== 'moov') continue
    for (const child of await boxes(reader, box.body, box.end)) {
      if (child.type === 'uuid' && (await uuidOf(reader, child)) === CANON_META_UUID) {
        for (const meta of await boxes(reader, child.body + 16, child.end)) {
          if (meta.type === 'CMT1' || meta.type === 'CMT2') {
            const t = await Tiff.open(reader, meta.body)
            if (!t) continue
            if (meta.type === 'CMT1') await t.walk()
            else await t.walkExif(await t.firstIfdOffset())
            info.tiffs.push(t)
          }
        }
      }
      if (child.type === 'trak') {
        // trak/mdia/minf/stbl → first chunk offset + first sample size.
        const path = ['mdia', 'minf', 'stbl']
        let level: Box | undefined = child
        for (const name of path) {
          const kids: Box[] = await boxes(reader, level.body, level.end)
          level = kids.find((k) => k.type === name)
          if (!level) break
        }
        if (!level) continue
        const kids = await boxes(reader, level.body, level.end)
        const stsz = kids.find((k) => k.type === 'stsz')
        const co64 = kids.find((k) => k.type === 'co64')
        const stco = kids.find((k) => k.type === 'stco')
        if (!stsz || (!co64 && !stco)) continue
        const sz = new View(await reader.read(stsz.body, 16), false)
        const sampleSize = sz.u32(4) || sz.u32(12)
        let chunk: number
        if (co64) {
          const c = new View(await reader.read(co64.body, 16), false)
          chunk = c.u32(8) * 2 ** 32 + c.u32(12)
        } else {
          const c = new View(await reader.read(stco!.body, 12), false)
          chunk = c.u32(8)
        }
        if (chunk > 0 && sampleSize > 0 && chunk + sampleSize <= reader.size) {
          info.candidates.push({ offset: chunk, length: sampleSize, source: 'cr3:trak' })
        }
      }
    }
  }
}

/** Never throws: a broken or foreign file is just "no preview". */
export async function extractPreview(reader: RangeReader, name: string): Promise<PreviewInfo | null> {
  try {
    return await extractUnsafe(reader, name)
  } catch {
    return null
  }
}

async function extractUnsafe(reader: RangeReader, name: string): Promise<PreviewInfo | null> {
  const kind = kindOf(name)
  if (!kind || kind === 'heif') return null
  const head = await reader.read(0, Math.min(reader.size, 96))
  const collected = { candidates: [] as JpegCandidate[], tiffs: [] as Tiff[] }
  let format = name.toLowerCase().split('.').pop() ?? ''

  if (head[0] === 0xff && head[1] === 0xd8) {
    format = 'jpeg'
    collected.candidates.push({ offset: 0, length: reader.size, source: 'jpeg' })
  } else if (asciiAt(head, 0, 15) === 'FUJIFILMCCD-RAW') {
    format = 'raf'
    const v = new View(head, false)
    collected.candidates.push({ offset: v.u32(84), length: v.u32(88), source: 'raf' })
  } else if (asciiAt(head, 4, 4) === 'ftyp') {
    format = 'cr3'
    await cr3(reader, collected)
  } else {
    const t = await Tiff.open(reader, 0)
    if (!t) return null
    await t.walk()
    collected.tiffs.push(t)
    collected.candidates.push(...t.info.candidates)
  }
  for (const t of collected.tiffs) for (const c of t.info.candidates) if (!collected.candidates.includes(c)) collected.candidates.push(c)

  // Verify each candidate by its own header; dedupe by offset.
  const seen = new Set<number>()
  const valid: (EmbeddedJpeg & { exifTiff?: number })[] = []
  for (const c of collected.candidates) {
    if (seen.has(c.offset) || (c.offset <= 0 && format !== 'jpeg')) continue
    seen.add(c.offset)
    if (c.offset + c.length > reader.size || c.length < 128) continue
    const h = await readJpegHeader(reader, c.offset, c.length).catch(() => null)
    if (!h || !h.decodable || h.width < 16 || h.height < 16) continue
    valid.push({ offset: c.offset, length: c.length, width: h.width, height: h.height, exifTiff: h.exifTiff })
  }
  if (valid.length === 0) return null

  const long = (j: EmbeddedJpeg) => Math.max(j.width, j.height)
  const bySize = [...valid].sort((a, b) => a.width * a.height - b.width * b.height)
  const full = bySize[bySize.length - 1]
  const preview = bySize.find((j) => long(j) >= MIN_LONG_SIDE) ?? full

  // Capture time / orientation: the RAW's own tags first, then the JPEG's EXIF.
  let date: string | undefined
  let subSec: string | undefined
  let orientation: number | undefined
  let make: string | undefined
  let model: string | undefined
  for (const t of collected.tiffs) {
    date ??= t.info.dateTimeOriginal
    subSec ??= t.info.subSec
    orientation ??= t.info.orientation
    make ??= t.info.make
    model ??= t.info.model
  }
  if (!date || orientation === undefined) {
    for (const j of [preview, full, ...valid]) {
      if (j.exifTiff === undefined) continue
      const t = await Tiff.open(reader, j.exifTiff)
      if (!t) continue
      await t.walk().catch(() => undefined)
      date ??= t.info.dateTimeOriginal
      subSec ??= t.info.subSec
      // The JPEG's orientation applies to the JPEG; only use it when the RAW had none.
      orientation ??= t.info.orientation
      make ??= t.info.make
      model ??= t.info.model
      if (date) break
    }
  }
  const strip = ({ offset, length, width, height }: EmbeddedJpeg) => ({ offset, length, width, height })
  return {
    format,
    preview: strip(preview),
    full: strip(full),
    orientation: orientation && orientation >= 1 && orientation <= 8 ? orientation : 1,
    takenAt: exifDateToMs(date, subSec),
    make,
    model,
    candidates: valid.length,
  }
}

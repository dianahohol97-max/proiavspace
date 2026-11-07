/**
 * Capture time and orientation from a photo's EXIF, read in the browser at
 * upload time with exifr (MIT). Only the few tags we need are parsed, and the
 * library is a lazily loaded chunk: pages that never upload never fetch it.
 *
 * Capture time is stored as the camera's WALL-CLOCK time written as UTC
 * («2026:06:01 14:03:22» → 2026-06-01T14:03:22Z), with sub-seconds when the
 * camera writes them. Offsets (OffsetTimeOriginal) are deliberately ignored:
 * a wedding shot on a Canon that writes no offset and an iPhone that writes
 * +03:00 must still interleave by what the clocks showed, and one shoot
 * happens in one time zone. The value is for ORDERING, not for display in
 * another zone.
 */

export interface PhotoExif {
  /** ISO timestamp (wall clock as UTC), or null when the photo has none. */
  takenAt: string | null
  /** EXIF orientation 1–8, or null. */
  orientation: number | null
  /** Stored pixel size (before orientation), when the EXIF has it. */
  rawWidth?: number | null
  rawHeight?: number | null
}

const EXIF_DATE = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/

/**
 * «2026:06:01 14:03:22» (+ optional sub-seconds) → «2026-06-01T14:03:22.120Z».
 * Rejects the placeholders cameras write when the clock was never set
 * («0000:00:00 00:00:00»), impossible dates and anything before 1990.
 */
export function exifDateToIso(value: unknown, subSec?: unknown): string | null {
  let text: string | null = null
  if (typeof value === 'string') text = value.trim()
  else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exifr revives dates in the browser's zone; read the same wall clock back.
    const pad = (n: number) => String(n).padStart(2, '0')
    text = `${value.getFullYear()}:${pad(value.getMonth() + 1)}:${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  if (!text) return null
  const match = EXIF_DATE.exec(text)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 59) return null
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  // 31 February rolls over into March: not a real date.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null

  // Sub-seconds keep a burst in order: «12» means .12 s, «120» .120 s.
  const digits = String(subSec ?? '').trim().replace(/\D/g, '')
  if (digits) date.setUTCMilliseconds(Math.round(Number(`0.${digits}`) * 1000) % 1000)
  return date.toISOString()
}

/** Pick capture time and orientation from parsed EXIF tags. */
export function pickPhotoExif(tags: Record<string, unknown> | null | undefined): PhotoExif {
  if (!tags) return { takenAt: null, orientation: null }
  const takenAt =
    exifDateToIso(tags.DateTimeOriginal, tags.SubSecTimeOriginal) ??
    // CreateDate = DateTimeDigitized; ModifyDate is skipped on purpose: an
    // export from Lightroom stamps it with the export time.
    exifDateToIso(tags.CreateDate, tags.SubSecTimeDigitized)
  const raw = typeof tags.Orientation === 'number' ? tags.Orientation : Number(tags.Orientation)
  const orientation = Number.isInteger(raw) && raw >= 1 && raw <= 8 ? raw : null
  const side = (value: unknown) => (typeof value === 'number' && value > 0 && Number.isInteger(value) ? value : null)
  return { takenAt, orientation, rawWidth: side(tags.ExifImageWidth), rawHeight: side(tags.ExifImageHeight) }
}

/** Orientations 5–8 turn the picture by 90°: width and height swap. */
export function orientationSwapsSides(orientation: number | null | undefined): boolean {
  return !!orientation && orientation >= 5 && orientation <= 8
}

/** Is the timestamp a valid capture time we accept from a client? */
export function isValidTakenAt(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 40) return false
  const time = Date.parse(value)
  return !Number.isNaN(time) && time >= Date.UTC(1990, 0, 1) && time <= Date.UTC(2100, 0, 1)
}

/**
 * The TIFF block of a HEIF/HEIC file's «Exif» item, read straight from the
 * ISO-BMFF boxes (meta → iinf → iloc). exifr's own HEIF walker misreads the
 * item locations libheif writes (iloc with base_offset), so this is the
 * fallback: it handles iloc versions 0–2, base offsets and multi-extent
 * items. Returns null when there is no (reachable) Exif item.
 */
export function heifExifTiff(buffer: ArrayBuffer): Uint8Array | null {
  const view = new DataView(buffer)
  const size = buffer.byteLength
  const uint = (offset: number, bytes: number): number => {
    if (bytes === 0) return 0
    if (offset + bytes > size) throw new RangeError('out of bounds')
    if (bytes === 1) return view.getUint8(offset)
    if (bytes === 2) return view.getUint16(offset)
    if (bytes === 4) return view.getUint32(offset)
    if (bytes === 8) return Number(view.getBigUint64(offset))
    throw new RangeError('size')
  }
  const type = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4))
  type Box = { type: string; start: number; end: number }
  const children = (start: number, end: number): Box[] => {
    const boxes: Box[] = []
    let offset = start
    while (offset + 8 <= end) {
      let length = uint(offset, 4)
      let header = 8
      if (length === 1) {
        length = uint(offset + 8, 8)
        header = 16
      } else if (length === 0) length = end - offset
      if (length < header || offset + length > end) break
      boxes.push({ type: type(offset + 4), start: offset + header, end: offset + length })
      offset += length
    }
    return boxes
  }
  try {
    if (size < 12 || type(4) !== 'ftyp') return null
    const meta = children(0, size).find((box) => box.type === 'meta')
    if (!meta) return null
    // meta is a full box: 4 bytes of version + flags before its children
    const inside = children(meta.start + 4, meta.end)
    const iinf = inside.find((box) => box.type === 'iinf')
    const iloc = inside.find((box) => box.type === 'iloc')
    if (!iinf || !iloc) return null

    let exifId: number | null = null
    const iinfVersion = uint(iinf.start, 1)
    const entriesStart = iinf.start + 4 + (iinfVersion === 0 ? 2 : 4)
    for (const infe of children(entriesStart, iinf.end)) {
      if (infe.type !== 'infe') continue
      const version = uint(infe.start, 1)
      if (version < 2) continue
      const idSize = version === 3 ? 4 : 2
      const id = uint(infe.start + 4, idSize)
      if (type(infe.start + 4 + idSize + 2) === 'Exif') {
        exifId = id
        break
      }
    }
    if (exifId === null) return null

    const version = uint(iloc.start, 1)
    let offset = iloc.start + 4
    const sizes = uint(offset, 1)
    const more = uint(offset + 1, 1)
    offset += 2
    const offsetSize = sizes >> 4
    const lengthSize = sizes & 0xf
    const baseOffsetSize = more >> 4
    const indexSize = version === 1 || version === 2 ? more & 0xf : 0
    const countSize = version === 2 ? 4 : 2
    const itemCount = uint(offset, countSize)
    offset += countSize
    for (let item = 0; item < itemCount; item++) {
      const id = uint(offset, version === 2 ? 4 : 2)
      offset += version === 2 ? 4 : 2
      const construction = version === 1 || version === 2 ? uint(offset, 2) & 0xf : 0
      if (version === 1 || version === 2) offset += 2
      offset += 2 // data_reference_index
      const base = uint(offset, baseOffsetSize)
      offset += baseOffsetSize
      const extentCount = uint(offset, 2)
      offset += 2
      const extents: [number, number][] = []
      for (let e = 0; e < extentCount; e++) {
        offset += indexSize
        const extentOffset = uint(offset, offsetSize)
        offset += offsetSize
        const extentLength = uint(offset, lengthSize)
        offset += lengthSize
        extents.push([base + extentOffset, extentLength])
      }
      if (id !== exifId) continue
      if (construction !== 0) return null // idat / item-offset storage: not used for Exif in practice
      const parts = extents.map(([start, length]) => new Uint8Array(buffer, start, length || size - start))
      const total = parts.reduce((sum, part) => sum + part.length, 0)
      const data = new Uint8Array(total)
      let at = 0
      for (const part of parts) {
        data.set(part, at)
        at += part.length
      }
      // Exif item = 4-byte offset to the TIFF header (after «Exif\0\0») + data
      if (data.length < 12) return null
      const tiffStart = 4 + new DataView(data.buffer).getUint32(0)
      if (tiffStart + 8 > data.length) return null
      const tiff = data.subarray(tiffStart)
      const order = String.fromCharCode(tiff[0], tiff[1])
      return order === 'MM' || order === 'II' ? tiff : null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Reads the EXIF of an image file in the browser. Never throws: a file
 * without EXIF (PNG, a screenshot, a stripped export) just gives nulls.
 */
export async function readPhotoExif(file: Blob): Promise<PhotoExif> {
  try {
    const exifr = (await import('exifr')).default
    const options = {
      // Raw strings, not Date objects: the wall clock must not pass through
      // the browser's time zone.
      reviveValues: false,
      translateValues: false,
      pick: [
        'DateTimeOriginal',
        'SubSecTimeOriginal',
        'CreateDate',
        'SubSecTimeDigitized',
        'Orientation',
        'ExifImageWidth',
        'ExifImageHeight',
      ],
    }
    const parse = async (input: Blob | Uint8Array) =>
      pickPhotoExif((await exifr.parse(input, options).catch(() => undefined)) as Record<string, unknown> | undefined)
    const exif = await parse(file)
    if (exif.takenAt) return exif
    // HEIC whose item locations exifr misreads: hand it the Exif block itself.
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (String.fromCharCode(...head.slice(4, 8)) !== 'ftyp') return exif
    // The meta box (with the Exif location) is at the start, the Exif item
    // itself usually right after it or at the end of mdat: read the file.
    const tiff = heifExifTiff(await file.arrayBuffer())
    return tiff ? await parse(tiff) : exif
  } catch {
    return { takenAt: null, orientation: null }
  }
}

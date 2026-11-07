/**
 * Builds small synthetic RAW containers around real JPEG previews — the same
 * structures real cameras write (validated against real CC0 samples from
 * raw.pixls.us during development), but a few hundred KB instead of 20–130 MB.
 * Pixel data of the "raw" part is a few dummy bytes: the culling code never
 * decodes it.
 */

type Num = number[]
interface Ref {
  ref: string
}
interface Entry {
  tag: number
  type: number
  value: Num | string | Ref | Uint8Array
}
interface Ifd {
  name: string
  entries: Entry[]
  next?: string
}

const SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 7: 1, 13: 4 }

class Writer {
  bytes: number[] = []
  constructor(private little: boolean) {}
  u8(v: number) {
    this.bytes.push(v & 0xff)
  }
  u16(v: number) {
    if (this.little) this.bytes.push(v & 0xff, (v >> 8) & 0xff)
    else this.bytes.push((v >> 8) & 0xff, v & 0xff)
  }
  u32(v: number) {
    const b = [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
    this.bytes.push(...(this.little ? b.reverse() : b))
  }
  raw(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.bytes.push(b[i])
  }
  get length() {
    return this.bytes.length
  }
}

/**
 * Lays out: header, IFDs (each followed by its out-of-line values), blobs.
 * Offsets are relative to the start of the output (+ `origin`, for blocks
 * embedded at a known position, e.g. maker notes whose offsets are relative
 * to the note itself → origin 0).
 */
export function buildTiff(opts: {
  little?: boolean
  header: (firstIfd: number, w: Writer) => void
  headerSize: number
  ifds: Ifd[]
  blobs?: Record<string, Uint8Array>
}): Uint8Array {
  const little = opts.little ?? true
  const blobs = opts.blobs ?? {}
  const valueSize = (e: Entry) => {
    if (typeof e.value === 'string') return e.value.length + 1
    if (e.value instanceof Uint8Array) return e.value.length
    if ('ref' in e.value) return 4
    return (e.value as Num).length * (SIZE[e.type] ?? 1)
  }
  const count = (e: Entry) =>
    typeof e.value === 'string'
      ? e.value.length + 1
      : e.value instanceof Uint8Array
        ? e.value.length
        : 'ref' in e.value
          ? e.type === 7
            ? blobs[(e.value as Ref).ref].length
            : 1
          : (e.value as Num).length
  // Pass 1: positions.
  const pos: Record<string, number> = {}
  let p = opts.headerSize
  for (const ifd of opts.ifds) {
    pos[ifd.name] = p
    p += 2 + ifd.entries.length * 12 + 4
    for (const e of ifd.entries) {
      const isBlobRef = typeof e.value === 'object' && 'ref' in e.value && e.type === 7
      const s = valueSize(e)
      if (!isBlobRef && s > 4) p += s + (s % 2)
    }
  }
  for (const [name, b] of Object.entries(blobs)) {
    pos[name] = p
    p += b.length + (b.length % 2)
  }
  // Pass 2: bytes.
  const w = new Writer(little)
  opts.header(pos[opts.ifds[0].name], w)
  while (w.length < opts.headerSize) w.u8(0)
  for (const ifd of opts.ifds) {
    const entries = [...ifd.entries].sort((a, b) => a.tag - b.tag)
    const tail = new Writer(little)
    let tailAt = pos[ifd.name] + 2 + entries.length * 12 + 4
    w.u16(entries.length)
    for (const e of entries) {
      w.u16(e.tag)
      w.u16(e.type)
      w.u32(count(e))
      const v = e.value
      if (typeof v === 'object' && 'ref' in v) {
        w.u32(pos[(v as Ref).ref])
        continue
      }
      const s = valueSize(e)
      const put = (into: Writer) => {
        if (typeof v === 'string') {
          for (const c of v) into.u8(c.charCodeAt(0))
          into.u8(0)
        } else if (v instanceof Uint8Array) into.raw(v)
        else for (const n of v as Num) (SIZE[e.type] === 2 ? into.u16(n) : SIZE[e.type] === 4 ? into.u32(n) : into.u8(n))
      }
      if (s <= 4) {
        const inline = new Writer(little)
        put(inline)
        while (inline.length < 4) inline.u8(0)
        w.raw(inline.bytes)
      } else {
        w.u32(tailAt)
        put(tail)
        if (s % 2) tail.u8(0)
        tailAt += s + (s % 2)
      }
    }
    w.u32(ifd.next ? pos[ifd.next] : 0)
    w.raw(tail.bytes)
  }
  for (const b of Object.values(blobs)) {
    w.raw(b)
    if (b.length % 2) w.u8(0)
  }
  return Uint8Array.from(w.bytes)
}

const tiffHeader = (little: boolean, magic = 42) => (first: number, w: Writer) => {
  w.u8(little ? 0x49 : 0x4d)
  w.u8(little ? 0x49 : 0x4d)
  w.u16(magic)
  w.u32(first)
}

export interface RawOptions {
  /** "YYYY:MM:DD HH:MM:SS" */
  date: string
  subSec?: string
  orientation?: number
  make?: string
  model?: string
}

const DUMMY_RAW = new Uint8Array(512).fill(7)

function exifIfd(o: RawOptions): Ifd {
  const entries: Entry[] = [{ tag: 0x9003, type: 2, value: o.date }]
  if (o.subSec) entries.push({ tag: 0x9291, type: 2, value: o.subSec })
  return { name: 'exif', entries }
}

function ifd0(o: RawOptions, extra: Entry[]): Entry[] {
  return [
    { tag: 0x10f, type: 2, value: o.make ?? 'Test' },
    { tag: 0x110, type: 2, value: o.model ?? 'Synthetic' },
    { tag: 0x112, type: 3, value: [o.orientation ?? 1] },
    { tag: 0x8769, type: 4, value: { ref: 'exif' } as Ref },
    ...extra,
  ]
}

/** Canon CR2: IFD0 = full-size JPEG strip, IFD1 = thumbnail, IFD3 = "raw". */
export function makeCr2(preview: Uint8Array, thumb: Uint8Array, o: RawOptions, size: [number, number]): Uint8Array {
  return buildTiff({
    headerSize: 16,
    header: (first, w) => {
      tiffHeader(true)(first, w)
      w.raw([0x43, 0x52, 2, 0]) // "CR" v2.0
      w.u32(0)
    },
    ifds: [
      {
        name: 'ifd0',
        next: 'ifd1',
        entries: ifd0(o, [
          { tag: 0x100, type: 3, value: [size[0]] },
          { tag: 0x101, type: 3, value: [size[1]] },
          { tag: 0x103, type: 3, value: [6] },
          { tag: 0x111, type: 4, value: { ref: 'preview' } },
          { tag: 0x117, type: 4, value: [preview.length] },
        ]),
      },
      { name: 'ifd1', next: 'ifd3', entries: [{ tag: 0x201, type: 4, value: { ref: 'thumb' } }, { tag: 0x202, type: 4, value: [thumb.length] }] },
      { name: 'ifd3', entries: [{ tag: 0x103, type: 3, value: [6] }, { tag: 0x111, type: 4, value: { ref: 'raw' } }, { tag: 0x117, type: 4, value: [DUMMY_RAW.length] }] },
      exifIfd(o),
    ],
    blobs: { preview, thumb, raw: DUMMY_RAW },
  })
}

/** Nikon NEF / Sony ARW style: preview via JPEGInterchangeFormat in a SubIFD (NEF) or IFD0 (ARW). */
export function makeNefOrArw(kind: 'nef' | 'arw', preview: Uint8Array, o: RawOptions, little = kind === 'arw'): Uint8Array {
  const previewEntries: Entry[] = [
    { tag: 0x201, type: 4, value: { ref: 'preview' } },
    { tag: 0x202, type: 4, value: [preview.length] },
  ]
  return buildTiff({
    little,
    headerSize: 8,
    header: tiffHeader(little),
    ifds: [
      {
        name: 'ifd0',
        entries: ifd0(o, kind === 'arw' ? previewEntries : [{ tag: 0x14a, type: 4, value: { ref: 'sub0' } as Ref }]),
      },
      ...(kind === 'nef' ? [{ name: 'sub0', entries: [{ tag: 0xfe, type: 4, value: [1] }, ...previewEntries] }] : []),
      exifIfd(o),
    ],
    blobs: { preview, raw: DUMMY_RAW },
  })
}

/** DNG: preview as a JPEG-compressed (7) strip in a SubIFD with NewSubfileType = 1. */
export function makeDng(preview: Uint8Array, o: RawOptions, size: [number, number]): Uint8Array {
  return buildTiff({
    headerSize: 8,
    header: tiffHeader(true),
    ifds: [
      { name: 'ifd0', entries: ifd0(o, [{ tag: 0x14a, type: 4, value: { ref: 'sub0' } as Ref }, { tag: 0xc612, type: 1, value: [1, 4, 0, 0] }]) },
      {
        name: 'sub0',
        entries: [
          { tag: 0xfe, type: 4, value: [1] },
          { tag: 0x100, type: 4, value: [size[0]] },
          { tag: 0x101, type: 4, value: [size[1]] },
          { tag: 0x103, type: 3, value: [7] },
          { tag: 0x111, type: 4, value: { ref: 'preview' } },
          { tag: 0x117, type: 4, value: [preview.length] },
        ],
      },
      exifIfd(o),
    ],
    blobs: { preview, raw: DUMMY_RAW },
  })
}

/** Panasonic RW2: magic 0x55, JpgFromRaw (0x2E) blob in IFD0. */
export function makeRw2(preview: Uint8Array, o: RawOptions): Uint8Array {
  return buildTiff({
    headerSize: 8,
    header: tiffHeader(true, 0x55),
    ifds: [{ name: 'ifd0', entries: ifd0(o, [{ tag: 0x2e, type: 7, value: { ref: 'preview' } }]) }, exifIfd(o)],
    blobs: { preview, raw: DUMMY_RAW },
  })
}

/** OM System ORF: "IIRO", preview in the maker note's CameraSettings (offsets relative to the note). */
export function makeOrf(preview: Uint8Array, o: RawOptions): Uint8Array {
  const note = buildTiff({
    headerSize: 16,
    header: (_first, w) => {
      w.raw([...'OM SYSTEM'].map((c) => c.charCodeAt(0)))
      w.raw([0, 0, 0, 0x49, 0x49, 4, 0])
    },
    ifds: [
      { name: 'main', entries: [{ tag: 0x2020, type: 13, value: { ref: 'cs' } }] },
      {
        name: 'cs',
        entries: [
          { tag: 0x100, type: 4, value: [1] },
          { tag: 0x101, type: 4, value: { ref: 'preview' } },
          { tag: 0x102, type: 4, value: [preview.length] },
        ],
      },
    ],
    blobs: { preview },
  })
  return buildTiff({
    headerSize: 8,
    header: tiffHeader(true, 0x4f52),
    ifds: [
      { name: 'ifd0', entries: ifd0(o, [{ tag: 0x103, type: 3, value: [1] }, { tag: 0x111, type: 4, value: { ref: 'raw' } }]) },
      { name: 'exif', entries: [...exifIfd(o).entries, { tag: 0x927c, type: 7, value: { ref: 'note' } }] },
    ],
    blobs: { note, raw: DUMMY_RAW },
  })
}

/** A JPEG with an APP1 Exif block (capture time + orientation) inserted after SOI. */
export function withExif(jpeg: Uint8Array, o: RawOptions): Uint8Array {
  const tiff = buildTiff({
    little: false,
    headerSize: 8,
    header: tiffHeader(false),
    ifds: [{ name: 'ifd0', entries: ifd0(o, []) }, exifIfd(o)],
  })
  const len = 2 + 6 + tiff.length
  const app1 = Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
  return Uint8Array.from([0xff, 0xd8, ...app1, ...jpeg.subarray(2)])
}

/** Fujifilm RAF: big-endian header, JPEG offset/length at 84/88. */
export function makeRaf(preview: Uint8Array, o: RawOptions): Uint8Array {
  const jpeg = withExif(preview, o)
  const header = new Uint8Array(160)
  header.set([...'FUJIFILMCCD-RAW 0201FF383501'].map((c) => c.charCodeAt(0)))
  const dv = new DataView(header.buffer)
  dv.setUint32(84, 160)
  dv.setUint32(88, jpeg.length)
  return Uint8Array.from([...header, ...jpeg, ...DUMMY_RAW])
}

function box(type: string, ...parts: ArrayLike<number>[]): number[] {
  const body = parts.flatMap((p) => Array.from(p))
  const size = 8 + body.length
  return [size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...[...type].map((c) => c.charCodeAt(0)), ...body]
}
const hex = (s: string) => s.match(/../g)!.map((h) => parseInt(h, 16))
const be = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => Math.floor(n / 2 ** (8 * (bytes - 1 - i))) & 0xff)

/** Canon CR3 (ISO-BMFF): CMT1/CMT2 in the moov uuid, PRVW box, full-size JPEG track in mdat. */
export function makeCr3(prvw: Uint8Array, full: Uint8Array, o: RawOptions, prvwSize: [number, number]): Uint8Array {
  const cmt1 = buildTiff({ headerSize: 8, header: tiffHeader(true), ifds: [{ name: 'ifd0', entries: ifd0(o, []).filter((e) => e.tag !== 0x8769) }] })
  const cmt2 = buildTiff({ headerSize: 8, header: tiffHeader(true), ifds: [exifIfd(o)] })
  const build = (mdatAt: number) => {
    const ftyp = box('ftyp', [...'crx '].map((c) => c.charCodeAt(0)), be(1, 4))
    const stbl = box('stbl', box('stsz', be(0, 4), be(full.length, 4), be(1, 4)), box('co64', be(0, 4), be(1, 4), be(mdatAt, 8)))
    const trak = box('trak', box('mdia', box('minf', stbl)))
    const meta = box('uuid', hex('85c0b687820f11e08111f4ce462b6a48'), box('CMT1', cmt1), box('CMT2', cmt2))
    const moov = box('moov', meta, trak)
    const prv = box('uuid', hex('eaf42b5e1c984b88b9fbb7dc406e4d16'), be(0, 8), box('PRVW', be(0, 4), be(1, 2), be(prvwSize[0], 2), be(prvwSize[1], 2), be(0, 2), be(prvw.length, 4), prvw))
    return [...ftyp, ...moov, ...prv]
  }
  const head = build(0)
  const mdatAt = head.length + 8
  return Uint8Array.from([...build(mdatAt), ...box('mdat', full, DUMMY_RAW)])
}

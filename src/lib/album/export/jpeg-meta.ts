/**
 * JPEG metadata the browser's encoder does not write: print resolution (JFIF
 * density in dots per inch) and an embedded ICC profile (APP2 ICC_PROFILE).
 * Works on the encoded bytes, so no re-encode and no quality loss.
 */

const SOI = [0xff, 0xd8]

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at]! << 8) | bytes[at + 1]!
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === SOI[0] && bytes[1] === SOI[1]
}

function jfifSegment(dpi: number): Uint8Array {
  const d = Math.max(1, Math.min(65535, Math.round(dpi)))
  return new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x02, // version 1.02
    0x01, // units: dots per inch
    d >> 8, d & 0xff, d >> 8, d & 0xff,
    0x00, 0x00, // no thumbnail
  ])
}

/** Offset of the JFIF APP0 marker right after SOI, or -1. */
function findJfif(bytes: Uint8Array): number {
  const at = 2
  if (bytes[at] !== 0xff || bytes[at + 1] !== 0xe0) return -1
  const id = String.fromCharCode(...bytes.subarray(at + 4, at + 9))
  return id === 'JFIF\0' ? at : -1
}

/** Sets (or inserts) JFIF density = dpi × dpi, units = inches. */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (!isJpeg(bytes)) throw new Error('not a JPEG')
  const at = findJfif(bytes)
  const d = Math.max(1, Math.min(65535, Math.round(dpi)))
  if (at >= 0) {
    const out = bytes.slice()
    out[at + 11] = 1
    out[at + 12] = d >> 8
    out[at + 13] = d & 0xff
    out[at + 14] = d >> 8
    out[at + 15] = d & 0xff
    return out
  }
  const seg = jfifSegment(d)
  const out = new Uint8Array(bytes.length + seg.length)
  out.set(bytes.subarray(0, 2), 0)
  out.set(seg, 2)
  out.set(bytes.subarray(2), 2 + seg.length)
  return out
}

/** Reads the JFIF density back ({ dpi } when units are inches). */
export function readJpegDpi(bytes: Uint8Array): { units: number; x: number; y: number } | null {
  const at = findJfif(bytes)
  if (at < 0) return null
  return { units: bytes[at + 11]!, x: u16(bytes, at + 12), y: u16(bytes, at + 14) }
}

const ICC_ID = 'ICC_PROFILE\0'
const MAX_ICC_CHUNK = 65519 - ICC_ID.length - 2

/** Drops existing APP2 ICC_PROFILE segments (a source may already carry one). */
function stripIcc(bytes: Uint8Array): Uint8Array {
  const keep: [number, number][] = []
  let at = 2
  let from = 0
  while (at + 4 < bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]!
    if (marker === 0xda || marker === 0xd9) break
    const len = u16(bytes, at + 2)
    if (marker === 0xe2 && String.fromCharCode(...bytes.subarray(at + 4, at + 4 + ICC_ID.length)) === ICC_ID) {
      keep.push([from, at])
      from = at + 2 + len
    }
    at += 2 + len
  }
  if (!keep.length) return bytes
  keep.push([from, bytes.length])
  const out = new Uint8Array(keep.reduce((n, [a, b]) => n + b - a, 0))
  let o = 0
  for (const [a, b] of keep) {
    out.set(bytes.subarray(a, b), o)
    o += b - a
  }
  return out
}

/** Inserts the ICC profile as APP2 segment(s) right after SOI/APP0, replacing any existing one. */
export function embedIccInJpeg(source: Uint8Array, icc: Uint8Array): Uint8Array {
  if (!isJpeg(source)) throw new Error('not a JPEG')
  const bytes = stripIcc(source)
  const chunks: Uint8Array[] = []
  const count = Math.ceil(icc.length / MAX_ICC_CHUNK)
  for (let i = 0; i < count; i++) {
    const data = icc.subarray(i * MAX_ICC_CHUNK, (i + 1) * MAX_ICC_CHUNK)
    const len = 2 + ICC_ID.length + 2 + data.length
    const seg = new Uint8Array(2 + len)
    seg[0] = 0xff
    seg[1] = 0xe2
    seg[2] = len >> 8
    seg[3] = len & 0xff
    for (let k = 0; k < ICC_ID.length; k++) seg[4 + k] = ICC_ID.charCodeAt(k)
    seg[4 + ICC_ID.length] = i + 1
    seg[5 + ICC_ID.length] = count
    seg.set(data, 6 + ICC_ID.length)
    chunks.push(seg)
  }
  const jfif = findJfif(bytes)
  const insertAt = jfif >= 0 ? jfif + 2 + u16(bytes, jfif + 2) : 2
  const extra = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(bytes.length + extra)
  out.set(bytes.subarray(0, insertAt), 0)
  let at = insertAt
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  out.set(bytes.subarray(insertAt), at)
  return out
}

/** Extracts the embedded ICC profile (all APP2 chunks joined), or null. */
export function readJpegIcc(bytes: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = []
  let at = 2
  while (at + 4 < bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]!
    if (marker === 0xda || marker === 0xd9) break // start of scan / end
    const len = u16(bytes, at + 2)
    if (marker === 0xe2) {
      const id = String.fromCharCode(...bytes.subarray(at + 4, at + 4 + ICC_ID.length))
      if (id === ICC_ID) parts.push(bytes.subarray(at + 4 + ICC_ID.length + 2, at + 2 + len))
    }
    at += 2 + len
  }
  if (!parts.length) return null
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Both at once: what every exported spread JPEG goes through. */
export function finalizeJpeg(bytes: Uint8Array, dpi: number, icc: Uint8Array | null): Uint8Array {
  const withDpi = setJpegDpi(bytes, dpi)
  return icc ? embedIccInJpeg(withDpi, icc) : withDpi
}

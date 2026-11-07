/**
 * Minimal ICC v2 display profiles (matrix + TRC), generated here instead of
 * shipping vendor .icc files (licensing stays clean). The colourant values
 * are the published primaries of sRGB (IEC 61966-2-1) and Adobe RGB (1998),
 * Bradford-adapted to the D50 PCS; the profile descriptions say «compatible»,
 * as is customary for independently built profiles.
 */
import type { ColorProfile } from '../types'

type XYZ = [number, number, number]

interface ProfileDef {
  description: string
  red: XYZ
  green: XYZ
  blue: XYZ
  trc: { gamma: number } | { srgb: true }
}

const DEFS: Record<ColorProfile, ProfileDef> = {
  srgb: {
    description: 'sRGB IEC61966-2.1 compatible (proYav)',
    red: [0.43607, 0.22249, 0.01392],
    green: [0.38515, 0.71687, 0.09708],
    blue: [0.14307, 0.06061, 0.7141],
    trc: { srgb: true },
  },
  adobe_rgb: {
    description: 'Adobe RGB (1998) compatible (proYav)',
    red: [0.60974, 0.31111, 0.01947],
    green: [0.20528, 0.62567, 0.06087],
    blue: [0.14919, 0.06322, 0.74457],
    trc: { gamma: 563 / 256 },
  },
}

const D50: XYZ = [0.9642, 1.0, 0.82491]

class Bytes {
  private parts: number[] = []
  get length() {
    return this.parts.length
  }
  u8(v: number) {
    this.parts.push(v & 0xff)
  }
  u16(v: number) {
    this.u8(v >> 8)
    this.u8(v)
  }
  u32(v: number) {
    this.u16((v >>> 16) & 0xffff)
    this.u16(v & 0xffff)
  }
  s15f16(v: number) {
    this.u32(Math.round(v * 65536) >>> 0)
  }
  ascii(s: string) {
    for (const ch of s) this.u8(ch.charCodeAt(0))
  }
  pad4() {
    while (this.parts.length % 4) this.u8(0)
  }
  toUint8Array() {
    return Uint8Array.from(this.parts)
  }
}

function xyzTag(v: XYZ): Uint8Array {
  const b = new Bytes()
  b.ascii('XYZ ')
  b.u32(0)
  v.forEach((n) => b.s15f16(n))
  return b.toUint8Array()
}

function textTag(text: string): Uint8Array {
  const b = new Bytes()
  b.ascii('text')
  b.u32(0)
  b.ascii(text)
  b.u8(0)
  return b.toUint8Array()
}

function descTag(text: string): Uint8Array {
  const b = new Bytes()
  b.ascii('desc')
  b.u32(0)
  b.u32(text.length + 1)
  b.ascii(text)
  b.u8(0)
  b.u32(0) // unicode language
  b.u32(0) // unicode count
  b.u16(0) // scriptcode code
  b.u8(0) // scriptcode count
  for (let i = 0; i < 67; i++) b.u8(0)
  return b.toUint8Array()
}

function srgbDecode(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function curveTag(trc: ProfileDef['trc']): Uint8Array {
  const b = new Bytes()
  b.ascii('curv')
  b.u32(0)
  if ('gamma' in trc) {
    b.u32(1)
    b.u16(Math.round(trc.gamma * 256)) // u8Fixed8
  } else {
    const n = 1024
    b.u32(n)
    for (let i = 0; i < n; i++) b.u16(Math.round(srgbDecode(i / (n - 1)) * 65535))
  }
  return b.toUint8Array()
}

const cache = new Map<ColorProfile, Uint8Array>()

export function iccProfile(kind: ColorProfile): Uint8Array {
  const hit = cache.get(kind)
  if (hit) return hit
  const def = DEFS[kind]
  const curve = curveTag(def.trc)
  const tags: [string, Uint8Array][] = [
    ['desc', descTag(def.description)],
    ['cprt', textTag('No copyright, use freely')],
    ['wtpt', xyzTag(D50)],
    ['rXYZ', xyzTag(def.red)],
    ['gXYZ', xyzTag(def.green)],
    ['bXYZ', xyzTag(def.blue)],
    ['rTRC', curve],
    ['gTRC', curve],
    ['bTRC', curve],
  ]
  // Lay out tag data (shared curve stored once), 4-byte aligned.
  const headerSize = 128
  const tableSize = 4 + tags.length * 12
  let offset = headerSize + tableSize
  const placed = new Map<Uint8Array, number>()
  const entries: { sig: string; offset: number; size: number }[] = []
  const blobs: Uint8Array[] = []
  for (const [sig, data] of tags) {
    let at = placed.get(data)
    if (at === undefined) {
      at = offset
      placed.set(data, at)
      blobs.push(data)
      offset += data.length
      const pad = (4 - (offset % 4)) % 4
      if (pad) blobs.push(new Uint8Array(pad))
      offset += pad
    }
    entries.push({ sig, offset: at, size: data.length })
  }
  const total = offset

  const b = new Bytes()
  b.u32(total)
  b.ascii('none') // preferred CMM: none
  b.u32(0x02100000) // version 2.1
  b.ascii('mntr')
  b.ascii('RGB ')
  b.ascii('XYZ ')
  // creation date 2026-01-01 00:00:00 (fixed: deterministic bytes)
  ;[2026, 1, 1, 0, 0, 0].forEach((v) => b.u16(v))
  b.ascii('acsp')
  b.u32(0) // platform
  b.u32(0) // flags
  b.u32(0) // manufacturer
  b.u32(0) // model
  b.u32(0)
  b.u32(0) // attributes
  b.u32(0) // rendering intent: perceptual
  D50.forEach((n) => b.s15f16(n))
  b.u32(0) // creator
  while (b.length < headerSize) b.u8(0)
  b.u32(entries.length)
  for (const e of entries) {
    b.ascii(e.sig)
    b.u32(e.offset)
    b.u32(e.size)
  }
  const head = b.toUint8Array()
  const out = new Uint8Array(total)
  out.set(head, 0)
  let at = head.length
  for (const blob of blobs) {
    out.set(blob, at)
    at += blob.length
  }
  cache.set(kind, out)
  return out
}

/** Human name, also used in reports/UI. */
export function iccDescription(kind: ColorProfile): string {
  return DEFS[kind].description
}

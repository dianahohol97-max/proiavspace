/**
 * Reads only the header segments of an embedded JPEG: checks it starts with
 * SOI, finds the frame size (SOF) and the EXIF block (APP1) — without reading
 * the compressed image data.
 */
import { View, type RangeReader } from './reader'

export interface JpegHeader {
  width: number
  height: number
  /** Baseline/extended/progressive Huffman — what browsers can decode. */
  decodable: boolean
  /** Absolute offset of the TIFF header inside the APP1 "Exif" segment. */
  exifTiff?: number
}

const MAX_SEGMENTS = 64

export async function readJpegHeader(reader: RangeReader, offset: number, length: number): Promise<JpegHeader | null> {
  const end = Math.min(reader.size, offset + length)
  if (offset + 4 > end) return null
  const soi = await reader.read(offset, 2)
  if (soi[0] !== 0xff || soi[1] !== 0xd8) return null
  let p = offset + 2
  let exifTiff: number | undefined
  for (let i = 0; i < MAX_SEGMENTS && p + 4 <= end; i++) {
    const m = await reader.read(p, 4)
    if (m[0] !== 0xff) return null
    const marker = m[1]
    if (marker === 0xff) {
      p += 1
      continue
    }
    const segLen = new View(m, false).u16(2)
    if (segLen < 2) return null
    // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (p + 9 > end) return null
      const sof = await reader.read(p + 4, 5)
      const v = new View(sof, false)
      const height = v.u16(1)
      const width = v.u16(3)
      return { width, height, decodable: marker === 0xc0 || marker === 0xc1 || marker === 0xc2, exifTiff }
    }
    if (marker === 0xe1 && exifTiff === undefined && p + 10 <= end) {
      const id = await reader.read(p + 4, 6)
      if (String.fromCharCode(...id.subarray(0, 4)) === 'Exif') exifTiff = p + 10
    }
    if (marker === 0xda || marker === 0xd9) return null // scan before frame: broken
    p += 2 + segLen
  }
  return null
}

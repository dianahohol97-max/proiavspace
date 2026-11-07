/**
 * dHash: a 64-bit perceptual "difference hash". The frame is shrunk to 9×8
 * luma cells (area average, so it is stable against noise and JPEG artefacts)
 * and each bit says whether a cell is brighter than its right neighbour.
 * Near-identical frames of a burst differ in a handful of bits; different
 * scenes differ in ~32.
 *
 * Stored as a 16-char hex string (JSON- and IndexedDB-friendly).
 */

const HASH_W = 9
const HASH_H = 8

/** Area-average downscale of a luma plane to w×h cells. */
export function shrink(gray: Float32Array, width: number, height: number, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let cy = 0; cy < h; cy++) {
    const y0 = Math.floor((cy * height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / h))
    for (let cx = 0; cx < w; cx++) {
      const x0 = Math.floor((cx * width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / w))
      let sum = 0
      for (let y = y0; y < y1; y++) {
        const row = y * width
        for (let x = x0; x < x1; x++) sum += gray[row + x]
      }
      out[cy * w + cx] = sum / ((x1 - x0) * (y1 - y0))
    }
  }
  return out
}

export function dHash(gray: Float32Array, width: number, height: number): string {
  const cells = shrink(gray, width, height, HASH_W, HASH_H)
  let hex = ''
  for (let y = 0; y < HASH_H; y++) {
    // One row = 8 bits = 2 hex digits.
    let byte = 0
    for (let x = 0; x < HASH_W - 1; x++) {
      const left = cells[y * HASH_W + x]
      const right = cells[y * HASH_W + x + 1]
      byte = (byte << 1) | (left > right ? 1 : 0)
    }
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

function popcount8(n: number): number {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

/** Number of differing bits between two dHash strings (0..64). */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i += 2) {
    d += popcount8(Number.parseInt(a.slice(i, i + 2), 16) ^ Number.parseInt(b.slice(i, i + 2), 16))
  }
  return d
}

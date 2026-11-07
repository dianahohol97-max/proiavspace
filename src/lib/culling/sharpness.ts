/**
 * Sharpness = variance of the Laplacian, computed on a ~512 px preview.
 *
 * A single global variance punishes intentional bokeh: most of the frame is
 * soft on purpose and only the subject is crisp. So the frame is cut into a
 * grid of tiles and the score is the mean of the sharpest few tiles — a frame
 * with one crisp subject scores like a crisp frame; a frame where focus was
 * missed or the camera moved has no crisp tile at all.
 *
 * Pure functions on plain arrays: they run in the Web Worker and in node tests.
 */

/** RGBA (canvas ImageData layout) → luma, Rec. 601 weights, 0..255. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return gray
}

/** 4-neighbour Laplacian response (border pixels are skipped). */
export function laplacian(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    const row = y * width
    for (let x = 1; x < width - 1; x++) {
      const i = row + x
      out[i] = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
    }
  }
  return out
}

/** Classic whole-frame variance of the Laplacian. */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  return regionVariance(laplacian(gray, width, height), width, 1, 1, width - 1, height - 1)
}

function regionVariance(values: Float32Array, width: number, x0: number, y0: number, x1: number, y1: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    const row = y * width
    for (let x = x0; x < x1; x++) {
      const v = values[row + x]
      sum += v
      sumSq += v * v
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return Math.max(0, sumSq / n - mean * mean)
}

export interface SharpnessResult {
  /** Mean Laplacian variance of the sharpest tiles — the score used for flags. */
  score: number
  /** Whole-frame Laplacian variance, kept for diagnostics. */
  global: number
}

export interface SharpnessOptions {
  /** Tiles per side (grid × grid). */
  grid?: number
  /** How many of the sharpest tiles are averaged. */
  top?: number
}

/**
 * Tile-based sharpness. Tiles whose own luma is nearly flat (sky, a white
 * wall) are not "blurry", they are just empty; they still count, but because
 * only the top tiles are averaged they never drag a good frame down.
 */
export function sharpness(
  gray: Float32Array,
  width: number,
  height: number,
  { grid = 4, top = 2 }: SharpnessOptions = {}
): SharpnessResult {
  const lap = laplacian(gray, width, height)
  const global = regionVariance(lap, width, 1, 1, width - 1, height - 1)
  const tiles: number[] = []
  for (let ty = 0; ty < grid; ty++) {
    for (let tx = 0; tx < grid; tx++) {
      const x0 = Math.max(1, Math.floor((tx * width) / grid))
      const x1 = Math.min(width - 1, Math.floor(((tx + 1) * width) / grid))
      const y0 = Math.max(1, Math.floor((ty * height) / grid))
      const y1 = Math.min(height - 1, Math.floor(((ty + 1) * height) / grid))
      if (x1 > x0 && y1 > y0) tiles.push(regionVariance(lap, width, x0, y0, x1, y1))
    }
  }
  tiles.sort((a, b) => b - a)
  const picked = tiles.slice(0, Math.max(1, Math.min(top, tiles.length)))
  const score = picked.length ? picked.reduce((s, v) => s + v, 0) / picked.length : global
  return { score, global }
}

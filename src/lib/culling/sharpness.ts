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

/**
 * Where the crisp detail is — the main subject when the face model found no
 * face (a ring, a bouquet, a couple far away on a road). The Laplacian energy
 * on a 12×12 grid: the centroid of the tiles above half of the sharpest one,
 * and the share of the frame their bounding box covers. Intentional bokeh
 * makes this work well: the background has no energy.
 */
export function subjectOf(gray: Float32Array, width: number, height: number, grid = 12): { x: number; y: number; size: number } {
  const lap = laplacian(gray, width, height)
  const energy: number[] = []
  for (let ty = 0; ty < grid; ty++) {
    for (let tx = 0; tx < grid; tx++) {
      const x0 = Math.max(1, Math.floor((tx * width) / grid))
      const x1 = Math.min(width - 1, Math.floor(((tx + 1) * width) / grid))
      const y0 = Math.max(1, Math.floor((ty * height) / grid))
      const y1 = Math.min(height - 1, Math.floor(((ty + 1) * height) / grid))
      energy.push(x1 > x0 && y1 > y0 ? regionVariance(lap, width, x0, y0, x1, y1) : 0)
    }
  }
  const max = Math.max(...energy)
  if (!(max > 0)) return { x: 0.5, y: 0.5, size: 1 }
  let sx = 0
  let sy = 0
  let sw = 0
  let minX = grid
  let maxX = -1
  let minY = grid
  let maxY = -1
  energy.forEach((e, i) => {
    if (e < max * 0.5) return
    const tx = i % grid
    const ty = Math.floor(i / grid)
    sx += (tx + 0.5) * e
    sy += (ty + 0.5) * e
    sw += e
    minX = Math.min(minX, tx)
    maxX = Math.max(maxX, tx)
    minY = Math.min(minY, ty)
    maxY = Math.max(maxY, ty)
  })
  const r = (v: number) => Math.round(v * 1000) / 1000
  return {
    x: r(sx / sw / grid),
    y: r(sy / sw / grid),
    size: r(((maxX - minX + 1) * (maxY - minY + 1)) / (grid * grid)),
  }
}

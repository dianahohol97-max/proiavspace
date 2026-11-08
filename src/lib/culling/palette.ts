/**
 * Dominant colours of a frame, for the album colour harmony («Магічна
 * збірка»). Our own small implementation, no library:
 *
 *  1. the rendition is sampled on a coarse grid (≤ 48×48 points, area
 *     average), so a 512 px frame costs ~2 300 colours, not 260 000 pixels;
 *  2. sRGB → CIE L*a*b* (D65), where Euclidean distance roughly matches what
 *     the eye sees (ΔE76);
 *  3. k-means (k = 3) with deterministic seeding (darkest, lightest, most
 *     saturated sample), so the same frame always gives the same palette.
 *
 * Pure functions: run in the culling measure worker and in node tests.
 */
import type { PaletteColor } from './types'

const GRID = 48
const K = 3
const ITERATIONS = 8

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)

/** sRGB 0..255 → L*a*b* (D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** Area-averaged samples of an RGBA image on a grid×grid lattice, in Lab. */
function samples(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): [number, number, number][] {
  const gw = Math.min(GRID, width)
  const gh = Math.min(GRID, height)
  const out: [number, number, number][] = []
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor((gy * height) / gh)
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / gh))
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor((gx * width) / gw)
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / gw))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      // Every second pixel each way is plenty for an average.
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const p = (y * width + x) * 4
          r += rgba[p]!
          g += rgba[p + 1]!
          b += rgba[p + 2]!
          n++
        }
      }
      out.push(rgbToLab(r / n, g / n, b / n))
    }
  }
  return out
}

const dist2 = (p: number[], q: number[]) => (p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2 + (p[2]! - q[2]!) ** 2
const chroma = (p: number[]) => Math.hypot(p[1]!, p[2]!)

/** Up to 3 dominant colours, heaviest first; weights sum to 1. */
export function palette(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): PaletteColor[] {
  const pts = samples(rgba, width, height)
  if (!pts.length) return []
  // Deterministic seeds: darkest, lightest, most saturated.
  let dark = pts[0]!
  let light = pts[0]!
  let vivid = pts[0]!
  for (const p of pts) {
    if (p[0] < dark[0]) dark = p
    if (p[0] > light[0]) light = p
    if (chroma(p) > chroma(vivid)) vivid = p
  }
  const centres = [dark, light, vivid].map((c) => [...c])
  const assign = new Uint8Array(pts.length)
  for (let it = 0; it < ITERATIONS; it++) {
    const sums = centres.map(() => [0, 0, 0, 0])
    pts.forEach((p, i) => {
      let best = 0
      let bestD = Infinity
      for (let k = 0; k < K; k++) {
        const d = dist2(p, centres[k]!)
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      assign[i] = best
      const s = sums[best]!
      s[0]! += p[0]
      s[1]! += p[1]
      s[2]! += p[2]
      s[3]! += 1
    })
    sums.forEach((s, k) => {
      if (s[3]) centres[k] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!]
    })
  }
  const counts = new Array<number>(K).fill(0)
  for (const k of assign) counts[k]!++
  const round = (v: number) => Math.round(v * 10) / 10
  return centres
    .map((c, k) => ({ l: round(c[0]!), a: round(c[1]!), b: round(c[2]!), weight: Math.round((counts[k]! / pts.length) * 1000) / 1000 }))
    .filter((c) => c.weight > 0)
    .sort((x, y) => y.weight - x.weight)
}

/** Weighted mean colour of a palette (Lab), or null for an empty one. */
export function paletteMean(p: PaletteColor[] | undefined): { l: number; a: number; b: number } | null {
  if (!p?.length) return null
  let l = 0
  let a = 0
  let b = 0
  let w = 0
  for (const c of p) {
    l += c.l * c.weight
    a += c.a * c.weight
    b += c.b * c.weight
    w += c.weight
  }
  return w > 0 ? { l: l / w, a: a / w, b: b / w } : null
}

/**
 * Colour distance between two frames, 0 = the same mood. Earth-mover-ish:
 * each colour of one palette is matched with the nearest of the other,
 * weighted, both ways (ΔE76 units). A b/w frame next to a warm golden-hour
 * frame scores high; two frames of the same scene score low.
 */
export function paletteDistance(p: PaletteColor[] | undefined, q: PaletteColor[] | undefined): number | null {
  if (!p?.length || !q?.length) return null
  const one = (from: PaletteColor[], to: PaletteColor[]) => {
    let sum = 0
    let w = 0
    for (const c of from) {
      let best = Infinity
      for (const d of to) best = Math.min(best, Math.sqrt((c.l - d.l) ** 2 + (c.a - d.a) ** 2 + (c.b - d.b) ** 2))
      sum += best * c.weight
      w += c.weight
    }
    return w > 0 ? sum / w : 0
  }
  return (one(p, q) + one(q, p)) / 2
}

/** Mean chroma (0 = black and white). */
export function paletteChroma(p: PaletteColor[] | undefined): number | null {
  const m = paletteMean(p)
  if (!p?.length || !m) return null
  return p.reduce((s, c) => s + Math.hypot(c.a, c.b) * c.weight, 0)
}

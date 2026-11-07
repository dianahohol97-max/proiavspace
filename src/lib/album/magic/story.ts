/**
 * The story: capture order and chapters.
 *
 * Order — assets.taken_at (EXIF, migration 0067). A photo without a date is
 * placed by its file name: right after the dated photo that precedes it in
 * name order (cameras number frames in shooting order). No dates at all —
 * plain natural name order.
 *
 * Chapters — pauses in time. The threshold adapts to the shoot: a pause has
 * to be both long in absolute terms and an outlier among this shoot's gaps
 * (a wedding shot every few seconds with a 40-min drive to the venue vs a
 * slow portrait session). The number of chapters is capped by the spreads
 * (each chapter starts a new spread) and tiny chapters are not made.
 */
import { frameNumber } from '../autofill'
import type { AlbumPhoto } from '../types'

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
export const naturalCompare = (a: string, b: string) => collator.compare(a, b)

export interface StoryOrder {
  photos: AlbumPhoto[]
  /** Effective time per photo (ms), or frame numbers when nothing is dated; null when neither. */
  values: number[] | null
  order: 'time' | 'name'
}

export function storyOrder(input: AlbumPhoto[]): StoryOrder {
  const byName = input
    .map((p, i) => ({ p, i }))
    .sort((x, y) => naturalCompare(x.p.name, y.p.name) || x.i - y.i)
    .map((x) => x.p)
  const dated = byName.filter((p) => p.takenAt != null && Number.isFinite(p.takenAt))
  if (!dated.length) {
    const nums = byName.map((p) => frameNumber(p.name))
    const ok = nums.every((n) => n !== null)
    return { photos: byName, values: ok ? (nums as number[]) : null, order: 'name' }
  }
  // Undated photos inherit the time of their predecessor in name order.
  let carry = dated[0]!.takenAt!
  const eff = new Map<string, { t: number; dated: boolean; rank: number }>()
  byName.forEach((p, rank) => {
    if (p.takenAt != null && Number.isFinite(p.takenAt)) carry = p.takenAt
    eff.set(p.id, { t: p.takenAt ?? carry, dated: p.takenAt != null, rank })
  })
  const photos = [...byName].sort((x, y) => {
    const a = eff.get(x.id)!
    const b = eff.get(y.id)!
    return a.t - b.t || Number(b.dated) - Number(a.dated) || a.rank - b.rank
  })
  return { photos, values: photos.map((p) => eff.get(p.id)!.t), order: 'time' }
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo)
}

export interface ChapterOptions {
  /** Upper bound on chapters. */
  maxChapters: number
  /** No chapter smaller than this. */
  minSize: number
  /** Absolute floor for a pause (ms for times, frames for frame numbers). */
  minGap: number
  /** A pause must be ≥ this × the median gap. */
  medianFactor?: number
  /** Gaps shorter than this are bursts and do not set the shoot's rhythm (2 s for times). */
  burstGap?: number
}

/** Adaptive threshold for this shoot's gaps. */
export function pauseThreshold(values: number[], minGap: number, medianFactor = 15, burstGap = 0): number {
  const gaps: number[] = []
  for (let i = 1; i < values.length; i++) gaps.push(Math.max(0, values[i]! - values[i - 1]!))
  const sorted = gaps.filter((g) => g > 0).sort((a, b) => a - b)
  if (!sorted.length) return Infinity
  const median = quantile(sorted, 0.5)
  // The shoot's own rhythm: almost every gap is under its 95th percentile;
  // a pause is several times longer than that. Bursts (gaps of a second or
  // two) do not count — they would make every walk to the next spot a pause.
  const rhythm = sorted.filter((g) => g >= burstGap)
  const fence = 3 * quantile(rhythm.length ? rhythm : sorted, 0.95)
  return Math.max(minGap, median * medianFactor, fence)
}

/** Start indices of chapters 2..n (chapter 1 starts at 0). */
export function chapterStarts(values: number[], options: ChapterOptions): number[] {
  const { maxChapters, minSize, minGap, medianFactor, burstGap } = options
  if (values.length < 2 || maxChapters < 2) return []
  const threshold = pauseThreshold(values, minGap, medianFactor, burstGap)
  const candidates: { at: number; gap: number }[] = []
  for (let i = 1; i < values.length; i++) {
    const gap = values[i]! - values[i - 1]!
    if (gap >= threshold) candidates.push({ at: i, gap })
  }
  // Longest pauses first; accept while every chapter stays ≥ minSize.
  candidates.sort((a, b) => b.gap - a.gap || a.at - b.at)
  const starts: number[] = []
  for (const c of candidates) {
    if (starts.length + 1 >= maxChapters) break
    const next = [...starts, c.at].sort((a, b) => a - b)
    const bounds = [0, ...next, values.length]
    let ok = true
    for (let k = 1; k < bounds.length; k++) if (bounds[k]! - bounds[k - 1]! < minSize) ok = false
    if (ok) starts.splice(0, starts.length, ...next)
  }
  return starts
}

/** Split a story-ordered list into chapters at the given starts. */
export function splitAt<T>(items: T[], starts: number[]): T[][] {
  const bounds = [0, ...starts, items.length]
  const out: T[][] = []
  for (let k = 1; k < bounds.length; k++) if (bounds[k]! > bounds[k - 1]!) out.push(items.slice(bounds[k - 1], bounds[k]))
  return out
}

export const MINUTE = 60_000

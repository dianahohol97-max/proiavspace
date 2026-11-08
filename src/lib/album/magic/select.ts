/**
 * Which frames go in. The AI culling signals are reused as they are
 * (src/lib/culling/verdict.ts — sharpness among similar frames, series and
 * the best in a series, closed eyes); this file only turns them into a score
 * and fills the album's capacity:
 *
 *   - hidden from the client → never;
 *   - the photographer's confirmed reject → never;
 *   - the client's hearts and retouch requests → first (priority);
 *   - one frame per series (its best), then the next best frames, keeping
 *     every chapter of the day represented in proportion;
 *   - blurry / closed eyes / a second frame of a series only when there is
 *     nothing else to fill the album with; near-identical frames never twice.
 */
import { hamming } from '@/lib/culling/dhash'
import { computeVerdicts } from '@/lib/culling/verdict'
import type { CullingPhoto, Decision, FlagKind, PhotoAnalysis } from '@/lib/culling/types'
import type { AlbumPhoto } from '../types'
import { mainFaces } from './focal'

export interface PhotoScore {
  id: string
  score: number
  flags: FlagKind[]
  seriesId: string | null
  bestInSeries: boolean
  /** Client heart or retouch request. */
  clientPick: boolean
  /** Relative sharpness among similar frames (1 = typical), null when unknown. */
  relativeSharpness: number | null
  /** Largest face (share of the shorter side), 0 when none. */
  faceSize: number
  hash: string | null
}

/** Near-identical frames (dHash bits) are never both in the album. */
export const NEAR_IDENTICAL = 6

export function scorePhotos(
  story: AlbumPhoto[],
  analysis: Record<string, PhotoAnalysis | undefined>,
  decisions: Record<string, Decision> = {},
  bestOverrides: Record<string, string> = {}
): Map<string, PhotoScore> {
  const culling: CullingPhoto[] = story.map((p, order) => ({ id: p.id, url: '', order, takenAt: p.takenAt ?? null, name: p.name }))
  const verdicts = computeVerdicts(culling, analysis, bestOverrides)
  const out = new Map<string, PhotoScore>()
  for (const p of story) {
    const a = analysis[p.id]
    const v = verdicts[p.id]
    const cleared = decisions[p.id] === 'cleared'
    const flags = cleared ? [] : v?.flags ?? []
    const rel = v?.relativeSharpness ?? null
    let score = rel !== null && rel > 0 ? Math.min(Math.max(Math.log2(rel), -2), 1) : 0
    if (flags.includes('blurry')) score -= 3
    if (flags.includes('eyes')) score -= 2.5
    if (flags.includes('duplicate')) score -= 1.5
    if (v?.bestInSeries) score += 0.3
    const faces = mainFaces(a?.faces)
    const faceSize = Math.max(0, ...(a?.faces ?? []).map((f) => f.size))
    if (faces.length) score += 0.3
    const hearts = p.favorites ?? 0
    const clientPick = hearts > 0 || !!p.retouch
    if (hearts > 0) score += 3 + 0.5 * Math.min(hearts - 1, 4)
    if (p.retouch) score += 2.5
    out.set(p.id, {
      id: p.id,
      score,
      flags,
      seriesId: v?.seriesId ?? null,
      bestInSeries: !!v?.bestInSeries,
      clientPick,
      relativeSharpness: rel,
      faceSize,
      hash: a && !a.error && a.hash ? a.hash : null,
    })
  }
  return out
}

/** Split `total` into parts proportional to `weights` (largest remainder), each ≥ min when possible. */
export function apportion(total: number, weights: number[], min = 0): number[] {
  const n = weights.length
  if (!n) return []
  const base = Math.min(min, Math.floor(total / n))
  const rest = total - base * n
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (sum > 0 ? (rest * w) / sum : rest / n))
  const out = raw.map((r) => base + Math.floor(r))
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k]!.i]!++
  return out
}

/**
 * Pick `count` frames from chapters (story order inside each). Returns the
 * chosen ids per chapter, story order kept.
 */
export function selectFrames(
  chapters: AlbumPhoto[][],
  scores: Map<string, PhotoScore>,
  count: number,
  /** Already used elsewhere (the cover frame): neither it nor its near-identical frames go in. */
  reserved: string[] = []
): string[][] {
  const all = chapters.flat().filter((p) => !reserved.includes(p.id))
  chapters = chapters.map((c) => c.filter((p) => !reserved.includes(p.id)))
  const target = Math.min(count, all.length)
  const chosen = new Set<string>()
  const chosenSeries = new Set<string>()
  const chosenHashes: string[] = []
  const s = (id: string) => scores.get(id)!

  for (const id of reserved) {
    const h = scores.get(id)?.hash
    if (h) chosenHashes.push(h)
  }
  const nearIdentical = (id: string) => {
    const h = s(id).hash
    return !!h && chosenHashes.some((x) => hamming(x, h) <= NEAR_IDENTICAL)
  }
  const take = (id: string) => {
    chosen.add(id)
    const sc = s(id)
    if (sc.seriesId) chosenSeries.add(sc.seriesId)
    if (sc.hash) chosenHashes.push(sc.hash)
  }
  const hard = (id: string) => s(id).flags.includes('blurry') || s(id).flags.includes('eyes')
  const byScore = (ids: string[]) => [...ids].sort((a, b) => s(b).score - s(a).score)

  // Pass 0: client picks (best of them when there are more than room).
  for (const id of byScore(all.filter((p) => s(p.id).clientPick).map((p) => p.id))) {
    if (chosen.size >= target) break
    if (!nearIdentical(id)) take(id)
  }

  // Passes 1–3, per chapter with proportional quotas, then globally.
  const passes: ((id: string) => boolean)[] = [
    (id) => !hard(id) && !(s(id).seriesId && chosenSeries.has(s(id).seriesId!)),
    (id) => !hard(id),
    () => true,
  ]
  const quotas = apportion(target, chapters.map((c) => c.length), 1)
  for (const ok of passes) {
    chapters.forEach((chapter, c) => {
      let have = chapter.filter((p) => chosen.has(p.id)).length
      for (const id of byScore(chapter.map((p) => p.id))) {
        if (have >= quotas[c]! || chosen.size >= target) break
        if (chosen.has(id) || !ok(id) || nearIdentical(id)) continue
        take(id)
        have++
      }
    })
  }
  for (const ok of passes) {
    for (const id of byScore(all.map((p) => p.id))) {
      if (chosen.size >= target) break
      if (chosen.has(id) || !ok(id) || nearIdentical(id)) continue
      take(id)
    }
  }
  return chapters.map((c) => c.filter((p) => chosen.has(p.id)).map((p) => p.id))
}

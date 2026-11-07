/**
 * Turns raw measurements into suggestions. Everything here is a SUGGESTION for
 * the photographer — nothing is hidden or deleted on its own.
 *
 * Blur uses a RELATIVE threshold «among similar frames»: a frame is compared
 * with its neighbours in the shoot that look alike (close dHash — same scene,
 * same light, same lens). It is "blurry" only when it is clearly softer than
 * them AND among the least sharp N% of that group. Laplacian variance depends
 * on content (skin and bokeh score low even when in focus), so a frame with no
 * look-alikes is compared with the whole gallery under a much stricter ratio.
 * A gallery shot wide open at f/1.4 is soft everywhere — nothing is flagged.
 */
import { hamming } from './dhash'
import { groupSeries, type SeriesOptions } from './series'
import type { CullingPhoto, FaceInfo, FlagKind, PhotoAnalysis, PhotoVerdict } from './types'

export interface VerdictOptions {
  /** Only the least sharp share of comparable frames can be "blurry" (0..1). */
  blurPercent?: number
  /** …and only when sharpness ≤ this × the median of similar frames. */
  blurRatio?: number
  /** Frames with no look-alikes: ≤ this × the gallery median. */
  isolatedBlurRatio?: number
  /** dHash distance under which two nearby frames count as "similar". */
  similarDistance?: number
  /** At least this many similar neighbours to use the similar-frames rule. */
  minSimilar?: number
  /** Inside a series: a frame ≤ this × the series' best is blurry. */
  seriesBlurRatio?: number
  /** Neighbours on each side (by order) searched for similar frames. */
  contextRadius?: number
  /** Galleries smaller than this skip the gallery-percentile gate (too few to rank). */
  minForPercentile?: number
  /** Eyes: face width relative to the shorter side must be at least this. */
  minFaceSize?: number
  /** Eyes: both blink blendshapes must be at least this. */
  blinkThreshold?: number
  series?: SeriesOptions
}

export const VERDICT_DEFAULTS: Required<Omit<VerdictOptions, 'series'>> = {
  blurPercent: 0.15,
  blurRatio: 0.35,
  isolatedBlurRatio: 0.2,
  similarDistance: 16,
  minSimilar: 2,
  seriesBlurRatio: 0.4,
  contextRadius: 12,
  minForPercentile: 12,
  minFaceSize: 0.12,
  blinkThreshold: 0.6,
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** A face is counted only when it is big enough to judge and both eyes are clearly shut. */
export function hasClosedEyes(faces: FaceInfo[] | undefined, options: VerdictOptions = {}): boolean {
  const { minFaceSize, blinkThreshold } = { ...VERDICT_DEFAULTS, ...options }
  return (faces ?? []).some(
    (f) => f.size >= minFaceSize && f.blinkLeft >= blinkThreshold && f.blinkRight >= blinkThreshold
  )
}

export function computeVerdicts(
  photos: CullingPhoto[],
  analysis: Record<string, PhotoAnalysis | undefined>,
  bestOverrides: Record<string, string> = {},
  options: VerdictOptions = {}
): Record<string, PhotoVerdict> {
  const o = { ...VERDICT_DEFAULTS, ...options }
  const measured = photos
    .filter((p) => {
      const a = analysis[p.id]
      return a && !a.error && Number.isFinite(a.sharpness)
    })
    .sort((a, b) => a.order - b.order)
  const sharp = (id: string) => analysis[id]!.sharpness

  // Series first: duplicates and the in-series blur rule depend on them.
  const groups = groupSeries(
    measured.map((p) => ({ id: p.id, order: p.order, hash: analysis[p.id]!.hash, takenAt: p.takenAt ?? null })),
    options.series
  )
  const seriesOf = new Map<string, string>()
  const bestOf = new Map<string, string>()
  const eyes = new Map<string, boolean>()
  for (const p of measured) eyes.set(p.id, hasClosedEyes(analysis[p.id]!.faces, o))
  for (const ids of groups) {
    const seriesId = `s:${ids[0]}`
    for (const id of ids) seriesOf.set(id, seriesId)
    const override = bestOverrides[seriesId]
    if (override && ids.includes(override)) {
      bestOf.set(seriesId, override)
      continue
    }
    // Sharpest frame wins; a frame with open eyes beats a sharper blink.
    const pool = ids.filter((id) => !eyes.get(id))
    const candidates = pool.length ? pool : ids
    bestOf.set(seriesId, candidates.reduce((best, id) => (sharp(id) > sharp(best) ? id : best)))
  }

  // Global rank (0 = least sharp).
  const ranked = [...measured].sort((a, b) => sharp(a.id) - sharp(b.id))
  const rank = new Map<string, number>()
  ranked.forEach((p, i) => rank.set(p.id, measured.length > 1 ? i / (measured.length - 1) : 1))
  const usePercentile = measured.length >= o.minForPercentile

  const galleryMedian = median(measured.map((p) => sharp(p.id)))
  const out: Record<string, PhotoVerdict> = {}
  measured.forEach((p, index) => {
    const s = sharp(p.id)
    const hash = analysis[p.id]!.hash
    const similar: number[] = []
    for (let k = Math.max(0, index - o.contextRadius); k <= Math.min(measured.length - 1, index + o.contextRadius); k++) {
      if (k === index) continue
      const other = measured[k].id
      if (hamming(hash, analysis[other]!.hash) <= o.similarDistance) similar.push(sharp(other))
    }

    let relative: number | null
    let softVsNeighbours: boolean
    if (similar.length >= o.minSimilar) {
      const localMedian = median(similar)
      relative = localMedian > 0 ? s / localMedian : null
      const softerShare = similar.filter((v) => v < s).length / similar.length
      softVsNeighbours = relative !== null && relative <= o.blurRatio && softerShare <= o.blurPercent
    } else {
      relative = galleryMedian > 0 ? s / galleryMedian : null
      softVsNeighbours =
        relative !== null &&
        relative <= o.isolatedBlurRatio &&
        (!usePercentile || (rank.get(p.id) ?? 1) <= o.blurPercent)
    }

    const flags: FlagKind[] = []
    const seriesId = seriesOf.get(p.id) ?? null
    const best = seriesId ? bestOf.get(seriesId) : undefined
    const isBest = !!seriesId && best === p.id

    const softVsSeries = !!best && !isBest && sharp(best) > 0 && s <= o.seriesBlurRatio * sharp(best)
    if (softVsNeighbours || softVsSeries) flags.push('blurry')
    if (seriesId && !isBest) flags.push('duplicate')
    if (eyes.get(p.id)) flags.push('eyes')

    out[p.id] = { flags, seriesId, bestInSeries: isBest, relativeSharpness: relative }
  })
  return out
}

/** seriesId → member ids in order (only series with 2+ frames). */
export function seriesMembers(verdicts: Record<string, PhotoVerdict>, photos: CullingPhoto[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const p of [...photos].sort((a, b) => a.order - b.order)) {
    const sid = verdicts[p.id]?.seriesId
    if (!sid) continue
    const list = map.get(sid)
    if (list) list.push(p.id)
    else map.set(sid, [p.id])
  }
  return map
}

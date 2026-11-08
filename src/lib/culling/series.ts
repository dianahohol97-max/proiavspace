/**
 * Burst/series grouping: two frames belong to the same series when their
 * dHashes are close AND they were shot close together — by capture time when
 * it is known, otherwise by their position in the gallery (uploads keep the
 * camera's order). Similar frames far apart in the gallery (the same pose at
 * the start and the end of a shoot) are NOT a series.
 *
 * Union–find over pairs inside a sliding window, so it is O(n · window).
 */
import { hamming } from './dhash'

export interface SeriesInput {
  id: string
  order: number
  hash: string
  takenAt?: number | null
}

export interface SeriesOptions {
  /** Max differing dHash bits for "the same shot". */
  maxDistance?: number
  /** How many following frames (in order) are compared with each frame. */
  window?: number
  /** With capture times: max gap between two frames of a series, ms. */
  maxGapMs?: number
}

export const SERIES_DEFAULTS: Required<SeriesOptions> = {
  maxDistance: 10,
  window: 4,
  maxGapMs: 15_000,
}

/** Groups of 2+ frames, each sorted by order; the list is sorted by first frame. */
export function groupSeries(items: SeriesInput[], options: SeriesOptions = {}): string[][] {
  const { maxDistance, window, maxGapMs } = { ...SERIES_DEFAULTS, ...options }
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const parent = sorted.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j <= i + window && j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (a.takenAt != null && b.takenAt != null && Math.abs(b.takenAt - a.takenAt) > maxGapMs) continue
      if (hamming(a.hash, b.hash) > maxDistance) continue
      const ra = find(i)
      const rb = find(j)
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
    }
  }
  const groups = new Map<number, string[]>()
  sorted.forEach((item, i) => {
    const root = find(i)
    const list = groups.get(root)
    if (list) list.push(item.id)
    else groups.set(root, [item.id])
  })
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([, ids]) => ids)
}

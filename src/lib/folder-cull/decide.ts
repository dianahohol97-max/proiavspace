/**
 * Folder culling: suggestions (blur / closed eyes / series) + the
 * photographer's own marks → what gets written to Lightroom / Capture One.
 * The photographer's marks always win; suggestions only fill the gaps.
 */
import type { CullingPhoto, PhotoAnalysis, PhotoVerdict } from '@/lib/culling/types'
import { computeVerdicts } from '@/lib/culling/verdict'
import type { ExportSettings, FolderItem, FolderSession } from './types'

export interface Outcome {
  /** Will be written as rejected. */
  reject: boolean
  /** Reject only because of a suggestion (no manual mark). */
  autoReject: boolean
  best: boolean
  seriesId: string | null
  /** xmp:Rating to write; null = leave as is. */
  rating: number | null
  /** xmp:Label to write; null = leave as is. */
  label: string | null
  /** xmpDM:pick (Lightroom Classic 13.2+): 1 pick, -1 reject, null = leave. */
  pick: 1 | -1 | null
}

/** Shooting order: capture time, then file name (bursts share a second). */
export function orderItems(items: FolderItem[], session: Pick<FolderSession, 'meta'>): CullingPhoto[] {
  const sorted = [...items].sort((a, b) => {
    const ta = session.meta[a.id]?.takenAt ?? Number.POSITIVE_INFINITY
    const tb = session.meta[b.id]?.takenAt ?? Number.POSITIVE_INFINITY
    return ta !== tb ? ta - tb : a.id.localeCompare(b.id, undefined, { numeric: true })
  })
  return sorted.map((it, order) => ({ id: it.id, url: '', order, takenAt: session.meta[it.id]?.takenAt ?? null, name: it.name }))
}

export function folderVerdicts(
  session: Pick<FolderSession, 'items' | 'meta' | 'analysis' | 'faces' | 'bestOverrides'>
): { photos: CullingPhoto[]; verdicts: Record<string, PhotoVerdict> } {
  const photos = orderItems(session.items, session)
  const analysis: Record<string, PhotoAnalysis> = {}
  for (const p of photos) {
    const a = session.analysis[p.id]
    if (a) analysis[p.id] = session.faces[p.id] ? { ...a, faces: session.faces[p.id] } : a
  }
  return { photos, verdicts: computeVerdicts(photos, analysis, session.bestOverrides) }
}

export function outcomeOf(
  id: string,
  verdict: PhotoVerdict | undefined,
  mark: FolderSession['marks'][string] | undefined,
  settings: ExportSettings
): Outcome {
  const flags = verdict?.flags ?? []
  const suggested =
    flags.includes('blurry') || flags.includes('eyes') || (settings.duplicatesAreRejects && flags.includes('duplicate'))
  const flag = mark?.flag ?? null
  const stars = mark?.stars
  // Stars given by hand mean "I looked at it and want it" — no auto-reject then.
  const reject = flag === 'reject' || (flag === null && !(stars && stars > 0) && suggested)
  const best = !!verdict?.bestInSeries && !reject
  const seriesId = verdict?.seriesId ?? null
  const rating = reject ? -1 : stars !== undefined && stars !== null ? stars : best && settings.bestStars > 0 ? settings.bestStars : null
  const label = reject && settings.rejectLabel ? settings.rejectLabel : seriesId && settings.seriesLabel ? settings.seriesLabel : null
  const pick: 1 | -1 | null = reject ? -1 : flag === 'pick' ? 1 : null
  return { reject, autoReject: reject && flag !== 'reject', best, seriesId, rating, label, pick }
}

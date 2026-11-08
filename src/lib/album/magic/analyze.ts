'use client'
/**
 * Browser side of «Магічна збірка»: measures the frames with the AI culling
 * pass itself (src/lib/culling/runner.ts — the same Web Workers, the same
 * IndexedDB cache per gallery, the same photographer decisions), on the
 * ~512 px previews, never on originals.
 *
 *  1. sharpness + dHash + palette + crisp subject for every frame of the pool
 *     (frames already measured by «Відібрати кадри» are reused, only frames
 *     cached before the palette/subject existed are measured again);
 *  2. a first plan of all three styles without faces;
 *  3. the face model only for the frames those plans use, plus their series
 *     neighbours (the blink check picks the best of a burst) — 100–300 frames
 *     instead of the whole gallery, which keeps 800 frames within ~30 s;
 *  4. everything is written back to the culling cache, so the culling panel
 *     of the same gallery starts from it.
 */
import { hamming } from '@/lib/culling/dhash'
import { defaultConcurrency, runCulling, type Progress } from '@/lib/culling/runner'
import { loadState, saveState } from '@/lib/culling/store'
import { loadRemote, stateFromRows } from '@/lib/culling/remote'
import type { CullingPhoto, Decision, PhotoAnalysis } from '@/lib/culling/types'
import type { AlbumPhoto } from '../types'
import { buildMagicVariants, type MagicInput } from './index'
import { storyOrder } from './story'

export type MagicStage = 'measure' | 'model' | 'faces' | 'compose' | 'done'

export interface MagicProgress {
  stage: MagicStage
  done: number
  total: number
  etaMs: number | null
  facesError?: string
}

export interface MagicAnalysis {
  analysis: Record<string, PhotoAnalysis>
  decisions: Record<string, Decision>
  bestOverrides: Record<string, string>
  timings: { measureMs: number; facesMs: number; measured: number; faced: number }
}

/** Faces cached before the box existed (or never run) need the model. */
const needsFaces = (a: PhotoAnalysis | undefined) =>
  !!a && !a.error && (a.faces === undefined || a.faces.some((f) => f.x === undefined))
/** Measured before the palette/subject existed. */
const needsMeasure = (a: PhotoAnalysis | undefined) => !a || !!a.error || !a.palette || !a.subject

function toCulling(photos: AlbumPhoto[]): CullingPhoto[] {
  return photos
    .filter((p) => p.thumbUrl || p.previewUrl)
    .map((p, order) => ({ id: p.id, url: p.thumbUrl || p.previewUrl, order, takenAt: p.takenAt ?? null, name: p.name }))
}

/** Frames whose faces matter: those the first plans use, and their burst neighbours. */
export function faceCandidates(pool: AlbumPhoto[], used: Set<string>, analysis: Record<string, PhotoAnalysis>): string[] {
  const story = storyOrder(pool).photos
  const out = new Set<string>()
  story.forEach((p, i) => {
    if (!used.has(p.id)) return
    out.add(p.id)
    const h = analysis[p.id]?.hash
    if (!h) return
    for (let k = Math.max(0, i - 4); k <= Math.min(story.length - 1, i + 4); k++) {
      const other = analysis[story[k]!.id]?.hash
      if (other && hamming(h, other) <= 10) out.add(story[k]!.id)
    }
  })
  return [...out]
}

export async function analyzeForMagic(options: {
  /** Culling cache key: the gallery id (shared with «Відібрати кадри»). */
  galleryKey: string
  /** Read the photographer's decisions from the account (0059) as well. */
  remote: boolean
  pool: AlbumPhoto[]
  plan: Omit<MagicInput, 'photos' | 'analysis' | 'style'>
  eyes: boolean
  signal: AbortSignal
  onProgress: (p: MagicProgress) => void
}): Promise<MagicAnalysis> {
  const { galleryKey, pool, signal, onProgress } = options
  const local = await loadState(galleryKey)
  // The account is the source of truth for decisions once it has them (0059).
  const rows = options.remote ? await loadRemote(galleryKey) : null
  const state = rows ? { ...local, ...stateFromRows(rows) } : local
  const analysis: Record<string, PhotoAnalysis> = { ...state.analysis }
  const visible = pool.filter((p) => !p.hidden)
  const timings = { measureMs: 0, facesMs: 0, measured: 0, faced: 0 }

  // 1. Measure.
  const toMeasure = toCulling(visible.filter((p) => needsMeasure(analysis[p.id])))
  const t0 = performance.now()
  if (toMeasure.length) {
    await runCulling({
      photos: toMeasure,
      existing: {},
      eyes: false,
      signal,
      concurrency: Math.max(defaultConcurrency(), Math.min(6, (navigator.hardwareConcurrency || 4) - 1)),
      onResult: (id, a) => {
        // Keep faces measured earlier (they do not depend on the new fields).
        const old = analysis[id]
        analysis[id] = old?.faces && !a.error ? { ...a, faces: old.faces } : a
      },
      onProgress: (p: Progress) => onProgress({ stage: 'measure', done: p.done, total: p.total, etaMs: p.etaMs }),
    })
  }
  timings.measureMs = performance.now() - t0
  timings.measured = toMeasure.length
  if (signal.aborted) throw new DOMException('cancelled', 'AbortError')

  // 2–3. Faces for the frames a plan would use.
  if (options.eyes) {
    onProgress({ stage: 'compose', done: 0, total: 1, etaMs: null })
    const first = buildMagicVariants({ ...options.plan, photos: pool, analysis, decisions: state.decisions, bestOverrides: state.bestOverrides })
    const used = new Set(first.flatMap((r) => r.spreads.flatMap((s) => s.slots.map((x) => x.assetId).filter((x): x is string => !!x))))
    const wanted = new Set(faceCandidates(visible, used, analysis).filter((id) => needsFaces(analysis[id])))
    const facePhotos = toCulling(visible).filter((p) => wanted.has(p.id))
    const t1 = performance.now()
    if (facePhotos.length) {
      // runCulling skips frames whose faces are known; old box-less faces are dropped for this run.
      const existing: Record<string, PhotoAnalysis> = {}
      for (const p of facePhotos) {
        const { faces: _drop, ...rest } = analysis[p.id]!
        existing[p.id] = rest
      }
      let facesError: string | undefined
      await runCulling({
        photos: facePhotos,
        existing,
        eyes: true,
        signal,
        onResult: (id, a) => {
          analysis[id] = { ...analysis[id]!, faces: a.faces }
        },
        onProgress: (p: Progress) => {
          facesError = p.facesError
          onProgress({ stage: p.stage === 'model' ? 'model' : 'faces', done: Math.max(0, p.done), total: p.total, etaMs: p.etaMs, facesError })
        },
      })
    }
    timings.facesMs = performance.now() - t1
    timings.faced = facePhotos.length
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError')
  }

  // 4. Back into the culling cache (decisions untouched).
  void saveState({ ...local, analysis: { ...local.analysis, ...analysis } })
  return { analysis, decisions: state.decisions, bestOverrides: state.bestOverrides, timings }
}

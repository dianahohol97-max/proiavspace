'use client'
/**
 * The background culling pass: a queue over the gallery's ~512 px renditions,
 * fed to a small pool of Web Workers.
 *
 *  - concurrency is capped (hardware threads − 1, max 4), so a 1000+ photo
 *    gallery never floods the network or freezes the tab;
 *  - nothing new is dispatched while the tab is hidden (in-flight jobs finish);
 *  - an AbortSignal cancels everything and terminates the workers;
 *  - results already in the local cache are skipped, so a second run is quick.
 *
 * Step 1 measures sharpness + dHash; step 2 (optional) runs the face model.
 */
import { FACE_MODEL_URL, MEASURE_MAX_SIDE, MEDIAPIPE_WASM_BINARY, MEDIAPIPE_WASM_LOADER } from './config'
import type { CullingPhoto, FaceInfo, PhotoAnalysis } from './types'
import type { FacesResponse, MeasureResponse } from './workers/protocol'

export type Stage = 'measure' | 'model' | 'faces' | 'done'

export interface Progress {
  stage: Stage
  done: number
  total: number
  paused: boolean
  /** Rough time left for the whole pass, ms; null while unknown. */
  etaMs: number | null
  /** Why the eyes step was skipped (model failed to load), if it was. */
  facesError?: string
}

export interface RunOptions {
  photos: CullingPhoto[]
  existing: Record<string, PhotoAnalysis>
  eyes: boolean
  signal: AbortSignal
  onResult: (id: string, analysis: PhotoAnalysis) => void
  onProgress: (progress: Progress) => void
  concurrency?: number
}

const JOB_TIMEOUT_MS = 30_000
/** Before step 2 has data: a face pass costs about this many measure jobs. */
const FACE_COST_GUESS = 3

export function defaultConcurrency(): number {
  const threads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.max(1, Math.min(4, threads - 1))
}

/** Resolves when the tab is visible (immediately if it already is) or on abort. */
function whenVisible(signal: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      if (document.hidden && !signal.aborted) return
      document.removeEventListener('visibilitychange', done)
      signal.removeEventListener('abort', done)
      resolve()
    }
    document.addEventListener('visibilitychange', done)
    signal.addEventListener('abort', done)
  })
}

/** Active (visible, non-loading) time, for an honest rate. */
class Clock {
  private started = 0
  private total = 0
  private running = false
  start() {
    if (!this.running) {
      this.started = performance.now()
      this.running = true
    }
  }
  stop() {
    if (this.running) {
      this.total += performance.now() - this.started
      this.running = false
    }
  }
  get ms() {
    return this.total + (this.running ? performance.now() - this.started : 0)
  }
}

type Pending<T> = { resolve: (value: T) => void; timer: ReturnType<typeof setTimeout> }

/**
 * One request/reply with a worker. Settles with `fallback` on timeout or on
 * cancel — a terminated worker never answers, so nobody may wait for it.
 */
function ask<T>(
  pending: Map<number, Pending<T>>,
  jobId: number,
  signal: AbortSignal,
  fallback: T,
  send: () => void
): Promise<T> {
  return new Promise<T>((resolve) => {
    const settle = (value: T) => {
      clearTimeout(timer)
      pending.delete(jobId)
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onAbort = () => settle(fallback)
    const timer = setTimeout(() => settle(fallback), JOB_TIMEOUT_MS)
    if (signal.aborted) return settle(fallback)
    signal.addEventListener('abort', onAbort)
    pending.set(jobId, { resolve: settle, timer })
    send()
  })
}

function createMeasureWorker(): Worker {
  return new Worker(new URL('./workers/measure.worker.ts', import.meta.url))
}

function createFacesWorker(): Worker {
  return new Worker(new URL('./workers/faces.worker.ts', import.meta.url))
}

export async function runCulling(options: RunOptions): Promise<void> {
  const { photos, existing, eyes, signal, onResult, onProgress } = options
  const concurrency = options.concurrency ?? defaultConcurrency()
  const measureQueue = photos.filter((p) => !existing[p.id] || existing[p.id].error)
  // Analyses produced during this run, so step 2 knows which frames decoded.
  const fresh: Record<string, PhotoAnalysis> = {}
  const analysisOf = (id: string) => fresh[id] ?? existing[id]

  const clock = new Clock()
  let paused = false
  let stage: Stage = 'measure'
  let measureDone = 0
  let facesDone = 0
  let facesTotal = eyes ? photos.length : 0
  let facesMs = 0
  let facesError: string | undefined

  const report = () => {
    const measureLeft = measureQueue.length - measureDone
    const measureRate = measureDone > 0 && stage === 'measure' ? clock.ms / measureDone : null
    let etaMs: number | null = null
    if (stage === 'measure' && measureRate !== null) {
      etaMs = (measureLeft * measureRate) / 1 + (eyes ? facesTotal * measureRate * FACE_COST_GUESS : 0)
    } else if (stage === 'faces' && facesDone > 0) {
      etaMs = ((facesTotal - facesDone) * facesMs) / facesDone
    } else if (stage === 'done') {
      etaMs = 0
    }
    const done = stage === 'measure' ? measureDone : stage === 'done' ? measureQueue.length + facesTotal : measureQueue.length + facesDone
    onProgress({ stage, done, total: measureQueue.length + facesTotal, paused, etaMs, facesError })
  }

  const visibility = () => {
    const hidden = typeof document !== 'undefined' && document.hidden
    paused = hidden
    if (hidden) clock.stop()
    else if (stage === 'measure' || stage === 'faces') clock.start()
    report()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility)

  const workers: Worker[] = []
  const terminate = () => workers.forEach((w) => w.terminate())
  signal.addEventListener('abort', terminate)

  try {
    // ── Step 1: sharpness + dHash ─────────────────────────────────────────
    report()
    if (measureQueue.length > 0) {
      clock.start()
      let next = 0
      let jobSeq = 0
      const lanes = Array.from({ length: Math.min(concurrency, measureQueue.length) }, async () => {
        const worker = createMeasureWorker()
        workers.push(worker)
        const pending = new Map<number, Pending<MeasureResponse>>()
        worker.onmessage = (event: MessageEvent<MeasureResponse>) => {
          pending.get(event.data.jobId)?.resolve(event.data)
        }
        while (!signal.aborted) {
          await whenVisible(signal)
          if (signal.aborted || next >= measureQueue.length) break
          const photo = measureQueue[next++]
          const jobId = ++jobSeq
          const reply = await ask<MeasureResponse>(
            pending,
            jobId,
            signal,
            { type: 'measured', jobId, ok: false, error: 'timeout' },
            () => worker.postMessage({ type: 'measure', jobId, url: photo.url, maxSide: MEASURE_MAX_SIDE })
          )
          if (signal.aborted) break
          const analysis: PhotoAnalysis = reply.ok
            ? {
                sharpness: reply.sharpness!,
                globalSharpness: reply.globalSharpness!,
                hash: reply.hash!,
                ...(reply.palette ? { palette: reply.palette } : {}),
                ...(reply.subject ? { subject: reply.subject } : {}),
              }
            : { sharpness: NaN, globalSharpness: NaN, hash: '', error: reply.error ?? 'error' }
          fresh[photo.id] = analysis
          onResult(photo.id, analysis)
          measureDone++
          report()
        }
        worker.terminate()
      })
      await Promise.all(lanes)
      clock.stop()
    }
    if (signal.aborted) return

    // ── Step 2: closed eyes (lazy model) ──────────────────────────────────
    const faceQueue = eyes
      ? photos.filter((p) => {
          const a = analysisOf(p.id)
          return a && !a.error && a.faces === undefined
        })
      : []
    facesTotal = faceQueue.length
    if (faceQueue.length > 0) {
      stage = 'model'
      report()
      await whenVisible(signal)
      const worker = createFacesWorker()
      workers.push(worker)
      const pending = new Map<number, Pending<FaceInfo[] | null>>()
      const ready = new Promise<string | null>((resolve) => {
        worker.onmessage = (event: MessageEvent<FacesResponse>) => {
          const data = event.data
          if (data.type === 'ready') resolve(null)
          else if (data.type === 'init-failed') resolve(data.error)
          else {
            pending.get(data.jobId)?.resolve(data.ok ? data.faces ?? [] : null)
          }
        }
        worker.onerror = (event) => resolve(event.message || 'worker error')
        signal.addEventListener('abort', () => resolve('aborted'))
      })
      const own = (path: string) => new URL(path, window.location.origin).href
      worker.postMessage({
        type: 'init',
        wasmLoaderPath: own(MEDIAPIPE_WASM_LOADER),
        wasmBinaryPath: own(MEDIAPIPE_WASM_BINARY),
        modelUrl: own(FACE_MODEL_URL),
      })
      const initError = await ready
      if (signal.aborted) return
      if (initError) {
        facesError = initError
        facesTotal = 0
      } else {
        stage = 'faces'
        let jobId = 0
        for (const photo of faceQueue) {
          await whenVisible(signal)
          if (signal.aborted) return
          const id = ++jobId
          const startedAt = performance.now()
          const faces = await ask<FaceInfo[] | null>(pending, id, signal, null, () =>
            worker.postMessage({ type: 'faces', jobId: id, url: photo.url })
          )
          if (signal.aborted) return
          if (!paused) facesMs += performance.now() - startedAt
          const base = analysisOf(photo.id)!
          // A failed face pass leaves `faces` undefined: retried on the next run.
          if (faces) {
            const analysis = { ...base, faces }
            fresh[photo.id] = analysis
            onResult(photo.id, analysis)
          }
          facesDone++
          report()
        }
      }
      worker.terminate()
    }
    stage = 'done'
    report()
  } finally {
    signal.removeEventListener('abort', terminate)
    terminate()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility)
  }
}

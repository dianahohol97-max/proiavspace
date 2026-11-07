'use client'
/**
 * Background pass over a local folder: a pool of process workers (extract the
 * embedded preview + measure + thumbnail), then the face model on one worker.
 * Same rules as the gallery runner: capped concurrency, pause while the tab is
 * hidden, instant cancel, honest progress and ETA, already-done files skipped.
 */
import { FACE_MODEL_URL, MEDIAPIPE_WASM_BINARY, MEDIAPIPE_WASM_LOADER } from '@/lib/culling/config'
import type { FaceInfo, PhotoAnalysis } from '@/lib/culling/types'
import type { FacesResponse } from '@/lib/culling/workers/protocol'
import type { ProcessResponse } from './protocol'
import type { FileRef } from './source'
import type { FolderItem, ItemMeta } from './types'

export type Stage = 'process' | 'model' | 'faces' | 'done'

export interface FolderProgress {
  stage: Stage
  done: number
  total: number
  paused: boolean
  etaMs: number | null
  facesError?: string
  /** 'GPU' | 'CPU' once the face model is up. */
  delegate?: string
  /** Wall time per stage, ms (benchmarks / UI). */
  timings: { process?: number; model?: number; faces?: number }
}

export interface FolderRunOptions {
  items: FolderItem[]
  files: Map<string, FileRef>
  meta: Record<string, ItemMeta>
  faces: Record<string, FaceInfo[]>
  eyes: boolean
  signal: AbortSignal
  onProcessed: (id: string, result: { meta?: ItemMeta; analysis?: PhotoAnalysis; thumb?: Blob; error?: string }) => void
  onFaces: (id: string, faces: FaceInfo[]) => void
  onProgress: (p: FolderProgress) => void
  concurrency?: number
}

const JOB_TIMEOUT_MS = 60_000
const FACE_COST_GUESS = 2

export function defaultConcurrency(): number {
  const threads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.max(1, Math.min(6, threads - 1))
}

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

function ask<T>(pending: Map<number, (v: T) => void>, jobId: number, signal: AbortSignal, fallback: T, send: () => void): Promise<T> {
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
    pending.set(jobId, settle)
    send()
  })
}

/** Blob + orientation of the image the face model should look at. */
export async function faceSource(item: FolderItem, file: File, meta: ItemMeta) {
  if (item.kind === 'raw' && meta.preview) {
    const p = meta.preview
    return { blob: file.slice(p.offset, p.offset + p.length, 'image/jpeg'), orientation: p.selfOriented ? 1 : meta.orientation, fromImage: !!p.selfOriented }
  }
  return { blob: file as Blob, orientation: 1, fromImage: true }
}

export async function runFolder(o: FolderRunOptions): Promise<void> {
  const { items, files, signal } = o
  const concurrency = o.concurrency ?? defaultConcurrency()
  const queue = items.filter((it) => !o.meta[it.id] || (o.meta[it.id].error && o.meta[it.id].error !== 'heif-unsupported'))
  const meta: Record<string, ItemMeta> = { ...o.meta }
  let stage: Stage = 'process'
  let done = 0
  let facesDone = 0
  let facesTotal = 0
  let paused = false
  let delegate: string | undefined
  let facesError: string | undefined
  const timings: FolderProgress['timings'] = {}
  let activeMs = 0
  let activeFrom = performance.now()
  const active = () => activeMs + (paused ? 0 : performance.now() - activeFrom)
  let facesMs = 0

  const report = () => {
    let etaMs: number | null = null
    const eyesLeft = o.eyes ? items.length : 0
    if (stage === 'process' && done > 0) {
      const per = active() / done
      etaMs = (queue.length - done) * per + (o.eyes ? eyesLeft * per * FACE_COST_GUESS : 0)
    } else if (stage === 'faces' && facesDone > 0) etaMs = ((facesTotal - facesDone) * facesMs) / facesDone
    else if (stage === 'done') etaMs = 0
    const total = stage === 'process' ? queue.length : facesTotal
    const doneNow = stage === 'process' ? done : facesDone
    o.onProgress({ stage, done: doneNow, total, paused, etaMs, facesError, delegate, timings: { ...timings } })
  }
  const onVisibility = () => {
    const hidden = document.hidden
    if (hidden && !paused) activeMs += performance.now() - activeFrom
    if (!hidden && paused) activeFrom = performance.now()
    paused = hidden
    report()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  const workers: Worker[] = []
  const killAll = () => workers.forEach((w) => w.terminate())
  signal.addEventListener('abort', killAll)

  try {
    // ── Step 1: extract + measure + thumbnail ─────────────────────────────
    report()
    const t0 = performance.now()
    let next = 0
    let seq = 0
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        const worker = new Worker(new URL('./process.worker.ts', import.meta.url))
        workers.push(worker)
        const pending = new Map<number, (v: ProcessResponse) => void>()
        worker.onmessage = (e: MessageEvent<ProcessResponse>) => pending.get(e.data.jobId)?.(e.data)
        while (!signal.aborted) {
          await whenVisible(signal)
          if (signal.aborted || next >= queue.length) break
          const item = queue[next++]
          const jobId = ++seq
          let file: File
          try {
            file = await files.get(item.id)!.getFile()
          } catch {
            o.onProcessed(item.id, { error: 'unreadable' })
            done++
            report()
            continue
          }
          const reply = await ask<ProcessResponse>(pending, jobId, signal, { type: 'done', jobId, ok: false, error: 'timeout' }, () =>
            worker.postMessage({ type: 'process', jobId, file, name: item.name, kind: item.kind })
          )
          if (signal.aborted) break
          const m = reply.meta ? { ...reply.meta, ...(reply.ok ? {} : { error: reply.error }) } : undefined
          if (m) meta[item.id] = m
          o.onProcessed(item.id, reply.ok ? { meta: m, analysis: reply.analysis, thumb: reply.thumb } : { meta: m, error: reply.error ?? 'error' })
          done++
          report()
        }
        worker.terminate()
      })
    )
    timings.process = performance.now() - t0
    if (signal.aborted) return

    // ── Step 2: closed eyes ───────────────────────────────────────────────
    const faceQueue = o.eyes ? items.filter((it) => meta[it.id] && !meta[it.id].error && !o.faces[it.id]) : []
    facesTotal = faceQueue.length
    if (faceQueue.length > 0) {
      stage = 'model'
      report()
      const tm = performance.now()
      const worker = new Worker(new URL('../culling/workers/faces.worker.ts', import.meta.url))
      workers.push(worker)
      const pending = new Map<number, (v: FaceInfo[] | null) => void>()
      const ready = new Promise<string | null>((resolve) => {
        worker.onmessage = (e: MessageEvent<FacesResponse>) => {
          const d = e.data
          if (d.type === 'ready') {
            delegate = d.delegate
            resolve(null)
          } else if (d.type === 'init-failed') resolve(d.error)
          else pending.get(d.jobId)?.(d.ok ? d.faces ?? [] : null)
        }
        worker.onerror = (e) => resolve(e.message || 'worker error')
        signal.addEventListener('abort', () => resolve('aborted'))
      })
      const own = (p: string) => new URL(p, window.location.origin).href
      worker.postMessage({ type: 'init', wasmLoaderPath: own(MEDIAPIPE_WASM_LOADER), wasmBinaryPath: own(MEDIAPIPE_WASM_BINARY), modelUrl: own(FACE_MODEL_URL) })
      const initError = await ready
      timings.model = performance.now() - tm
      if (signal.aborted) return
      if (initError) {
        facesError = initError
        facesTotal = 0
      } else {
        stage = 'faces'
        const tf = performance.now()
        let jobId = 0
        for (const item of faceQueue) {
          await whenVisible(signal)
          if (signal.aborted) return
          const id = ++jobId
          const started = performance.now()
          let faces: FaceInfo[] | null = null
          try {
            const file = await files.get(item.id)!.getFile()
            const src = await faceSource(item, file, meta[item.id])
            faces = await ask<FaceInfo[] | null>(pending, id, signal, null, () => worker.postMessage({ type: 'faces', jobId: id, ...src }))
          } catch {
            faces = null
          }
          if (signal.aborted) return
          if (!paused) facesMs += performance.now() - started
          if (faces) o.onFaces(item.id, faces)
          facesDone++
          report()
        }
        timings.faces = performance.now() - tf
      }
      worker.terminate()
    }
    stage = 'done'
    report()
  } finally {
    signal.removeEventListener('abort', killAll)
    killAll()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }
}

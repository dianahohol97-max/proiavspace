'use client'

/**
 * Starts an export: in a Web Worker (OffscreenCanvas — the editor stays
 * responsive), or on the main thread when the browser can't (old Safari: no
 * OffscreenCanvas / FontFace in workers). Progress and cancel work the same
 * way in both; cancelling a worker export terminates it, freeing its memory.
 */
import { ExportError } from './render'
import { exportCore, type CoreRequest, type ExportKind, type ExportProgress, type ExportResult } from './core'

export { spreadLabel } from './core'
export type { ExportKind, ExportProgress, ExportResult } from './core'

/** Signed GET URLs of originals (server: short-lived B2 links; demo: the bundled files). */
export type OriginalUrlSource = (assetIds: string[]) => Promise<Record<string, string>>

export interface ExportRequest extends CoreRequest {
  originalUrls: OriginalUrlSource
  onProgress: (p: ExportProgress) => void
  signal?: AbortSignal
  /** Tests/diagnostics: force one engine. */
  engine?: 'worker' | 'main'
}

export interface ExportOutcome extends ExportResult {
  engine: 'worker' | 'main'
}

function onMainThread(request: ExportRequest): Promise<ExportOutcome> {
  return exportCore(stripDeps(request), {
    getUrls: request.originalUrls,
    onProgress: request.onProgress,
    signal: request.signal,
  }).then((r) => ({ ...r, engine: 'main' as const }))
}

function stripDeps(r: ExportRequest): CoreRequest {
  return { project: r.project, photos: r.photos, kind: r.kind, spreadIds: r.spreadIds, cropMarks: r.cropMarks }
}

export function runExport(request: ExportRequest): Promise<ExportOutcome> {
  if (request.engine === 'main' || typeof Worker === 'undefined') return onMainThread(request)
  return new Promise<ExportOutcome>((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url))
    } catch {
      onMainThread(request).then(resolve, reject)
      return
    }
    let settled = false
    const finish = () => {
      settled = true
      worker.terminate()
      request.signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      if (settled) return
      finish()
      reject(new ExportError('aborted', 'Експорт скасовано'))
    }
    request.signal?.addEventListener('abort', onAbort)
    worker.onerror = (e) => {
      if (settled) return
      // The worker script itself failed to load/run: fall back once.
      finish()
      console.warn('album export worker failed, using main thread', e.message)
      onMainThread(request).then(resolve, reject)
    }
    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as
        | { type: 'progress'; p: ExportProgress }
        | { type: 'need-urls'; reqId: number; ids: string[] }
        | { type: 'done'; blob: Blob; fileName: string }
        | { type: 'error'; code: string; message: string }
        | { type: 'unsupported'; reason: string }
      if (settled) return
      switch (msg.type) {
        case 'progress':
          request.onProgress(msg.p)
          break
        case 'need-urls':
          request
            .originalUrls(msg.ids)
            .then((urls) => worker.postMessage({ type: 'urls', reqId: msg.reqId, urls }))
            .catch((e: Error) => worker.postMessage({ type: 'urls', reqId: msg.reqId, error: e.message }))
          break
        case 'done':
          finish()
          resolve({ blob: msg.blob, fileName: msg.fileName, engine: 'worker' })
          break
        case 'error':
          finish()
          reject(new ExportError(msg.code as ExportError['code'], msg.message))
          break
        case 'unsupported':
          finish()
          onMainThread(request).then(resolve, reject)
          break
      }
    }
    worker.postMessage({ type: 'start', request: stripDeps(request) })
  })
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

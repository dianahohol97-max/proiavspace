/**
 * Export Web Worker: renders on OffscreenCanvas so the editor stays
 * responsive. Talks to the page with messages:
 *   page → worker  {type:'start', request}  {type:'urls', reqId, urls|error}
 *   worker → page  {type:'progress', p}  {type:'need-urls', reqId, ids}
 *                  {type:'done', blob, fileName}  {type:'error', code, message}
 *                  {type:'unsupported', reason}  — the page then exports on the main thread
 * Cancel = the page terminates the worker (memory is freed at once).
 */
import { exportCore, usedFonts, type CoreRequest } from './core'

type Msg =
  | { type: 'start'; request: CoreRequest }
  | { type: 'urls'; reqId: number; urls?: Record<string, string>; error?: string }

const scope = self as unknown as {
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent<Msg>) => void) | null
  fonts?: unknown
}

const waiting = new Map<number, { resolve(urls: Record<string, string>): void; reject(e: Error): void }>()
let seq = 0

scope.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'urls') {
    const w = waiting.get(msg.reqId)
    waiting.delete(msg.reqId)
    if (!w) return
    if (msg.error) w.reject(new Error(msg.error))
    else w.resolve(msg.urls ?? {})
    return
  }
  if (msg.type !== 'start') return
  const needsFonts = usedFonts(msg.request.project.spreads.filter((s) => msg.request.spreadIds.includes(s.id))).length > 0
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined' || (needsFonts && (!scope.fonts || typeof FontFace === 'undefined'))) {
    scope.postMessage({ type: 'unsupported', reason: 'OffscreenCanvas / FontFace у воркері недоступні' })
    return
  }
  try {
    const result = await exportCore(msg.request, {
      getUrls: (ids) =>
        new Promise((resolve, reject) => {
          const reqId = ++seq
          waiting.set(reqId, { resolve, reject })
          scope.postMessage({ type: 'need-urls', reqId, ids })
        }),
      onProgress: (p) => scope.postMessage({ type: 'progress', p }),
    })
    scope.postMessage({ type: 'done', blob: result.blob, fileName: result.fileName })
  } catch (error) {
    const e = error as Error & { code?: string }
    scope.postMessage({ type: 'error', code: e.code ?? 'failed', message: e.message || 'Експорт не вдався' })
  }
}

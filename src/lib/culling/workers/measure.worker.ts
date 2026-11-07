/// <reference lib="webworker" />
/**
 * Sharpness + dHash for one rendition at a time. No libraries: fetch, decode
 * into an OffscreenCanvas, read pixels, run the pure functions.
 */
import { dHash } from '../dhash'
import { sharpness, toGray } from '../sharpness'
import { loadScaled, type MeasureRequest, type MeasureResponse } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<MeasureRequest>) => {
  const { jobId, url, maxSide } = event.data
  let reply: MeasureResponse
  try {
    const { canvas, width, height } = await loadScaled(url, maxSide)
    const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
    const gray = toGray(context.getImageData(0, 0, width, height).data, width, height)
    const s = sharpness(gray, width, height)
    reply = { type: 'measured', jobId, ok: true, sharpness: s.score, globalSharpness: s.global, hash: dHash(gray, width, height) }
  } catch (error) {
    reply = { type: 'measured', jobId, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  scope.postMessage(reply)
}

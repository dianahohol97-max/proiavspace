/// <reference lib="webworker" />
/**
 * One file → embedded preview (RAW) or the file itself (JPEG/HEIC) → decode
 * once → sharpness + dHash at ≤ 512 px and a grid thumbnail. Reads only the
 * header bytes and the preview's own range from the file.
 */
import { dHash } from '@/lib/culling/dhash'
import { sharpness, toGray } from '@/lib/culling/sharpness'
import { extractPreview } from './raw/extract'
import { BlobReader } from './raw/reader'
import { decode, drawOriented, orientedSize } from './orient'
import type { ProcessRequest, ProcessResponse } from './protocol'
import type { ItemMeta } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope
const ANALYSIS_SIDE = 512
const THUMB_SIDE = 400

function fit(w: number, h: number, side: number): [number, number] {
  const s = Math.min(1, side / Math.max(w, h))
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]
}

async function handle(req: ProcessRequest): Promise<ProcessResponse> {
  const { jobId, file, kind, name } = req
  let meta: ItemMeta
  let blob: Blob
  let manual = 1
  let fromImage = false
  if (kind === 'heif') {
    blob = file
    fromImage = true
    meta = { format: 'heif', preview: null, full: null, orientation: 1, takenAt: null, width: 0, height: 0 }
  } else {
    const info = await extractPreview(new BlobReader(file), name)
    if (!info) return { type: 'done', jobId, ok: false, error: 'no-preview' }
    if (kind === 'jpeg') {
      blob = file
      fromImage = true
    } else {
      blob = file.slice(info.preview.offset, info.preview.offset + info.preview.length, 'image/jpeg')
      fromImage = !!info.preview.selfOriented
      manual = fromImage ? 1 : info.orientation
    }
    meta = {
      format: info.format,
      preview: kind === 'raw' ? info.preview : null,
      full: kind === 'raw' ? info.full : null,
      orientation: info.orientation,
      takenAt: info.takenAt,
      width: 0,
      height: 0,
    }
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await decode(blob, fromImage)
  } catch {
    return { type: 'done', jobId, ok: false, error: kind === 'heif' ? 'heif-unsupported' : 'decode', meta }
  }
  try {
    const [W, H] = orientedSize(bitmap.width, bitmap.height, manual)
    meta.width = W
    meta.height = H
    const [aw, ah] = fit(W, H, ANALYSIS_SIDE)
    const canvas = new OffscreenCanvas(aw, ah)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    drawOriented(ctx, bitmap, manual, aw, ah)
    const gray = toGray(ctx.getImageData(0, 0, aw, ah).data, aw, ah)
    const s = sharpness(gray, aw, ah)
    const [tw, th] = fit(W, H, THUMB_SIDE)
    const tc = new OffscreenCanvas(tw, th)
    drawOriented(tc.getContext('2d')!, bitmap, manual, tw, th)
    const thumb = await tc.convertToBlob({ type: 'image/jpeg', quality: 0.78 })
    return {
      type: 'done',
      jobId,
      ok: true,
      meta,
      analysis: { sharpness: s.score, globalSharpness: s.global, hash: dHash(gray, aw, ah) },
      thumb,
    }
  } finally {
    bitmap.close()
  }
}

scope.onmessage = async (event: MessageEvent<ProcessRequest>) => {
  let reply: ProcessResponse
  try {
    reply = await handle(event.data)
  } catch (error) {
    reply = { type: 'done', jobId: event.data.jobId, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  scope.postMessage(reply)
}

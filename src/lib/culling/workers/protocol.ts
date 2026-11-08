/** Messages between the culling runner (main thread) and its Web Workers. */
import type { FaceInfo, PaletteColor, SubjectInfo } from '../types'

export interface MeasureRequest {
  type: 'measure'
  jobId: number
  url: string
  /** Longest side the frame is scaled to before measuring. */
  maxSide: number
}

export interface MeasureResponse {
  type: 'measured'
  jobId: number
  ok: boolean
  sharpness?: number
  globalSharpness?: number
  hash?: string
  palette?: PaletteColor[]
  subject?: SubjectInfo
  error?: string
}

export interface FacesInit {
  type: 'init'
  /** Absolute URLs on our own origin. */
  wasmLoaderPath: string
  wasmBinaryPath: string
  modelUrl: string
}

export interface FacesRequest {
  type: 'faces'
  jobId: number
  url: string
}

export type FacesResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'init-failed'; error: string }
  | { type: 'faces'; jobId: number; ok: boolean; faces?: FaceInfo[]; error?: string }

/** Fetch a rendition and decode it, scaled so its longest side ≤ maxSide. */
export async function loadScaled(
  url: string,
  maxSide: number
): Promise<{ canvas: OffscreenCanvas; width: number; height: number }> {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!response.ok) throw new Error(`http ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('no 2d context')
    context.drawImage(bitmap, 0, 0, width, height)
    return { canvas, width, height }
  } finally {
    bitmap.close()
  }
}

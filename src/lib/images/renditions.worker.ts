/// <reference lib="webworker" />
/**
 * Web Worker: decodes one image and encodes its renditions on an
 * OffscreenCanvas, off the main thread — a 24 MP PNG takes ~1 s of pure CPU
 * to decode and the tab must stay responsive meanwhile. Same rules as the
 * main-thread path (./renditionCore.ts). Driven by ./renditionPool.ts.
 */
import { renderFromBitmap, type RenderCanvas } from './renditionCore'

export interface RenditionJob {
  id: number
  file: File
  watermarkText?: string
  mobile?: boolean
}

export type RenditionReply =
  | {
      id: number
      ok: true
      variants: { name: string; blob: Blob; contentType: string }[]
      width?: number
      height?: number
    }
  /** `unsupported`: no OffscreenCanvas 2D here — the pool falls back to the main thread. */
  | { id: number; ok: false; unsupported: boolean; message: string }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RenditionJob>) => void) | null
  postMessage(message: RenditionReply): void
}

function makeCanvas(width: number, height: number): RenderCanvas {
  return new OffscreenCanvas(width, height)
}

function encode(canvas: RenderCanvas, type: string, quality: number): Promise<Blob | null> {
  return (canvas as OffscreenCanvas).convertToBlob({ type, quality }).catch(() => null)
}

scope.onmessage = async (event) => {
  const { id, file, watermarkText, mobile } = event.data
  if (typeof OffscreenCanvas === 'undefined' || !new OffscreenCanvas(1, 1).getContext('2d')) {
    scope.postMessage({ id, ok: false, unsupported: true, message: 'no OffscreenCanvas 2d' })
    return
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Undecodable here (e.g. some HEICs): no renditions, like the main thread.
    scope.postMessage({ id, ok: true, variants: [] })
    return
  }
  try {
    const result = await renderFromBitmap(bitmap, makeCanvas, encode, watermarkText, { mobile })
    scope.postMessage({ id, ok: true, ...result })
  } catch (cause) {
    scope.postMessage({ id, ok: false, unsupported: false, message: String(cause) })
  } finally {
    bitmap.close()
  }
}

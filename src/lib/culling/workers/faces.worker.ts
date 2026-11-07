/// <reference lib="webworker" />
/**
 * Closed-eyes pass: MediaPipe Face Landmarker (Apache-2.0) with blendshapes.
 * The library, its wasm and the model are fetched only when the photographer
 * starts the culling pass — this worker is created on demand and the library
 * is a separate chunk.
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { FaceInfo } from '../types'
import { decode, drawOriented, orientedSize } from '@/lib/folder-cull/orient'
import { loadScaled, type FacesInit, type FacesRequest, type FacesResponse } from './protocol'

/** A local blob (folder culling), oriented and scaled like loadScaled(). */
async function loadBlob(blob: Blob, orientation: number, fromImage: boolean, maxSide: number) {
  const bitmap = await decode(blob, fromImage)
  try {
    const [W, H] = orientedSize(bitmap.width, bitmap.height, orientation)
    const scale = Math.min(1, maxSide / Math.max(W, H))
    const width = Math.max(1, Math.round(W * scale))
    const height = Math.max(1, Math.round(H * scale))
    const canvas = new OffscreenCanvas(width, height)
    drawOriented(canvas.getContext('2d')!, bitmap, orientation, width, height)
    return { canvas, width, height }
  } finally {
    bitmap.close()
  }
}

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = (message: FacesResponse) => scope.postMessage(message)

/** Faces are judged on the same ~512 px rendition (a bit larger if the source has it). */
const FACE_MAX_SIDE = 768

let landmarker: FaceLandmarker | null = null

async function init({ wasmLoaderPath, wasmBinaryPath, modelUrl }: FacesInit) {
  const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
  // An explicit fileset: no feature probing, no CDN — only our own files.
  const fileset = { wasmLoaderPath, wasmBinaryPath }
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'IMAGE' as const,
    numFaces: 8,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
  })
  // A real GPU is several times faster; a software GL (SwiftShader, llvmpipe —
  // VMs, blocklisted drivers) is slower than the CPU path, so skip it.
  if (hardwareGl()) {
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'))
      post({ type: 'ready', delegate: 'GPU' })
      return
    } catch {
      /* fall back to CPU */
    }
  }
  landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'))
  post({ type: 'ready', delegate: 'CPU' })
}

function hardwareGl(): boolean {
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) return false
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
  } catch {
    return false
  }
}

async function detect({ jobId, url, blob, orientation = 1, fromImage = false }: FacesRequest) {
  if (!landmarker) {
    post({ type: 'faces', jobId, ok: false, error: 'not ready' })
    return
  }
  try {
    const { canvas, width, height } = blob
      ? await loadBlob(blob, orientation, fromImage, FACE_MAX_SIDE)
      : await loadScaled(url!, FACE_MAX_SIDE)
    const result = landmarker.detect(canvas)
    const shorter = Math.min(width, height)
    const faces: FaceInfo[] = result.faceLandmarks.map((points, i) => {
      let minX = 1
      let maxX = 0
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
      }
      const categories = result.faceBlendshapes?.[i]?.categories ?? []
      const score = (name: string) => categories.find((c) => c.categoryName === name)?.score ?? 0
      return {
        size: ((maxX - minX) * width) / shorter,
        blinkLeft: score('eyeBlinkLeft'),
        blinkRight: score('eyeBlinkRight'),
      }
    })
    post({ type: 'faces', jobId, ok: true, faces })
  } catch (error) {
    post({ type: 'faces', jobId, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

scope.onmessage = (event: MessageEvent<FacesInit | FacesRequest>) => {
  const data = event.data
  if (data.type === 'init') {
    init(data).catch((error) => post({ type: 'init-failed', error: error instanceof Error ? error.message : String(error) }))
  } else {
    void detect(data)
  }
}

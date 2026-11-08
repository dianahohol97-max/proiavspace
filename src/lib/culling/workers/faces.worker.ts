/// <reference lib="webworker" />
/**
 * Closed-eyes pass: MediaPipe Face Landmarker (Apache-2.0) with blendshapes.
 * The library, its wasm and the model are fetched only when the photographer
 * starts the culling pass — this worker is created on demand and the library
 * is a separate chunk.
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { FaceInfo } from '../types'
import { loadScaled, type FacesInit, type FacesRequest, type FacesResponse } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = (message: FacesResponse) => scope.postMessage(message)

/** Faces are judged on the same ~512 px rendition (a bit larger if the source has it). */
const FACE_MAX_SIDE = 768

let landmarker: FaceLandmarker | null = null

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

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
  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'))
    post({ type: 'ready', delegate: 'GPU' })
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'))
    post({ type: 'ready', delegate: 'CPU' })
  }
}

async function detect({ jobId, url }: FacesRequest) {
  if (!landmarker) {
    post({ type: 'faces', jobId, ok: false, error: 'not ready' })
    return
  }
  try {
    const { canvas, width, height } = await loadScaled(url, FACE_MAX_SIDE)
    const result = landmarker.detect(canvas)
    const shorter = Math.min(width, height)
    const faces: FaceInfo[] = result.faceLandmarks.map((points, i) => {
      let minX = 1
      let maxX = 0
      let minY = 1
      let maxY = 0
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      const categories = result.faceBlendshapes?.[i]?.categories ?? []
      const score = (name: string) => categories.find((c) => c.categoryName === name)?.score ?? 0
      return {
        size: ((maxX - minX) * width) / shorter,
        blinkLeft: score('eyeBlinkLeft'),
        blinkRight: score('eyeBlinkRight'),
        // Box for the album focal point (landmarks are normalised to the frame).
        x: clamp01(minX),
        y: clamp01(minY),
        w: clamp01(maxX) - clamp01(minX),
        h: clamp01(maxY) - clamp01(minY),
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

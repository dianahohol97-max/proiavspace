/**
 * Switches and external assets of the culling feature.
 *
 * HIDE_FROM_CLIENT: «Сховати від клієнта» needs assets.hidden_from_client
 * (migration in branch db/1, not applied yet). Until then the button is shown
 * disabled. To turn it on after db/1: set NEXT_PUBLIC_CULLING_HIDE=1 and pass
 * an `onHide` server action to <CullingPanel> (see docs/AI_CULLING.md).
 */
export const HIDE_FROM_CLIENT_ENABLED = process.env.NEXT_PUBLIC_CULLING_HIDE === '1'

/** Pinned to the installed @mediapipe/tasks-vision version (package.json). */
export const MEDIAPIPE_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'

/** Face Landmarker model with blendshapes (float16, ~3.6 MB, Apache-2.0). */
export const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** Renditions are measured at this longest side (thumb is 512 already). */
export const MEASURE_MAX_SIDE = 512

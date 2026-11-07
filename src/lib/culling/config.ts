/**
 * External assets of the culling feature — all served from our own origin
 * (public/vendor/mediapipe), never from a third-party CDN. The paths carry the
 * version, so they are cached as immutable; tests/audit-storage/culling.test.ts
 * checks the wasm matches the installed @mediapipe/tasks-vision.
 *
 * Only the SIMD build of the wasm is shipped: every browser that passes the
 * panel's OffscreenCanvas check has wasm SIMD (Chrome 91+, Firefox 89+,
 * Safari 16.4+).
 */
export const MEDIAPIPE_VERSION = '1.1.1'
export const MEDIAPIPE_DIR = `/vendor/mediapipe/tasks-vision-${MEDIAPIPE_VERSION}/wasm`
export const MEDIAPIPE_WASM_LOADER = `${MEDIAPIPE_DIR}/vision_wasm_internal.js`
export const MEDIAPIPE_WASM_BINARY = `${MEDIAPIPE_DIR}/vision_wasm_internal.wasm`

/** Face Landmarker with blendshapes (float16, v1, Apache-2.0), 3 758 596 bytes. */
export const FACE_MODEL_URL = '/vendor/mediapipe/models/face_landmarker-float16-v1.task'

/** Renditions are measured at this longest side (thumb is 512 already). */
export const MEASURE_MAX_SIDE = 512

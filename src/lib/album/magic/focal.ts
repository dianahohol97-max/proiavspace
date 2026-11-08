/**
 * Focal point of a frame for the crop in a slot: the slot shows the part of
 * the photo around (fx, fy) (src/lib/album/crop.ts). Priority:
 *   1. the photographer's own focal point in the gallery;
 *   2. faces — the box around the people in the frame, extended upward to
 *      the top of the head (face landmarks stop at the forehead), so a crop
 *      never cuts heads;
 *   3. the crisp subject (Laplacian energy) when there is no face;
 *   4. slightly above the centre.
 */
import type { FaceInfo, PhotoAnalysis } from '@/lib/culling/types'
import type { AlbumPhoto } from '../types'

export type FocalSource = 'photographer' | 'faces' | 'subject' | 'default'

export interface Focal {
  fx: number
  fy: number
  source: FocalSource
  /** Heads region (image fractions) when faces were found — used to check a crop keeps them. */
  heads?: { x0: number; y0: number; x1: number; y1: number }
}

/** Head above the landmarks' top (forehead) as a share of the face box height. */
const HEAD_TOP = 0.45
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

function boxed(faces: FaceInfo[] | undefined): Required<Pick<FaceInfo, 'x' | 'y' | 'w' | 'h' | 'size'>>[] {
  return (faces ?? []).filter(
    (f): f is FaceInfo & { x: number; y: number; w: number; h: number } =>
      typeof f.x === 'number' && typeof f.y === 'number' && typeof f.w === 'number' && typeof f.h === 'number' && f.w > 0.01
  )
}

/** Faces that matter: at least 40 % of the largest face (people in the far background do not steer the crop). */
export function mainFaces(faces: FaceInfo[] | undefined) {
  const list = boxed(faces)
  if (!list.length) return []
  const largest = Math.max(...list.map((f) => f.size))
  return list.filter((f) => f.size >= largest * 0.4)
}

export function focalPoint(photo: Pick<AlbumPhoto, 'focalX' | 'focalY'>, analysis: PhotoAnalysis | undefined): Focal {
  if (photo.focalX != null && photo.focalY != null) return { fx: photo.focalX, fy: photo.focalY, source: 'photographer' }
  const faces = mainFaces(analysis?.faces)
  if (faces.length) {
    const x0 = Math.min(...faces.map((f) => f.x))
    const x1 = Math.max(...faces.map((f) => f.x + f.w))
    const y0 = clamp01(Math.min(...faces.map((f) => f.y - f.h * HEAD_TOP)))
    const y1 = Math.max(...faces.map((f) => f.y + f.h))
    return {
      fx: round(clamp01((x0 + x1) / 2)),
      fy: round(clamp01((y0 + y1) / 2)),
      source: 'faces',
      heads: { x0, y0, x1, y1 },
    }
  }
  const s = analysis?.subject
  if (s && s.size < 0.85) return { fx: round(clamp01(s.x)), fy: round(clamp01(s.y)), source: 'subject' }
  return { fx: 0.5, fy: 0.45, source: 'default' }
}

const round = (v: number) => Math.round(v * 1000) / 1000

/**
 * The visible window (image fractions) of a photo of aspect `imageAspect`
 * filling a slot of aspect `slotAspect` («cover» fit, zoom 1, no rotation),
 * centred on (fx, fy) where the edges allow — same rule as crop.ts.
 */
export function visibleWindow(imageAspect: number, slotAspect: number, fx: number, fy: number) {
  let vw = 1
  let vh = 1
  if (imageAspect > slotAspect) vw = slotAspect / imageAspect
  else vh = imageAspect / slotAspect
  const x0 = Math.min(Math.max(fx - vw / 2, 0), 1 - vw)
  const y0 = Math.min(Math.max(fy - vh / 2, 0), 1 - vh)
  return { x0, y0, x1: x0 + vw, y1: y0 + vh }
}

/** Do the heads stay whole in a slot of this aspect? True when there are no faces. */
export function headsFit(photo: Pick<AlbumPhoto, 'width' | 'height'>, focal: Focal, slotAspect: number, tolerance = 0.01): boolean {
  if (!focal.heads) return true
  const w = visibleWindow(photo.width / photo.height, slotAspect, focal.fx, focal.fy)
  const h = focal.heads
  return h.x0 >= w.x0 - tolerance && h.x1 <= w.x1 + tolerance && h.y0 >= w.y0 - tolerance && h.y1 <= w.y1 + tolerance
}

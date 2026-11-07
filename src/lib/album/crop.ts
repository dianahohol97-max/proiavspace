/**
 * Crop of a photo inside a slot: «cover» fit × zoom, positioned so the focal
 * point sits at the slot centre as far as the image edges allow. The editor
 * (CSS) and the export (canvas) both draw from computeCrop, so what the
 * photographer sees is what gets printed.
 */
import { MM_PER_INCH } from './geometry'

export interface CropResult {
  /** Visible part of the image, in image fractions (0..1). */
  x: number
  y: number
  w: number
  h: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

export function computeCrop(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  zoom: number,
  fx: number,
  fy: number
): CropResult {
  const imageAspect = imageWidth / imageHeight
  const slotAspect = slotWidth / slotHeight
  const z = clamp(zoom || 1, MIN_ZOOM, MAX_ZOOM)
  // Fraction of the image visible at zoom 1 («cover»): the tighter axis is 1.
  let w = slotAspect > imageAspect ? 1 : slotAspect / imageAspect
  let h = slotAspect > imageAspect ? imageAspect / slotAspect : 1
  w /= z
  h /= z
  const x = clamp(clamp(fx, 0, 1) - w / 2, 0, 1 - w)
  const y = clamp(clamp(fy, 0, 1) - h / 2, 0, 1 - h)
  return { x, y, w, h }
}

/**
 * Effective print resolution of the photo in the slot: original pixels across
 * the visible part divided by the slot width in inches.
 */
export function effectiveDpi(
  originalWidth: number,
  originalHeight: number,
  slotWidthMm: number,
  slotHeightMm: number,
  zoom: number
): number {
  const crop = computeCrop(originalWidth, originalHeight, slotWidthMm, slotHeightMm, zoom, 0.5, 0.5)
  const pixelsAcross = crop.w * originalWidth
  return pixelsAcross / (slotWidthMm / MM_PER_INCH)
}

export type DpiLevel = 'ok' | 'low' | 'bad'

/** below the profile DPI → 'low' (warning); below half of it → 'bad' (will look soft in print). */
export function dpiLevel(actual: number, required: number): DpiLevel {
  if (actual >= required - 0.5) return 'ok'
  if (actual >= required / 2) return 'low'
  return 'bad'
}

/**
 * New focal point after dragging the image by (dxMm, dyMm) inside the slot:
 * moving the picture right reveals more of its left side.
 */
export function panFocal(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  zoom: number,
  fx: number,
  fy: number,
  dxMm: number,
  dyMm: number
): { fx: number; fy: number } {
  const crop = computeCrop(imageWidth, imageHeight, slotWidth, slotHeight, zoom, fx, fy)
  // Start from the effective (clamped) centre so dragging never «sticks».
  const cx = crop.x + crop.w / 2
  const cy = crop.y + crop.h / 2
  const nx = cx - (dxMm / slotWidth) * crop.w
  const ny = cy - (dyMm / slotHeight) * crop.h
  const next = computeCrop(imageWidth, imageHeight, slotWidth, slotHeight, zoom, nx, ny)
  return { fx: next.x + next.w / 2, fy: next.y + next.h / 2 }
}

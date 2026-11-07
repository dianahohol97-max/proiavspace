/**
 * Placement of a photo inside a slot: «cover» fit × zoom, rotated by the
 * slot's rotation, positioned so the focal point sits at the slot centre as
 * far as the image edges allow (no empty corners, also when rotated). The
 * editor (CSS), the export (canvas) and the DPI check all use placement(), so
 * what the photographer sees is what gets printed.
 *
 * Geometry: the slot (w×h) rotated by −θ must fit inside the image. Its
 * extent along the image axes is ex = (w|cos θ| + h|sin θ|)/2,
 * ey = (w|sin θ| + h|cos θ|)/2 — containment of that box is exact for an
 * axis-aligned image, so the fit is the tightest possible.
 */
import { MM_PER_INCH } from './geometry'

export interface Placement {
  /** Slot units (mm) per original image pixel. */
  k: number
  /** Image point (original px) that lands on the slot centre. */
  cx: number
  cy: number
  /** Rotation in radians, clockwise. */
  theta: number
  /** Half-extents of the visible area along the image axes, in image px. */
  hx: number
  hy: number
}

export interface CropResult {
  /** Visible part of the image, in image fractions (0..1) — the bounding box when rotated. */
  x: number
  y: number
  w: number
  h: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

export function normalizeRotation(deg: number | undefined): number {
  if (!deg || !Number.isFinite(deg)) return 0
  let r = deg % 360
  if (r > 180) r -= 360
  if (r <= -180) r += 360
  return Math.round(r * 100) / 100
}

export function placement(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  zoom: number,
  fx: number,
  fy: number,
  rotationDeg = 0
): Placement {
  const theta = (normalizeRotation(rotationDeg) * Math.PI) / 180
  const c = Math.abs(Math.cos(theta))
  const s = Math.abs(Math.sin(theta))
  const ex = (slotWidth * c + slotHeight * s) / 2
  const ey = (slotWidth * s + slotHeight * c) / 2
  const k = Math.max((2 * ex) / imageWidth, (2 * ey) / imageHeight) * clamp(zoom || 1, MIN_ZOOM, MAX_ZOOM)
  const hx = Math.min(ex / k, imageWidth / 2)
  const hy = Math.min(ey / k, imageHeight / 2)
  const cx = clamp(clamp(fx, 0, 1) * imageWidth, hx, imageWidth - hx)
  const cy = clamp(clamp(fy, 0, 1) * imageHeight, hy, imageHeight - hy)
  return { k, cx, cy, theta, hx, hy }
}

/** Visible area in image fractions (axis-aligned; for rotation 0 it is the exact crop). */
export function computeCrop(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  zoom: number,
  fx: number,
  fy: number,
  rotationDeg = 0
): CropResult {
  const p = placement(imageWidth, imageHeight, slotWidth, slotHeight, zoom, fx, fy, rotationDeg)
  return {
    x: (p.cx - p.hx) / imageWidth,
    y: (p.cy - p.hy) / imageHeight,
    w: (2 * p.hx) / imageWidth,
    h: (2 * p.hy) / imageHeight,
  }
}

/**
 * Effective print resolution of the photo in the slot: original pixels per
 * inch of print (rotation needs a bigger zoom to cover the slot, so it costs DPI).
 */
export function effectiveDpi(
  originalWidth: number,
  originalHeight: number,
  slotWidthMm: number,
  slotHeightMm: number,
  zoom: number,
  rotationDeg = 0
): number {
  const p = placement(originalWidth, originalHeight, slotWidthMm, slotHeightMm, zoom, 0.5, 0.5, rotationDeg)
  return MM_PER_INCH / p.k
}

export type DpiLevel = 'ok' | 'low' | 'bad'

/** below the profile DPI → 'low' (warning); below half of it → 'bad' (will look soft in print). */
export function dpiLevel(actual: number, required: number): DpiLevel {
  if (actual >= required - 0.5) return 'ok'
  if (actual >= required / 2) return 'low'
  return 'bad'
}

/**
 * New focal point after dragging the image by (dxMm, dyMm) inside the slot
 * (screen directions): moving the picture right reveals more of its left side,
 * also when it is rotated.
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
  dyMm: number,
  rotationDeg = 0
): { fx: number; fy: number } {
  const p = placement(imageWidth, imageHeight, slotWidth, slotHeight, zoom, fx, fy, rotationDeg)
  // Screen delta → image axes (inverse rotation), then mm → px.
  const cos = Math.cos(p.theta)
  const sin = Math.sin(p.theta)
  const ix = (dxMm * cos + dyMm * sin) / p.k
  const iy = (-dxMm * sin + dyMm * cos) / p.k
  const next = placement(imageWidth, imageHeight, slotWidth, slotHeight, zoom, (p.cx - ix) / imageWidth, (p.cy - iy) / imageHeight, rotationDeg)
  return { fx: next.cx / imageWidth, fy: next.cy / imageHeight }
}

/**
 * CSS for the <img> inside a slot box of wPx×hPx screen pixels: the image is
 * laid out at its natural aspect, then rotated around the point that must sit
 * at the slot centre.
 */
export function slotImageStyle(
  imageWidth: number,
  imageHeight: number,
  slotWidthMm: number,
  slotHeightMm: number,
  wPx: number,
  zoom: number,
  fx: number,
  fy: number,
  rotationDeg = 0
): { width: number; height: number; left: number; top: number; transformOrigin: string; transform?: string } {
  const p = placement(imageWidth, imageHeight, slotWidthMm, slotHeightMm, zoom, fx, fy, rotationDeg)
  const pxPerMm = wPx / slotWidthMm
  const scale = p.k * pxPerMm // screen px per image px
  const ox = p.cx * scale
  const oy = p.cy * scale
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
    left: (slotWidthMm * pxPerMm) / 2 - ox,
    top: (slotHeightMm * pxPerMm) / 2 - oy,
    transformOrigin: `${ox}px ${oy}px`,
    transform: p.theta ? `rotate(${(p.theta * 180) / Math.PI}deg)` : undefined,
  }
}

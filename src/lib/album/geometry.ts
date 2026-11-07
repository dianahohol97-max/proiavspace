/**
 * mm ↔ px, the printable format of a spread/cover, page boxes and guides.
 * One source of truth for the editor overlay and the export renderer.
 */
import type { PrintSpec, Rect, SpreadKind } from './types'

export const MM_PER_INCH = 25.4

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH
}

/** Points (1/72 in) — PDF page units. */
export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * 72
}

export interface SpreadFormat {
  kind: SpreadKind
  /** Trim size. */
  widthMm: number
  heightMm: number
  bleedMm: number
  safeMm: number
  /** Cover only: spine width in the middle (0 for spreads). */
  spineMm: number
}

export function formatFor(spec: PrintSpec, kind: SpreadKind): SpreadFormat {
  if (kind === 'cover' && spec.cover) {
    return {
      kind,
      widthMm: spec.cover.widthMm,
      heightMm: spec.cover.heightMm,
      bleedMm: spec.cover.bleedMm,
      safeMm: spec.safeMm,
      spineMm: spec.cover.spineMm,
    }
  }
  return {
    kind,
    widthMm: spec.spreadWidthMm,
    heightMm: spec.spreadHeightMm,
    bleedMm: spec.bleedMm,
    safeMm: spec.safeMm,
    spineMm: 0,
  }
}

/** Full sheet incl. bleed, in mm. */
export function sheetSizeMm(format: SpreadFormat): { widthMm: number; heightMm: number } {
  return { widthMm: format.widthMm + 2 * format.bleedMm, heightMm: format.heightMm + 2 * format.bleedMm }
}

/** Export canvas size: trim + bleed on every side, at the profile's DPI. */
export function sheetSizePx(format: SpreadFormat, dpi: number): { width: number; height: number } {
  const sheet = sheetSizeMm(format)
  return { width: mmToPx(sheet.widthMm, dpi), height: mmToPx(sheet.heightMm, dpi) }
}

/**
 * A trim-relative mm rect → integer canvas pixels on the sheet (origin = bleed
 * corner). Edges are rounded independently so neighbouring slots never get a
 * 1-px seam or overlap from rounding.
 */
export function rectToSheetPx(rect: Rect, format: SpreadFormat, dpi: number): Rect {
  const left = mmToPx(rect.x + format.bleedMm, dpi)
  const top = mmToPx(rect.y + format.bleedMm, dpi)
  const right = mmToPx(rect.x + rect.w + format.bleedMm, dpi)
  const bottom = mmToPx(rect.y + rect.h + format.bleedMm, dpi)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/**
 * The two page boxes of a spread (left/right), or of a cover (back/front, the
 * spine between them). Trim-relative mm.
 */
export function pageBoxes(format: SpreadFormat): [Rect, Rect] {
  const half = (format.widthMm - format.spineMm) / 2
  return [
    { x: 0, y: 0, w: half, h: format.heightMm },
    { x: half + format.spineMm, y: 0, w: half, h: format.heightMm },
  ]
}

/** Safe area (trim inset by safeMm) per page, for the guide overlay. */
export function safeBoxes(format: SpreadFormat): Rect[] {
  return pageBoxes(format).map((page) => ({
    x: page.x + format.safeMm,
    y: page.y + format.safeMm,
    w: Math.max(page.w - 2 * format.safeMm, 0),
    h: Math.max(page.h - 2 * format.safeMm, 0),
  }))
}

/** Spread size in pixels at a DPI, e.g. 40×30 page album (80×30 spread) → 9449×3543 at 300 DPI. */
export function trimSizePx(format: SpreadFormat, dpi: number): { width: number; height: number } {
  return { width: mmToPx(format.widthMm, dpi), height: mmToPx(format.heightMm, dpi) }
}

/** Uncompressed RGBA bytes a canvas of this sheet needs (memory planning for export). */
export function sheetBytes(format: SpreadFormat, dpi: number): number {
  const { width, height } = sheetSizePx(format, dpi)
  return width * height * 4
}

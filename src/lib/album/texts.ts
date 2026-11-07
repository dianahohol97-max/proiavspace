/**
 * Text geometry shared by the editor, the canvas raster, the PDF and the PSD.
 * Point text: lines split at \n only; line i sits on the baseline
 * y + i·size·lineHeight in the text's own (rotated) frame; x is the anchor
 * of the alignment (left edge / centre / right edge).
 */
import { DEFAULT_FONT_ID } from './fonts'
import type { AlbumText, Rect, TextAlign } from './types'

export const PT_TO_MM = 25.4 / 72
export const DEFAULT_LINE_HEIGHT = 1.25

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM
}

export function textLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n')
}

/** Baseline offsets (mm, in the text frame) of each line. */
export function baselineOffsets(t: Pick<AlbumText, 'text' | 'sizePt' | 'lineHeight'>): number[] {
  const step = ptToMm(t.sizePt) * (t.lineHeight || DEFAULT_LINE_HEIGHT)
  return textLines(t.text).map((_, i) => i * step)
}

/** Left edge of a line of width w (mm, text frame) for the alignment. */
export function lineStart(align: TextAlign, w: number): number {
  return align === 'center' ? -w / 2 : align === 'right' ? -w : 0
}

/**
 * Approximate bounding box in trim mm (for selection and hit-testing), given
 * the widest line's width in mm. Ascent ≈ 0.85 em, descent ≈ 0.3 em.
 */
export function textBox(t: AlbumText, maxLineWidthMm: number): Rect {
  const size = ptToMm(t.sizePt)
  const lines = textLines(t.text).length
  const top = -0.85 * size
  const height = (lines - 1) * size * (t.lineHeight || DEFAULT_LINE_HEIGHT) + 1.15 * size
  const left = lineStart(t.align, maxLineWidthMm)
  // Rotate the local box around the anchor.
  const corners = [
    [left, top],
    [left + maxLineWidthMm, top],
    [left, top + height],
    [left + maxLineWidthMm, top + height],
  ]
  const a = (t.rotation * Math.PI) / 180
  const xs: number[] = []
  const ys: number[] = []
  for (const [cx, cy] of corners) {
    xs.push(t.x + cx! * Math.cos(a) - cy! * Math.sin(a))
    ys.push(t.y + cx! * Math.sin(a) + cy! * Math.cos(a))
  }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function newText(id: string, patch: Partial<AlbumText> = {}): AlbumText {
  return {
    id,
    x: 0,
    y: 0,
    text: 'Текст',
    font: DEFAULT_FONT_ID,
    sizePt: 24,
    color: '#1f1f1f',
    align: 'center',
    rotation: 0,
    lineHeight: DEFAULT_LINE_HEIGHT,
    ...patch,
  }
}

const HEX = /^#[0-9a-f]{6}$/i

/** Untrusted (stored/local) text → a valid AlbumText, or null. */
export function sanitizeText(raw: unknown): AlbumText | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d
  }
  if (typeof r.text !== 'string' || typeof r.id !== 'string') return null
  return {
    id: r.id.slice(0, 64),
    x: num(r.x, 0, -5000, 5000),
    y: num(r.y, 0, -5000, 5000),
    text: r.text.slice(0, 500),
    font: typeof r.font === 'string' ? r.font.slice(0, 40) : DEFAULT_FONT_ID,
    sizePt: num(r.sizePt, 24, 4, 400),
    color: typeof r.color === 'string' && HEX.test(r.color) ? r.color : '#1f1f1f',
    align: r.align === 'left' || r.align === 'right' ? r.align : 'center',
    rotation: [0, 90, -90, 180].includes(Number(r.rotation)) ? Number(r.rotation) : 0,
    lineHeight: num(r.lineHeight, DEFAULT_LINE_HEIGHT, 0.8, 3),
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = HEX.test(hex) ? hex.slice(1) : '1f1f1f'
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

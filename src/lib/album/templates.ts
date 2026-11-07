/**
 * Layout template library. A template is a weighted grid; it is resolved
 * into slot rectangles (mm) for a concrete format, margin and gap, so the same
 * library works for 20×20 and 40×30 alike.
 *
 * Layout ids stored on a spread:
 *   'blank'                     — empty spread
 *   'pages:<left>|<right>'      — one page template per page (cover: back|front)
 *   'spread:<id>'               — one template across both pages
 */
import { pageBoxes, type SpreadFormat } from './geometry'
import type { Rect } from './types'

export interface GridCell {
  /** Column/row index and span in the template grid. */
  c: number
  r: number
  cs?: number
  rs?: number
}

export interface LayoutTemplate {
  id: string
  name: string
  scope: 'page' | 'spread'
  /** Bleed templates fill the page edge to edge (cells on the outer edge run into the bleed). */
  bleed: boolean
  /** Relative column widths / row heights. */
  cols: number[]
  rows: number[]
  cells: GridCell[]
}

const t = (
  id: string,
  name: string,
  scope: 'page' | 'spread',
  bleed: boolean,
  cols: number[],
  rows: number[],
  cells: GridCell[]
): LayoutTemplate => ({ id, name, scope, bleed, cols, rows, cells })

const grid = (cols: number, rows: number): GridCell[] =>
  Array.from({ length: cols * rows }, (_, i) => ({ c: i % cols, r: Math.floor(i / cols) }))

export const PAGE_TEMPLATES: LayoutTemplate[] = [
  t('p0', 'Порожня', 'page', false, [1], [1], []),
  t('p1-bleed', '1 фото під обріз', 'page', true, [1], [1], [{ c: 0, r: 0 }]),
  t('p1-margin', '1 фото з полями', 'page', false, [1], [1], [{ c: 0, r: 0 }]),
  t('p1-center', '1 фото по центру', 'page', false, [1, 4, 1], [1, 4, 1], [{ c: 1, r: 1 }]),
  // A portrait frame on a landscape page (40×30 albums): no blank page, no cropping a portrait to landscape.
  t('p1-portrait', '1 вертикальне по центру', 'page', false, [1, 2, 1], [1], [{ c: 1, r: 0 }]),
  t('p2-v', '2 поруч', 'page', false, [1, 1], [1], grid(2, 1)),
  t('p2-h', '2 одне над одним', 'page', false, [1], [1, 1], grid(1, 2)),
  t('p2-bleed-v', '2 поруч під обріз', 'page', true, [1, 1], [1], grid(2, 1)),
  t('p3-big-left', '1 велике + 2', 'page', false, [2, 1], [1, 1], [
    { c: 0, r: 0, rs: 2 },
    { c: 1, r: 0 },
    { c: 1, r: 1 },
  ]),
  t('p3-big-top', '1 велике зверху + 2', 'page', false, [1, 1], [2, 1], [
    { c: 0, r: 0, cs: 2 },
    { c: 0, r: 1 },
    { c: 1, r: 1 },
  ]),
  t('p3-cols', '3 колонки', 'page', false, [1, 1, 1], [1], grid(3, 1)),
  t('p3-rows', '3 рядки', 'page', false, [1], [1, 1, 1], grid(1, 3)),
  t('p4-grid', '4 сіткою', 'page', false, [1, 1], [1, 1], grid(2, 2)),
  t('p4-big', '1 велике + 3', 'page', false, [1, 1, 1], [2, 1], [
    { c: 0, r: 0, cs: 3 },
    { c: 0, r: 1 },
    { c: 1, r: 1 },
    { c: 2, r: 1 },
  ]),
  t('p4-bleed', '4 сіткою під обріз', 'page', true, [1, 1], [1, 1], grid(2, 2)),
  t('p5-2-3', '2 + 3', 'page', false, [1, 1, 1, 1, 1, 1], [1, 1], [
    { c: 0, r: 0, cs: 3 },
    { c: 3, r: 0, cs: 3 },
    { c: 0, r: 1, cs: 2 },
    { c: 2, r: 1, cs: 2 },
    { c: 4, r: 1, cs: 2 },
  ]),
  t('p5-big', '1 велике + 4', 'page', false, [2, 1], [1, 1, 1, 1], [
    { c: 0, r: 0, rs: 4 },
    { c: 1, r: 0 },
    { c: 1, r: 1 },
    { c: 1, r: 2 },
    { c: 1, r: 3 },
  ]),
  t('p6-3x2', '6: 3×2', 'page', false, [1, 1, 1], [1, 1], grid(3, 2)),
  t('p6-2x3', '6: 2×3', 'page', false, [1, 1], [1, 1, 1], grid(2, 3)),
]

export const SPREAD_TEMPLATES: LayoutTemplate[] = [
  t('pano-bleed', 'Панорама на весь розворот', 'spread', true, [1], [1], [{ c: 0, r: 0 }]),
  t('pano-margin', 'Панорама з полями', 'spread', false, [1], [1], [{ c: 0, r: 0 }]),
  t('s3-strip', '3 у ряд через розворот', 'spread', false, [1, 1, 1], [1], grid(3, 1)),
  t('s4-strip', '4 у ряд через розворот', 'spread', false, [1, 1, 1, 1], [1], grid(4, 1)),
  t('s-hero-left', 'Велике через згин + 2', 'spread', false, [3, 1], [1, 1], [
    { c: 0, r: 0, rs: 2 },
    { c: 1, r: 0 },
    { c: 1, r: 1 },
  ]),
]

const BY_ID = new Map([...PAGE_TEMPLATES, ...SPREAD_TEMPLATES].map((tpl) => [`${tpl.scope}:${tpl.id}`, tpl]))

export function pageTemplate(id: string): LayoutTemplate | undefined {
  return BY_ID.get(`page:${id}`)
}

export function spreadTemplate(id: string): LayoutTemplate | undefined {
  return BY_ID.get(`spread:${id}`)
}

export function pagesLayout(left: string, right: string): string {
  return `pages:${left}|${right}`
}

export type ParsedLayout =
  | { kind: 'blank' }
  | { kind: 'pages'; left: LayoutTemplate; right: LayoutTemplate }
  | { kind: 'spread'; template: LayoutTemplate }

export function parseLayout(layout: string): ParsedLayout {
  if (layout.startsWith('pages:')) {
    const [l, r] = layout.slice(6).split('|')
    const left = pageTemplate(l ?? '')
    const right = pageTemplate(r ?? '')
    if (left && right) return { kind: 'pages', left, right }
  }
  if (layout.startsWith('spread:')) {
    const template = spreadTemplate(layout.slice(7))
    if (template) return { kind: 'spread', template }
  }
  return { kind: 'blank' }
}

export function layoutCount(layout: string): number {
  const parsed = parseLayout(layout)
  if (parsed.kind === 'pages') return parsed.left.cells.length + parsed.right.cells.length
  if (parsed.kind === 'spread') return parsed.template.cells.length
  return 0
}

export interface LayoutOptions {
  marginMm: number
  gapMm: number
}

function accumulate(weights: number[], total: number, gap: number): { start: number[]; size: number[] } {
  const sum = weights.reduce((a, b) => a + b, 0)
  const free = total - gap * (weights.length - 1)
  const start: number[] = []
  const size: number[] = []
  let at = 0
  for (const w of weights) {
    start.push(at)
    const s = (free * w) / sum
    size.push(s)
    at += s + gap
  }
  return { start, size }
}

/** Which sides of `box` lie on the outer trim edge of the sheet (and may run into the bleed). */
interface OuterEdges {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

const round2 = (v: number) => Math.round(v * 100) / 100

function resolveTemplate(
  template: LayoutTemplate,
  box: Rect,
  outer: OuterEdges,
  format: SpreadFormat,
  options: LayoutOptions
): Rect[] {
  const margin = template.bleed ? 0 : options.marginMm
  const content: Rect = {
    x: box.x + margin,
    y: box.y + margin,
    w: Math.max(box.w - 2 * margin, 1),
    h: Math.max(box.h - 2 * margin, 1),
  }
  const cols = accumulate(template.cols, content.w, options.gapMm)
  const rows = accumulate(template.rows, content.h, options.gapMm)
  const lastCol = template.cols.length - 1
  const lastRow = template.rows.length - 1
  const b = format.bleedMm
  return template.cells.map((cell) => {
    const c2 = cell.c + (cell.cs ?? 1) - 1
    const r2 = cell.r + (cell.rs ?? 1) - 1
    let x = content.x + cols.start[cell.c]!
    let y = content.y + rows.start[cell.r]!
    let right = content.x + cols.start[c2]! + cols.size[c2]!
    let bottom = content.y + rows.start[r2]! + rows.size[r2]!
    if (template.bleed) {
      if (cell.c === 0 && outer.left) x -= b
      if (c2 === lastCol && outer.right) right += b
      if (cell.r === 0 && outer.top) y -= b
      if (r2 === lastRow && outer.bottom) bottom += b
    }
    return { x: round2(x), y: round2(y), w: round2(right - x), h: round2(bottom - y) }
  })
}

/** Slot rectangles (trim-relative mm) of a layout on a concrete format. */
export function resolveLayout(layout: string, format: SpreadFormat, options: LayoutOptions): Rect[] {
  const parsed = parseLayout(layout)
  if (parsed.kind === 'blank') return []
  if (parsed.kind === 'spread') {
    const box = { x: 0, y: 0, w: format.widthMm, h: format.heightMm }
    return resolveTemplate(parsed.template, box, { left: true, right: true, top: true, bottom: true }, format, options)
  }
  const [leftBox, rightBox] = pageBoxes(format)
  return [
    ...resolveTemplate(parsed.left, leftBox, { left: true, right: false, top: true, bottom: true }, format, options),
    ...resolveTemplate(parsed.right, rightBox, { left: false, right: true, top: true, bottom: true }, format, options),
  ]
}

/** Every layout with exactly `count` photos (page pairs and spread templates). */
export function layoutsWithCount(count: number): string[] {
  const out: string[] = []
  for (const tpl of SPREAD_TEMPLATES) if (tpl.cells.length === count) out.push(`spread:${tpl.id}`)
  for (const left of PAGE_TEMPLATES) {
    for (const right of PAGE_TEMPLATES) {
      if (left.cells.length + right.cells.length !== count) continue
      // Mixing a bleed and a non-bleed page looks unfinished — keep pairs consistent,
      // except a full-bleed photo opposite a calmer page (a classic album spread).
      if (left.bleed !== right.bleed && !(left.id === 'p1-bleed' || right.id === 'p1-bleed')) continue
      out.push(pagesLayout(left.id, right.id))
    }
  }
  return out
}

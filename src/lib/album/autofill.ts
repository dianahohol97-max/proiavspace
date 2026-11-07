/**
 * Auto-fill: pick the layout whose slot shapes best match the chosen photos
 * (portrait ↔ portrait, landscape ↔ landscape) and put each photo into the
 * slot that fits it. Also chunks a whole selection into spreads.
 */
import { formatFor, type SpreadFormat } from './geometry'
import { layoutsWithCount, parseLayout, resolveLayout, type LayoutOptions } from './templates'
import type { AlbumPhoto, AlbumSlot, AlbumSpread, PrintSpec, Rect } from './types'

export const MAX_PHOTOS_PER_SPREAD = 12

type Shape = Pick<AlbumPhoto, 'id' | 'width' | 'height'>

const logAspect = (w: number, h: number) => Math.log(Math.max(w, 1) / Math.max(h, 1))

/**
 * Optimal pairing of photos to slots by aspect: for a cost |log a − log b|,
 * matching both lists in sorted order minimises the total (classic 1-D
 * assignment result). Returns photo index per slot and the total cost.
 */
export function matchByAspect(photos: Shape[], rects: Rect[]): { order: number[]; cost: number } {
  const n = Math.min(photos.length, rects.length)
  const slotIdx = rects.map((_, i) => i).sort((a, b) => logAspect(rects[a]!.w, rects[a]!.h) - logAspect(rects[b]!.w, rects[b]!.h))
  // Stable: equal aspects keep chronological order.
  const photoIdx = photos
    .map((_, i) => i)
    .sort((a, b) => logAspect(photos[a]!.width, photos[a]!.height) - logAspect(photos[b]!.width, photos[b]!.height) || a - b)
  const order = new Array<number>(rects.length).fill(-1)
  let cost = 0
  for (let k = 0; k < n; k++) {
    const s = slotIdx[k]!
    const p = photoIdx[k]!
    order[s] = p
    cost += Math.abs(logAspect(rects[s]!.w, rects[s]!.h) - logAspect(photos[p]!.width, photos[p]!.height))
  }
  return { order, cost }
}

function layoutPenalty(layout: string): number {
  const parsed = parseLayout(layout)
  if (parsed.kind !== 'pages') return 0.15 // spread-wide layouts: fine, but not the default
  const l = parsed.left.cells.length
  const r = parsed.right.cells.length
  let penalty = Math.abs(l - r) * 0.08
  // An empty page is a deliberate choice, not an auto-fill default.
  if (l === 0 || r === 0) penalty += 0.6
  // Tiny centred photo wastes the page.
  if (parsed.left.id === 'p1-center' || parsed.right.id === 'p1-center') penalty += 0.3
  return penalty
}

export interface PickedLayout {
  layout: string
  rects: Rect[]
  /** Photo id per slot, in slot order. */
  assetIds: (string | null)[]
  cost: number
}

/** Best layout for exactly these photos on this format (count capped at 12). */
export function pickLayout(
  photos: Shape[],
  format: SpreadFormat,
  options: LayoutOptions,
  avoidLayout?: string
): PickedLayout {
  const chosen = photos.slice(0, MAX_PHOTOS_PER_SPREAD)
  if (chosen.length === 0) return { layout: 'blank', rects: [], assetIds: [], cost: 0 }
  let best: PickedLayout | null = null
  for (const layout of layoutsWithCount(chosen.length)) {
    const rects = resolveLayout(layout, format, options)
    const { order, cost: shapeCost } = matchByAspect(chosen, rects)
    const cost = shapeCost + layoutPenalty(layout) + (layout === avoidLayout ? 0.25 : 0)
    if (!best || cost < best.cost - 1e-9) {
      best = { layout, rects, assetIds: order.map((i) => (i >= 0 ? chosen[i]!.id : null)), cost }
    }
  }
  return best!
}

export type IdFactory = () => string
const defaultId: IdFactory = () => crypto.randomUUID()

/** Slots for rects, filled with photos (focal point from the gallery when set). */
export function buildSlots(
  rects: Rect[],
  assetIds: (string | null)[],
  photosById: Map<string, Pick<AlbumPhoto, 'focalX' | 'focalY'>>,
  newId: IdFactory = defaultId
): AlbumSlot[] {
  return rects.map((rect, i) => {
    const assetId = assetIds[i] ?? null
    const photo = assetId ? photosById.get(assetId) : undefined
    return {
      id: newId(),
      ...rect,
      assetId,
      zoom: 1,
      fx: photo?.focalX ?? 0.5,
      fy: photo?.focalY ?? 0.5,
    }
  })
}

/** Fill one spread with the given photos, choosing the layout. */
export function autoFillSpread(
  spread: AlbumSpread,
  photos: AlbumPhoto[],
  spec: PrintSpec,
  newId: IdFactory = defaultId,
  avoidLayout?: string
): AlbumSpread {
  const format = formatFor(spec, spread.kind)
  const picked = pickLayout(photos, format, { marginMm: spec.marginMm, gapMm: spec.gapMm }, avoidLayout)
  const byId = new Map(photos.map((p) => [p.id, p]))
  return { ...spread, layout: picked.layout, slots: buildSlots(picked.rects, picked.assetIds, byId, newId) }
}

/** Split n photos into spreads of ~perSpread each, sizes differing by at most one. */
export function chunkSizes(n: number, perSpread: number): number[] {
  if (n <= 0) return []
  const per = Math.min(Math.max(Math.round(perSpread), 1), MAX_PHOTOS_PER_SPREAD)
  const spreads = Math.ceil(n / per)
  const base = Math.floor(n / spreads)
  const extra = n % spreads
  return Array.from({ length: spreads }, (_, i) => base + (i < extra ? 1 : 0))
}

/** A whole album from a selection, in order; consecutive spreads avoid repeating a layout. */
export function autoFillAlbum(
  photos: AlbumPhoto[],
  spec: PrintSpec,
  perSpread = 3,
  newId: IdFactory = defaultId
): AlbumSpread[] {
  const out: AlbumSpread[] = []
  let at = 0
  let previous: string | undefined
  for (const size of chunkSizes(photos.length, perSpread)) {
    const spread = autoFillSpread(
      { id: newId(), kind: 'spread', layout: 'blank', slots: [] },
      photos.slice(at, at + size),
      spec,
      newId,
      previous
    )
    previous = spread.layout
    out.push(spread)
    at += size
  }
  return out
}

/**
 * Switch a spread to another layout, keeping its photos (in slot order) and
 * their crops; photos that do not fit any more simply go back to the strip.
 */
export function applyLayout(spread: AlbumSpread, layout: string, spec: PrintSpec, newId: IdFactory = defaultId): AlbumSpread {
  const format = formatFor(spec, spread.kind)
  const rects = resolveLayout(layout, format, { marginMm: spec.marginMm, gapMm: spec.gapMm })
  const filled = spread.slots.filter((s) => s.assetId)
  return {
    ...spread,
    layout,
    slots: rects.map((rect, i) => {
      const keep = filled[i]
      return keep
        ? { ...keep, ...rect, id: keep.id }
        : { id: newId(), ...rect, assetId: null, zoom: 1, fx: 0.5, fy: 0.5 }
    }),
  }
}

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
  if (l === 0 || r === 0) penalty += 1.2
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
  avoidLayout?: string,
  /** Extra cost of a candidate (style preferences, heads cut by a crop…); order = photo index per slot. */
  extraCost?: (layout: string, rects: Rect[], order: number[]) => number
): PickedLayout {
  const chosen = photos.slice(0, MAX_PHOTOS_PER_SPREAD)
  if (chosen.length === 0) return { layout: 'blank', rects: [], assetIds: [], cost: 0 }
  let best: PickedLayout | null = null
  for (const layout of layoutsWithCount(chosen.length)) {
    const rects = resolveLayout(layout, format, options)
    const { order, cost: shapeCost } = matchByAspect(chosen, rects)
    const cost = shapeCost + layoutPenalty(layout) + (layout === avoidLayout ? 0.25 : 0) + (extraCost ? extraCost(layout, rects, order) : 0)
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
  const format = formatFor(spec, spread)
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
  const format = formatFor(spec, spread)
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

// ---------------------------------------------------------------------------
// Variants («кинь кілька фото на розворот» → several layouts, cycle with ←/→)
// ---------------------------------------------------------------------------

/**
 * The best distinct layouts for exactly these photos, best first (the first
 * one is what pickLayout would choose). Layouts with identical slot geometry
 * collapse into one.
 */
export function layoutVariants(photos: Shape[], format: SpreadFormat, options: LayoutOptions, limit = 10): PickedLayout[] {
  const chosen = photos.slice(0, MAX_PHOTOS_PER_SPREAD)
  if (!chosen.length) return []
  const all: PickedLayout[] = []
  for (const layout of layoutsWithCount(chosen.length)) {
    const rects = resolveLayout(layout, format, options)
    const { order, cost: shapeCost } = matchByAspect(chosen, rects)
    all.push({ layout, rects, assetIds: order.map((i) => (i >= 0 ? chosen[i]!.id : null)), cost: shapeCost + layoutPenalty(layout) })
  }
  all.sort((a, b) => a.cost - b.cost || a.layout.localeCompare(b.layout))
  const seen = new Set<string>()
  const out: PickedLayout[] = []
  for (const v of all) {
    const sig = v.rects.map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).sort().join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

/** Put a picked variant onto a spread (texts and cover spine kept). */
export function applyVariant(
  spread: AlbumSpread,
  variant: PickedLayout,
  photosById: Map<string, Pick<AlbumPhoto, 'focalX' | 'focalY'>>,
  newId: IdFactory = defaultId
): AlbumSpread {
  return { ...spread, layout: variant.layout, slots: buildSlots(variant.rects, variant.assetIds, photosById, newId) }
}

// ---------------------------------------------------------------------------
// Autodesign of a whole album: orientations + series
// ---------------------------------------------------------------------------

export type Density = 'airy' | 'normal' | 'dense'

const DENSITY: Record<Density, { target: number; max: number; heroEvery: number }> = {
  airy: { target: 2, max: 3, heroEvery: 3 },
  normal: { target: 3, max: 5, heroEvery: 5 },
  dense: { target: 5, max: 6, heroEvery: 8 },
}

/** Camera frame number from a file name (IMG_1234.jpg → 1234), or null. */
export function frameNumber(name: string): number | null {
  const m = name.replace(/\.[a-z0-9]+$/i, '').match(/(\d{3,})(?!.*\d{3,})/)
  return m ? Number(m[1]) : null
}

const orientation = (p: Shape) => (p.width > p.height * 1.08 ? 'l' : p.height > p.width * 1.08 ? 'p' : 's')

/**
 * Series: consecutive frames shot together (frame numbers at most `gap`
 * apart, same orientation) — a burst, a sequence of the first dance. When
 * names carry no numbers, runs of the same orientation in gallery order.
 */
export function splitSeries(photos: (Shape & { name?: string })[], gap = 3, maxRun = 6): (Shape & { name?: string })[][] {
  const out: (Shape & { name?: string })[][] = []
  let run: (Shape & { name?: string })[] = []
  for (const p of photos) {
    const prev = run[run.length - 1]
    const a = prev ? frameNumber(prev.name ?? '') : null
    const b = frameNumber(p.name ?? '')
    const close = prev && (a !== null && b !== null ? b - a > 0 && b - a <= gap : true)
    if (prev && close && orientation(prev) === orientation(p) && run.length < maxRun) run.push(p)
    else {
      if (run.length) out.push(run)
      run = [p]
    }
  }
  if (run.length) out.push(run)
  return out
}

/**
 * Autodesign: photos (in story order) → spreads. Series stay together on one
 * spread (split evenly when longer than the density allows); short series are
 * merged up to the target; a lone landscape frame now and then becomes a
 * full-spread hero; each spread gets the best-fitting layout, never the same
 * one twice in a row.
 */
export function autoDesignAlbum(
  photos: AlbumPhoto[],
  spec: PrintSpec,
  density: Density = 'normal',
  newId: IdFactory = defaultId
): AlbumSpread[] {
  const d = DENSITY[density]
  const groups: AlbumPhoto[][] = []
  let bucket: AlbumPhoto[] = []
  let sinceHero = 0
  const flush = () => {
    if (bucket.length) groups.push(bucket)
    bucket = []
  }
  for (const series of splitSeries(photos) as AlbumPhoto[][]) {
    // Hero: a lone landscape frame after enough ordinary spreads.
    if (series.length === 1 && orientation(series[0]!) === 'l' && sinceHero >= d.heroEvery - 1) {
      flush()
      groups.push(series)
      sinceHero = 0
      continue
    }
    if (series.length > d.max) {
      flush()
      let at = 0
      for (const size of chunkSizes(series.length, d.max)) {
        groups.push(series.slice(at, at + size))
        at += size
        sinceHero++
      }
      continue
    }
    if (bucket.length + series.length > d.max || (bucket.length >= d.target && bucket.length + series.length > d.target)) {
      flush()
      sinceHero++
    }
    bucket.push(...series)
  }
  flush()

  const out: AlbumSpread[] = []
  let previous: string | undefined
  for (const group of groups) {
    let spread: AlbumSpread
    if (group.length === 1 && orientation(group[0]!) === 'l') {
      const format = formatFor(spec, 'spread')
      const layout = 'spread:pano-bleed'
      const rects = resolveLayout(layout, format, { marginMm: spec.marginMm, gapMm: spec.gapMm })
      spread = { id: newId(), kind: 'spread', layout, slots: buildSlots(rects, [group[0]!.id], new Map(group.map((p) => [p.id, p])), newId) }
    } else {
      spread = autoFillSpread({ id: newId(), kind: 'spread', layout: 'blank', slots: [] }, group, spec, newId, previous)
    }
    previous = spread.layout
    out.push(spread)
  }
  return out
}

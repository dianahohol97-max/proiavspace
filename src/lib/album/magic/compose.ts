/**
 * Rhythm and pairs: chosen frames (per chapter, story order) → spreads.
 *
 *  - Heroes: a horizontal, sharp frame with big faces / a clear subject gets
 *    a whole spread, roughly every 3rd–5th spread (by style), never one that
 *    would cut heads in the panorama crop.
 *  - The rest of a chapter is cut into consecutive groups (the story order is
 *    kept) by dynamic programming over the cut points; a group's cost rewards
 *    complementary frames (close-up + wide, portrait + detail), harmonious
 *    colours, the style's density, and forbids near-identical frames side by
 *    side.
 *  - Each group gets the best layout for its orientations, biased by the
 *    style, with crops that keep heads whole; never the same layout twice in a
 *    row. Every chapter starts on a new spread.
 */
import { hamming } from '@/lib/culling/dhash'
import { paletteChroma, paletteDistance } from '@/lib/culling/palette'
import type { PhotoAnalysis } from '@/lib/culling/types'
import { buildSlots, pickLayout, type IdFactory } from '../autofill'
import { formatFor } from '../geometry'
import { parseLayout, resolveLayout } from '../templates'
import type { AlbumPhoto, AlbumSpread, PrintSpec, Rect } from '../types'
import { headsFit, type Focal } from './focal'
import { apportion, type PhotoScore } from './select'
import type { MagicStyle } from './types'

export interface StyleRules {
  /** Photos per ordinary spread: target, min, max. */
  perSpread: number
  min: number
  max: number
  /** A hero spread about every N spreads. */
  heroEvery: number
  /** Weight of colour harmony and of complementary shots inside a spread. */
  harmony: number
  contrast: number
  heroLayout: string
  /** Style preference for a layout (added to the fit cost; lower is better). */
  layoutCost: (layout: string) => number
}

function pageStats(layout: string) {
  const p = parseLayout(layout)
  if (p.kind !== 'pages') return null
  return { left: p.left, right: p.right, l: p.left.cells.length, r: p.right.cells.length }
}

export const STYLE_RULES: Record<MagicStyle, StyleRules> = {
  calm: {
    perSpread: 2.2,
    min: 2,
    max: 3,
    heroEvery: 3,
    harmony: 1.4,
    contrast: 0.5,
    heroLayout: 'spread:pano-margin',
    layoutCost: (layout) => {
      const p = pageStats(layout)
      if (!p) return layout === 'spread:pano-margin' ? -0.1 : 0.2
      let c = 0
      if (p.left.bleed || p.right.bleed) c += 0.35 // margins, air
      c += 0.15 * (Math.max(p.l, p.r) - 1)
      if (p.left.id === 'p1-portrait' || p.right.id === 'p1-portrait') c -= 0.1
      return c
    },
  },
  rich: {
    perSpread: 4.3,
    min: 3,
    max: 6,
    heroEvery: 5,
    harmony: 0.7,
    contrast: 0.6,
    heroLayout: 'spread:pano-bleed',
    layoutCost: (layout) => {
      const p = pageStats(layout)
      if (!p) return 0.1
      let c = 0
      if (p.left.bleed && p.right.bleed) c -= 0.15
      if (p.left.id.includes('center') || p.right.id.includes('center')) c += 0.3
      return c
    },
  },
  editorial: {
    perSpread: 3,
    min: 2,
    max: 4,
    heroEvery: 4,
    harmony: 0.9,
    contrast: 1.3,
    heroLayout: 'spread:pano-bleed',
    layoutCost: (layout) => {
      if (layout === 'spread:s-hero-left') return -0.3
      const p = pageStats(layout)
      if (!p) return 0.1
      let c = 0
      // Asymmetry: one big photo against a composed page.
      if ((p.l === 1) !== (p.r === 1)) c -= 0.3
      if (p.left.id === p.right.id) c += 0.25
      if (p.left.id.startsWith('p3-big') || p.right.id.startsWith('p3-big')) c -= 0.1
      return c
    },
  },
}

/** Heroes and photos an album of `spreads` inner spreads needs in this style. */
export function capacity(style: MagicStyle, spreads: number): { heroes: number; photos: number } {
  const r = STYLE_RULES[style]
  const heroes = spreads >= 3 ? Math.max(1, Math.round(spreads / r.heroEvery)) : 0
  return { heroes, photos: heroes + Math.round((spreads - heroes) * r.perSpread) }
}

export type ShotScale = 'close' | 'medium' | 'wide' | 'detail'

/** Shot scale from faces / the crisp subject. */
export function shotScale(analysis: PhotoAnalysis | undefined): ShotScale {
  const faceSize = Math.max(0, ...(analysis?.faces ?? []).map((f) => f.size))
  if (faceSize >= 0.3) return 'close'
  if (faceSize >= 0.1) return 'medium'
  if (faceSize === 0 && analysis?.subject && analysis.subject.size < 0.25) return 'detail'
  return 'wide'
}

export interface Item {
  photo: AlbumPhoto
  score: PhotoScore
  analysis: PhotoAnalysis | undefined
  focal: Focal
  scale: ShotScale
}

/** Near-identical neighbours on one spread: forbidden (as good as). */
const SAME_SPREAD_DUP = 12

export function groupCost(group: Item[], rules: StyleRules): number {
  const n = group.length
  let cost = 0.35 * (n - rules.perSpread) ** 2
  // One ordinary frame on a spread leaves a page empty (heroes are separate).
  if (n === 1) cost += 1.2
  let maxColour = 0
  let bw = 0
  let colour = 0
  for (let i = 0; i < n; i++) {
    const a = group[i]!
    const chroma = paletteChroma(a.analysis?.palette)
    if (chroma !== null) {
      if (chroma < 4) bw++
      else if (chroma > 10) colour++
    }
    for (let j = i + 1; j < n; j++) {
      const b = group[j]!
      if (a.score.hash && b.score.hash && hamming(a.score.hash, b.score.hash) <= SAME_SPREAD_DUP) cost += 4
      const d = paletteDistance(a.analysis?.palette, b.analysis?.palette)
      if (d !== null) maxColour = Math.max(maxColour, d)
    }
  }
  if (n > 1) {
    const scales = new Set(group.map((g) => g.scale)).size
    cost -= rules.contrast * 0.45 * (scales - 1)
    cost += (rules.harmony * Math.max(0, maxColour - 18)) / 15
    if (bw && colour) cost += rules.harmony
  }
  return cost
}

/**
 * Cut `items` (story order) into exactly k consecutive groups, sizes within
 * the style's [min, max] where possible, minimising the summed group cost.
 */
export function partition(items: Item[], k: number, rules: StyleRules): Item[][] {
  const n = items.length
  if (!n || k <= 0) return []
  k = Math.min(k, n)
  let lo = Math.max(1, Math.min(rules.min, Math.floor(n / k)))
  let hi = Math.max(rules.max, Math.ceil(n / k))
  hi = Math.min(hi, 12)
  if (lo * k > n) lo = 1
  const INF = Number.POSITIVE_INFINITY
  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(INF))
  const cut: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(-1))
  dp[0]![0] = 0
  const memo = new Map<number, number>()
  const cost = (from: number, to: number) => {
    const key = from * 4096 + to
    let c = memo.get(key)
    if (c === undefined) {
      c = groupCost(items.slice(from, to), rules)
      memo.set(key, c)
    }
    return c
  }
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let len = lo; len <= hi && len <= i; len++) {
        const prev = dp[j - 1]![i - len]!
        if (prev === INF) continue
        const v = prev + cost(i - len, i)
        if (v < dp[j]![i]!) {
          dp[j]![i] = v
          cut[j]![i] = i - len
        }
      }
    }
  }
  if (dp[k]![n] === INF) {
    // Sizes cannot be met (tiny chapters): fall back to even chunks.
    const out: Item[][] = []
    let at = 0
    for (const size of apportion(n, new Array(k).fill(1))) {
      out.push(items.slice(at, at + size))
      at += size
    }
    return out
  }
  const groups: Item[][] = []
  for (let j = k, i = n; j > 0; j--) {
    const from = cut[j]![i]!
    groups.unshift(items.slice(from, i))
    i = from
  }
  return groups
}

const isHard = (s: PhotoScore) => s.flags.includes('blurry') || s.flags.includes('eyes')

/** How good a frame is for a whole spread; null when it may not be a hero. */
export function heroScore(item: Item, spreadAspect: number): number | null {
  const { photo, score, analysis } = item
  if (photo.width < photo.height * 1.25) return null
  if (isHard(score)) return null
  if (score.relativeSharpness !== null && score.relativeSharpness < 0.85) return null
  if (!headsFit(photo, item.focal, spreadAspect)) return null
  let h = score.score
  if (score.faceSize >= 0.15) h += 1
  else if (score.faceSize >= 0.06) h += 0.4
  const subject = analysis?.subject
  if (!score.faceSize && subject && subject.size >= 0.15 && subject.size <= 0.85) h += 0.4
  if ((score.relativeSharpness ?? 1) >= 1) h += 0.3
  if (score.clientPick) h += 0.8
  return h
}

export interface ChapterPlan {
  /** Story-ordered units: a hero item or an ordinary group. */
  units: ({ hero: Item } | { group: Item[] })[]
}

/** Per-chapter spread budgets (sum = spreads), never more spreads than photos in a chapter. */
export function spreadBudgets(sizes: number[], spreads: number, minPerSpread = 1): number[] {
  const total = Math.min(spreads, sizes.reduce((a, b) => a + b, 0))
  // A small chapter should not be stretched into half-empty spreads: at most
  // size / minPerSpread spreads, unless the album cannot be filled otherwise.
  const soft = sizes.map((n) => Math.max(1, Math.floor(n / Math.max(1, minPerSpread))))
  const out = apportion(total, sizes, 1).map((b, i) => Math.min(b, soft[i]!))
  let left = total - out.reduce((a, b) => a + b, 0)
  for (const cap of [soft, sizes]) {
    while (left > 0) {
      // Hand spare spreads to chapters with the most photos per spread.
      let best = -1
      let ratio = -1
      out.forEach((b, i) => {
        if (b < cap[i]! && sizes[i]! / Math.max(b, 1) > ratio) {
          ratio = sizes[i]! / Math.max(b, 1)
          best = i
        }
      })
      if (best < 0) break
      out[best]!++
      left--
    }
  }
  return out
}

export function planChapters(chapters: Item[][], spreads: number, style: MagicStyle, spreadAspect: number): ChapterPlan[] {
  const rules = STYLE_RULES[style]
  const budgets = spreadBudgets(chapters.map((c) => c.length), spreads, rules.min)
  let carry = 0.5
  return chapters.map((items, c) => {
    const budget = budgets[c]!
    if (!items.length || !budget) return { units: [] }
    // Heroes: about every heroEvery-th spread across the album.
    carry += budget / rules.heroEvery
    const ranked = items
      .map((item, index) => ({ item, index, h: heroScore(item, spreadAspect) }))
      .filter((x): x is { item: Item; index: number; h: number } => x.h !== null)
      .sort((a, b) => b.h - a.h)
    const want = Math.min(Math.floor(carry), ranked.length)
    const spacing = Math.max(2, Math.floor(rules.perSpread * 1.5))
    const heroes: { item: Item; index: number }[] = []
    for (const r of ranked) {
      if (heroes.length >= want) break
      if (heroes.some((h) => Math.abs(h.index - r.index) < spacing)) continue
      // Ordinary spreads left must be fillable by the remaining photos.
      const restPhotos = items.length - heroes.length - 1
      const restSpreads = budget - heroes.length - 1
      if (restSpreads > restPhotos || (restSpreads === 0 && restPhotos > 0)) continue
      heroes.push(r)
    }
    carry -= heroes.length
    const heroSet = new Set(heroes.map((h) => h.item.photo.id))
    const rest = items.filter((it) => !heroSet.has(it.photo.id))
    const groups = partition(rest, budget - heroes.length, rules)
    // Interleave heroes by story position.
    const pos = new Map(items.map((it, i) => [it.photo.id, i]))
    const units: ChapterPlan['units'] = groups.map((group) => ({ group }))
    const firstIndex = (u: ChapterPlan['units'][number]) => pos.get('hero' in u ? u.hero.photo.id : u.group[0]!.photo.id)!
    for (const h of heroes) units.push({ hero: h.item })
    units.sort((a, b) => firstIndex(a) - firstIndex(b))
    return { units }
  })
}

/** Slots with the magic focal points (faces / subject) instead of the gallery's. */
function slotsFor(rects: Rect[], ids: (string | null)[], items: Map<string, Item>, newId: IdFactory) {
  const focal = new Map(
    [...items.values()].map((it) => [it.photo.id, { focalX: it.focal.fx, focalY: it.focal.fy }])
  )
  return buildSlots(rects, ids, focal, newId)
}

export function buildSpreads(plans: ChapterPlan[], spec: PrintSpec, style: MagicStyle, newId: IdFactory): { spreads: AlbumSpread[]; heroes: number } {
  const rules = STYLE_RULES[style]
  const format = formatFor(spec, 'spread')
  const options = { marginMm: spec.marginMm, gapMm: spec.gapMm }
  const out: AlbumSpread[] = []
  let previous: string | undefined
  let heroes = 0
  for (const plan of plans) {
    for (const unit of plan.units) {
      if ('hero' in unit) {
        const rects = resolveLayout(rules.heroLayout, format, options)
        const byId = new Map([[unit.hero.photo.id, unit.hero]])
        out.push({ id: newId(), kind: 'spread', layout: rules.heroLayout, slots: slotsFor(rects, [unit.hero.photo.id], byId, newId) })
        previous = rules.heroLayout
        heroes++
        continue
      }
      const group = unit.group
      const shapes = group.map((g) => g.photo)
      const picked = pickLayout(shapes, format, options, previous, (layout, rects, order) => {
        let c = rules.layoutCost(layout)
        // A panorama across the spread is the heroes' privilege.
        if (layout.startsWith('spread:pano')) c += 3
        rects.forEach((r, s) => {
          const it = order[s]! >= 0 ? group[order[s]!] : undefined
          if (it && !headsFit(it.photo, it.focal, r.w / r.h)) c += 0.6
        })
        return c
      })
      out.push({
        id: newId(),
        kind: 'spread',
        layout: picked.layout,
        slots: slotsFor(picked.rects, picked.assetIds, new Map(group.map((g) => [g.photo.id, g])), newId),
      })
      previous = picked.layout
    }
  }
  return { spreads: out, heroes }
}

/**
 * Cover with a spine: the spine width from the profile (base + growth per
 * spread), re-fitting a laid-out cover when the spine changes, cover presets
 * (photo layout + title + spine text).
 */
import { applyLayout, type IdFactory } from './autofill'
import { DEFAULT_FONT_ID } from './fonts'
import { formatFor, pageBoxes, type SpreadFormat } from './geometry'
import { ptToMm } from './texts'
import type { AlbumSpread, AlbumText, PrintSpec } from './types'

/** Spine for an album with this many inner spreads. */
export function spineWidthMm(spec: PrintSpec, spreadCount: number): number {
  if (!spec.cover) return 0
  const s = spec.cover.spineMm + (spec.cover.spinePerSpreadMm ?? 0) * Math.max(spreadCount, 0)
  return Math.round(s * 10) / 10
}

export function innerSpreadCount(spreads: AlbumSpread[]): number {
  return spreads.filter((s) => s.kind === 'spread').length
}

/**
 * Re-fit a cover laid out for spine S0 to spine S1: everything on the front
 * board moves by the difference, things on the spine by half of it, a photo
 * wrapping across the spine gets wider. The back board stays put.
 */
export function adaptCoverToSpine(cover: AlbumSpread, spec: PrintSpec, spine: number): AlbumSpread {
  if (cover.kind !== 'cover' || !spec.cover) return cover
  const from = cover.spineMm ?? spec.cover.spineMm
  const delta = Math.round((spine - from) * 100) / 100
  if (Math.abs(delta) < 0.05) return cover.spineMm === spine ? cover : { ...cover, spineMm: spine }
  const fmt = formatFor(spec, 'cover', from)
  const start = (fmt.widthMm - from) / 2
  const end = start + from
  const eps = 0.5
  const shiftX = (x: number, w: number) => {
    if (x >= end - eps) return { x: x + delta, w } // front board
    if (x + w <= start + eps) return { x, w } // back board
    if (x >= start - eps && x + w <= end + eps) return { x: x + delta / 2, w } // on the spine
    if (x < start && x + w > end) return { x, w: w + delta } // wraps across the spine
    // Partly over the spine: follow its centre.
    const c = x + w / 2
    return c >= (start + end) / 2 ? { x: x + delta, w } : { x, w }
  }
  return {
    ...cover,
    spineMm: spine,
    slots: cover.slots.map((s) => ({ ...s, ...shiftX(s.x, s.w) })),
    texts: (cover.texts ?? []).map((t) => {
      const onFront = t.x >= end - eps
      const onSpine = t.x > start - eps && t.x < end + eps
      return { ...t, x: t.x + (onFront ? delta : onSpine ? delta / 2 : 0) }
    }),
  }
}

/** Largest font (pt) whose letters fit the spine with a margin; 0 if the spine is too thin for text. */
export function spineFontPt(spineMm: number): number {
  if (spineMm < 4) return 0
  // Cap height ≈ 0.7 em; keep it within 55 % of the spine.
  const pt = (spineMm * 0.55) / 0.7 / ptToMm(1)
  return Math.round(Math.min(pt, 22) * 2) / 2
}

/** Spine text: rotated 90° (reads top to bottom, letter tops toward the front), centred. */
export function spineText(format: SpreadFormat, id: string, text: string, color: string, font = DEFAULT_FONT_ID): AlbumText | null {
  const size = spineFontPt(format.spineMm)
  if (!size) return null
  const centre = (format.widthMm - format.spineMm) / 2 + format.spineMm / 2
  const capHalf = (ptToMm(size) * 0.7) / 2
  return { id, x: centre - capHalf, y: format.heightMm / 2, text, font, sizePt: size, color, align: 'center', rotation: 90, lineHeight: 1.25 }
}

export interface CoverPreset {
  id: string
  name: string
  layout: string
  /** Title on the front board? Where, as a fraction of the height (baseline). */
  title?: { at: number; color: string; sizePt: number }
  spineColor: string
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'wrap', name: 'Фото на всю обкладинку', layout: 'spread:pano-bleed', title: { at: 0.82, color: '#ffffff', sizePt: 36 }, spineColor: '#ffffff' },
  { id: 'front-photo', name: 'Фото на лицевій', layout: 'pages:p0|p1-bleed', spineColor: '#1f1f1f' },
  { id: 'front-window', name: 'Вікно з назвою', layout: 'pages:p0|p1-center', title: { at: 0.9, color: '#1f1f1f', sizePt: 28 }, spineColor: '#1f1f1f' },
  { id: 'two-photos', name: 'Фото ззаду й спереду', layout: 'pages:p1-bleed|p1-bleed', spineColor: '#ffffff' },
  { id: 'title-only', name: 'Лише назва', layout: 'blank', title: { at: 0.5, color: '#1f1f1f', sizePt: 40 }, spineColor: '#1f1f1f' },
]

/**
 * Apply a cover preset: photo layout (keeping the photos), a title on the
 * front board and the album title on the spine (when it is wide enough).
 * Existing texts are replaced — the preset is a starting point.
 */
export function applyCoverPreset(cover: AlbumSpread, preset: CoverPreset, spec: PrintSpec, title: string, newId: IdFactory): AlbumSpread {
  const laidOut = applyLayout(cover, preset.layout, spec, newId)
  const format = formatFor(spec, cover)
  const [, front] = pageBoxes(format)
  const texts: AlbumText[] = []
  if (preset.title) {
    texts.push({
      id: newId(),
      x: front.x + front.w / 2,
      y: format.heightMm * preset.title.at,
      text: title,
      font: DEFAULT_FONT_ID,
      sizePt: preset.title.sizePt,
      color: preset.title.color,
      align: 'center',
      rotation: 0,
      lineHeight: 1.25,
    })
  }
  const spine = spineText(format, newId(), title, preset.spineColor)
  if (spine) texts.push(spine)
  return { ...laidOut, texts }
}

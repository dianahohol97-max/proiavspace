/**
 * The cover of a magic album: the best frame, the gallery title and the date
 * of the shoot; the spine is sized by the print profile for the number of
 * spreads (base + growth per spread) and carries the title when it is wide
 * enough (cover.ts → spineText).
 */
import { applyCoverPreset, COVER_PRESETS, spineWidthMm } from '../cover'
import { DEFAULT_FONT_ID } from '../fonts'
import { formatFor, pageBoxes } from '../geometry'
import type { IdFactory } from '../autofill'
import type { AlbumSpread, AlbumText, PrintSpec } from '../types'
import type { Item } from './compose'
import type { MagicStyle } from './types'

/** «12 вересня 2026»; takenAt is the camera's wall-clock time stored as UTC (0067). */
export function shootDate(times: number[]): string | null {
  if (!times.length) return null
  const first = Math.min(...times)
  const last = Math.max(...times)
  const fmt = (t: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC', ...opts }).format(new Date(t))
  const day = (t: number) => fmt(t, { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*р\.$/, '')
  if (day(first) === day(last)) return day(first)
  return `${fmt(first, { day: 'numeric', month: 'long' })} — ${day(last)}`
}

/** Pick the cover frame: client picks first, then sharp frames with big faces. */
export function coverScore(item: Item): number {
  const s = item.score
  let v = s.score
  if (s.flags.includes('blurry') || s.flags.includes('eyes')) v -= 5
  if (s.clientPick) v += 2
  if (s.faceSize >= 0.12) v += 1
  return v
}

export function magicCover(
  best: Item | null,
  spec: PrintSpec,
  innerSpreads: number,
  title: string,
  date: string | null,
  style: MagicStyle,
  newId: IdFactory
): AlbumSpread {
  const spine = spineWidthMm(spec, innerSpreads)
  const base: AlbumSpread = { id: newId(), kind: 'cover', layout: 'blank', slots: [], spineMm: spec.cover ? spine : null }
  const landscape = !!best && best.photo.width > best.photo.height * 1.2
  // A wrap-around photo only when its subject lands on the front board.
  const presetId =
    !best ? 'title-only' : style === 'calm' ? 'front-window' : style === 'rich' && landscape && best.focal.fx >= 0.6 ? 'wrap' : 'front-photo'
  const preset = COVER_PRESETS.find((p) => p.id === presetId)!
  const withPhoto: AlbumSpread = best
    ? { ...base, layout: preset.layout, slots: [{ id: newId(), x: 0, y: 0, w: 1, h: 1, assetId: best.photo.id, zoom: 1, fx: best.focal.fx, fy: best.focal.fy }] }
    : base
  let cover = applyCoverPreset(withPhoto, preset, spec, title, newId)
  const format = formatFor(spec, cover)
  const [, front] = pageBoxes(format)
  const texts: AlbumText[] = [...(cover.texts ?? [])]
  // front-photo has no title in the preset: put one over the photo.
  let titleText = texts.find((t) => t.rotation === 0)
  if (!titleText && title) {
    titleText = {
      id: newId(),
      x: front.x + front.w / 2,
      y: format.heightMm * 0.84,
      text: title,
      font: DEFAULT_FONT_ID,
      sizePt: 34,
      color: '#ffffff',
      align: 'center',
      rotation: 0,
      lineHeight: 1.25,
    }
    texts.push(titleText)
  }
  if (date && titleText) {
    texts.push({
      ...titleText,
      id: newId(),
      text: date,
      sizePt: 12,
      y: Math.min(titleText.y + (titleText.sizePt * 0.3528 * 0.9 + 6), format.heightMm - spec.safeMm),
    })
  }
  cover = { ...cover, texts }
  // Keep the focal point of the frame after the preset re-laid the slot out.
  if (best) cover = { ...cover, slots: cover.slots.map((s) => (s.assetId === best.photo.id ? { ...s, fx: best.focal.fx, fy: best.focal.fy } : s)) }
  return cover
}

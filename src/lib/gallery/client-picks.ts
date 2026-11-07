/**
 * «Обране клієнта» → Lightroom Classic і список для ретушу. Pure logic, shared
 * by the gallery dashboard and the audit tests.
 *
 * Lightroom Classic: Library → Library Filter → Text → Filename → Contains.
 * Adobe's help («Find photos in the catalog», Text filter rules): with the
 * «Contains» rule, «if multiple sequences are entered, Lightroom Classic finds
 * photos that contain any of the individual sequences» — i.e. OR. Sequences
 * are split on spaces and commas (Adobe Community, Rikk Flohr: «separated by
 * a space or a comma»), so a name that itself contains a space or a comma
 * falls apart into pieces and would match unrelated files: such names are
 * left out of the line and listed separately. Extensions are dropped, so the
 * client's JPEG «IMG_0012.jpg» also finds the RAW «IMG_0012.CR3» in the
 * catalog. Note «Contains All» (Lightroom's default rule) is AND and finds
 * nothing for a list — the dashboard hint says to switch it to «Contains».
 */

import type { SelectionKind } from '@/lib/types'

/** What the export needs from an asset row. */
export interface PickAsset {
  id: string
  r2_key: string
  /** The file's name exactly as it was on the photographer's disk (0066). */
  source_file_name?: string | null
  /** The file's name inside an imported zip (0037). */
  original_name?: string | null
}

export interface PickSelection {
  asset_id: string
  kind: SelectionKind | string
  client_token: string
  /** No comment feature yet — kept so the export picks it up once there is one. */
  comment?: string | null
}

export interface ClientPick {
  assetId: string
  /** Original file name with extension («IMG_0012.jpg»). */
  name: string
  /** Number of clients who put a heart / asked for retouch. */
  favorites: number
  retouch: number
  /** Client comments, if any (empty for now). */
  comments: string[]
}

/** A storage key's basename minus the `<uuid>-` prefix (lib/storage originalKey). */
function nameFromKey(r2Key: string, fallback: string): string {
  return (r2Key.split('/').pop() ?? fallback).replace(/^[0-9a-f-]{36}-/, '') || fallback
}

/**
 * The name the photographer knows the file by. Uploads since 0066 store it
 * verbatim (source_file_name); zip imports have it as original_name; older
 * uploads only have the storage key, whose name part is ASCII-sanitized
 * (camera names like IMG_0012.jpg survive intact, spaces/Cyrillic become «_»).
 */
export function assetOriginalName(asset: PickAsset): string {
  const stored = asset.source_file_name?.trim() || asset.original_name?.trim()
  return stored || nameFromKey(asset.r2_key, asset.id)
}

/** «IMG_0012.jpg» → «IMG_0012»; «photo.final.JPG» → «photo.final»; no extension → as is. */
export function stripExtension(name: string): string {
  const base = name.trim()
  const match = base.match(/^(.+)\.[A-Za-z0-9]{1,5}$/)
  return match ? match[1] : base
}

/**
 * Every asset the clients marked (heart or retouch), in gallery order.
 * Several clients marking one photo count separately; one client's double
 * row (impossible by the unique key, but cheap to guard) counts once.
 */
export function buildClientPicks(
  assets: readonly PickAsset[],
  selections: readonly PickSelection[]
): ClientPick[] {
  const byAsset = new Map<
    string,
    { favorites: Set<string>; retouch: Set<string>; comments: string[] }
  >()
  for (const s of selections) {
    if (s.kind !== 'favorite' && s.kind !== 'retouch') continue
    const entry = byAsset.get(s.asset_id) ?? { favorites: new Set(), retouch: new Set(), comments: [] }
    ;(s.kind === 'favorite' ? entry.favorites : entry.retouch).add(s.client_token)
    const comment = s.comment?.trim()
    if (comment && !entry.comments.includes(comment)) entry.comments.push(comment)
    byAsset.set(s.asset_id, entry)
  }
  const picks: ClientPick[] = []
  for (const asset of assets) {
    const entry = byAsset.get(asset.id)
    if (!entry) continue
    picks.push({
      assetId: asset.id,
      name: assetOriginalName(asset),
      favorites: entry.favorites.size,
      retouch: entry.retouch.size,
      comments: entry.comments,
    })
  }
  return picks
}

export interface LightroomLine {
  /** «IMG_0012,IMG_0015,DSC_0101» — paste into Filename → Contains. */
  text: string
  /** How many names are in the line. */
  count: number
  /** Names that can't go into the line (a space or a comma inside). */
  skipped: string[]
}

/**
 * The Lightroom filter line: names without extensions, comma-separated, no
 * spaces; duplicates dropped case-insensitively (Lightroom's text filter
 * ignores case, and IMG_1.jpg + IMG_1.png are one search term).
 */
export function lightroomFilterLine(picks: readonly { name: string }[]): LightroomLine {
  const seen = new Set<string>()
  const terms: string[] = []
  const skipped: string[] = []
  for (const pick of picks) {
    const base = stripExtension(pick.name)
    if (!base) continue
    if (/[\s,]/.test(base)) {
      if (!skipped.includes(pick.name)) skipped.push(pick.name)
      continue
    }
    const key = base.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    terms.push(base)
  }
  return { text: terms.join(','), count: terms.length, skipped }
}

export interface PickLabels {
  file: string
  mark: string
  comment: string
  favorite: string
  retouch: string
}

export const PICK_LABELS: Record<'uk' | 'en', PickLabels> = {
  uk: { file: 'Файл', mark: 'Позначка', comment: 'Коментар', favorite: 'сердечко', retouch: 'ретуш' },
  en: { file: 'File', mark: 'Mark', comment: 'Comment', favorite: 'heart', retouch: 'retouch' },
}

function markOf(pick: ClientPick, labels: PickLabels): string {
  const marks: string[] = []
  if (pick.favorites > 0) marks.push(pick.favorites > 1 ? `${labels.favorite} ×${pick.favorites}` : labels.favorite)
  if (pick.retouch > 0) marks.push(pick.retouch > 1 ? `${labels.retouch} ×${pick.retouch}` : labels.retouch)
  return marks.join(' + ')
}

/** RFC 4180 field: quoted when it holds a comma, quote, or line break. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** CSV with a header; the BOM makes Excel read the Cyrillic as UTF-8. */
export function picksCsv(picks: readonly ClientPick[], labels: PickLabels): string {
  const rows = [
    [labels.file, labels.mark, labels.comment],
    ...picks.map((p) => [p.name, markOf(p, labels), p.comments.join(' | ')]),
  ]
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Plain list for a retouch brief: «IMG_0012.jpg — сердечко + ретуш — коментар». */
export function picksTxt(picks: readonly ClientPick[], labels: PickLabels): string {
  return (
    picks
      .map((p) => {
        const parts = [p.name, markOf(p, labels)]
        if (p.comments.length) parts.push(p.comments.join(' | ').replace(/\s*\n\s*/g, ' '))
        return parts.join(' — ')
      })
      .join('\n') + (picks.length ? '\n' : '')
  )
}

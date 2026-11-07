/**
 * Turning decisions into files: .xmp sidecars next to the RAWs (Lightroom
 * Classic / Capture One / Bridge) and a CSV for everything (incl. JPEGs).
 * Pure planning here; the browser-specific writing is in exportRun().
 */
import type { Outcome } from './decide'
import type { FolderItem, FolderSession } from './types'
import { newSidecar, readFields, updateSidecar, type XmpFields } from './xmp'

type Field = 'rating' | 'label' | 'pick' | 'good'
const FIELDS: Field[] = ['rating', 'label', 'pick', 'good']

export function sidecarName(item: FolderItem): string {
  return item.name.replace(/\.[^.]+$/, '') + '.xmp'
}
export const sidecarKey = (item: FolderItem) => `${item.dir}/${item.name.replace(/\.[^.]+$/, '')}`.toLowerCase()

/** What we would like each field to be, before considering history. */
export function wanted(outcome: Outcome | undefined, writePickFlag: boolean): Record<Field, string | null> {
  return {
    rating: outcome?.rating !== null && outcome?.rating !== undefined ? String(outcome.rating) : null,
    label: outcome?.label ?? null,
    pick: writePickFlag && outcome?.pick ? String(outcome.pick) : null,
    good: writePickFlag && outcome?.pick ? (outcome.pick === 1 ? 'True' : 'False') : null,
  }
}

/**
 * Fields to apply: our value; or, when we have nothing to say any more but
 * wrote something before, the sidecar's original value (null = remove).
 */
export function fieldsFor(
  id: string,
  want: Record<Field, string | null>,
  session: Pick<FolderSession, 'written' | 'original'>
): XmpFields {
  const out: XmpFields = {}
  for (const f of FIELDS) {
    if (want[f] !== null) out[f] = want[f]
    else if (session.written?.[id]?.[f] !== undefined) out[f] = session.original?.[id]?.[f] ?? null
  }
  return out
}

export interface PlannedSidecar {
  item: FolderItem
  /** Relative path of the sidecar inside the folder. */
  path: string
  fileName: string
  xml: string
  existed: boolean
  /** Our values as written (for `written`). */
  wrote: Partial<Record<Field, string>>
  /** Original values of a pre-existing sidecar (for `original`, first time only). */
  original?: Partial<Record<Field, string | null>>
}

export interface Plan {
  sidecars: PlannedSidecar[]
  /** Sidecars that exist but are not XMP we can edit — left alone. */
  unreadable: string[]
  /** RAWs where there is nothing to write (no decision, nothing to undo). */
  untouched: number
}

/**
 * @param existing sidecar text by sidecarKey (only for items that have one)
 * @param existingNames actual file names of existing sidecars (keeps their case)
 */
export function planExport(
  session: FolderSession,
  outcomes: Map<string, Outcome>,
  existing: Map<string, string>,
  existingNames: Map<string, string> = new Map(),
  now = new Date()
): Plan {
  const plan: Plan = { sidecars: [], unreadable: [], untouched: 0 }
  for (const item of session.items) {
    if (item.kind !== 'raw' || !session.analysis[item.id]) continue
    const want = wanted(outcomes.get(item.id), session.settings.writePickFlag)
    const fields = fieldsFor(item.id, want, session)
    const key = sidecarKey(item)
    const old = existing.get(key)
    const fileName = existingNames.get(key) ?? sidecarName(item)
    const path = item.dir ? `${item.dir}/${fileName}` : fileName
    if (Object.keys(fields).length === 0) {
      plan.untouched++
      continue
    }
    const wrote = Object.fromEntries(FIELDS.filter((f) => want[f] !== null).map((f) => [f, want[f]!])) as Partial<Record<Field, string>>
    if (old !== undefined) {
      const xml = updateSidecar(old, fields, now)
      if (xml === null) {
        plan.unreadable.push(path)
        continue
      }
      const original = session.original?.[item.id] ? undefined : readFields(old)
      plan.sidecars.push({ item, path, fileName, xml, existed: true, wrote, ...(original ? { original } : {}) })
    } else {
      // Only set values make sense in a fresh file.
      const fresh: XmpFields = Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string'))
      if (Object.keys(fresh).length === 0) {
        plan.untouched++
        continue
      }
      plan.sidecars.push({ item, path, fileName, xml: newSidecar(fresh, now), existed: false, wrote, original: session.original?.[item.id] ? undefined : {} })
    }
  }
  return plan
}

/** Session bookkeeping after a successful write. */
export function recordExport(session: FolderSession, written: PlannedSidecar[]): FolderSession {
  const w = { ...(session.written ?? {}) }
  const o = { ...(session.original ?? {}) }
  for (const s of written) {
    w[s.item.id] = s.wrote
    if (s.original && !o[s.item.id]) o[s.item.id] = s.original
  }
  return { ...session, written: w, original: o, exportedAt: Date.now() }
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per photo (RAW and JPEG); UTF-8 with BOM so Excel opens it right. */
export function csvReport(
  session: FolderSession,
  order: { id: string }[],
  outcomes: Map<string, Outcome>,
  flagsOf: (id: string) => string[]
): string {
  const byId = new Map(session.items.map((i) => [i.id, i]))
  const rows = [['file', 'path', 'decision', 'suggestions', 'rating', 'label', 'series', 'taken_at']]
  for (const { id } of order) {
    const it = byId.get(id)
    if (!it) continue
    const o = outcomes.get(id)
    const m = session.marks[id]
    const decision = o?.reject ? (o.autoReject ? 'reject (suggested)' : 'reject') : m?.flag === 'pick' ? 'pick' : o?.best ? 'best of burst' : ''
    const t = session.meta[id]?.takenAt
    rows.push([
      it.name,
      id,
      decision,
      flagsOf(id).join(' '),
      o?.rating === null || o?.rating === undefined ? '' : String(o.rating),
      o?.label ?? '',
      o?.seriesId ?? '',
      t ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : '',
    ])
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

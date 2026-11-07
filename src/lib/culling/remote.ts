'use client'
/**
 * Photographer's culling decisions in the database (migration 0059,
 * table culling_decisions) — so they follow the photographer across devices.
 *
 * Optional by design: until 0059 is applied (or on any error) every call
 * resolves to "unavailable" and the panel keeps working on IndexedDB only,
 * exactly as before. Only the person's decisions travel; measurements
 * (sharpness, dHash, faces) stay a local cache.
 */
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { CullingState, Decision } from './types'

export interface DecisionRow {
  decision: Decision | null
  best_of_series: string | null
}

type Rows = Map<string, DecisionRow>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The rows the database should hold for this state (only real asset ids). */
export function rowsFromState(state: Pick<CullingState, 'decisions' | 'bestOverrides'>, assetIds: Set<string>): Rows {
  const rows: Rows = new Map()
  for (const [id, decision] of Object.entries(state.decisions)) {
    if (assetIds.has(id) && UUID.test(id)) rows.set(id, { decision, best_of_series: null })
  }
  for (const [seriesId, id] of Object.entries(state.bestOverrides)) {
    if (!assetIds.has(id) || !UUID.test(id)) continue
    const row = rows.get(id) ?? { decision: null, best_of_series: null }
    rows.set(id, { ...row, best_of_series: seriesId })
  }
  return rows
}

export function stateFromRows(rows: Rows): Pick<CullingState, 'decisions' | 'bestOverrides'> {
  const decisions: Record<string, Decision> = {}
  const bestOverrides: Record<string, string> = {}
  rows.forEach((row, id) => {
    if (row.decision) decisions[id] = row.decision
    if (row.best_of_series) bestOverrides[row.best_of_series] = id
  })
  return { decisions, bestOverrides }
}

/** Rows to upsert and ids to delete to get from `before` to `after`. */
export function diffRows(before: Rows, after: Rows): { upsert: [string, DecisionRow][]; remove: string[] } {
  const upsert: [string, DecisionRow][] = []
  after.forEach((row, id) => {
    const old = before.get(id)
    if (!old || old.decision !== row.decision || old.best_of_series !== row.best_of_series) upsert.push([id, row])
  })
  const remove = [...before.keys()].filter((id) => !after.has(id))
  return { upsert, remove }
}

/** null = the table is not there (0059 not applied) or the read failed. */
export async function loadRemote(galleryId: string): Promise<Rows | null> {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from('culling_decisions')
      .select('asset_id, decision, best_of_series')
      .eq('gallery_id', galleryId)
      .returns<({ asset_id: string } & DecisionRow)[]>()
    if (error || !data) return null
    return new Map(data.map((r) => [r.asset_id, { decision: r.decision, best_of_series: r.best_of_series }]))
  } catch {
    return null
  }
}

/** Applies the diff; false = could not save (the caller falls back to the device). */
export async function saveRemote(galleryId: string, ownerId: string, before: Rows, after: Rows): Promise<boolean> {
  const { upsert, remove } = diffRows(before, after)
  if (upsert.length === 0 && remove.length === 0) return true
  try {
    const supabase = createSupabaseBrowserClient()
    if (upsert.length > 0) {
      const { error } = await supabase.from('culling_decisions').upsert(
        upsert.map(([asset_id, row]) => ({ asset_id, gallery_id: galleryId, owner_id: ownerId, ...row })),
        { onConflict: 'asset_id' }
      )
      if (error) return false
    }
    if (remove.length > 0) {
      const { error } = await supabase.from('culling_decisions').delete().eq('gallery_id', galleryId).in('asset_id', remove)
      if (error) return false
    }
    return true
  } catch {
    return false
  }
}

'use server'

/**
 * Test-only stand-ins for the gallery order (tests/e2e/gallery-sort.spec.ts):
 * one gallery kept in this server's memory. The ordering mirrors
 * sort_gallery_assets (0067/0071: capture time, no date last, then upload
 * time) and the position of a new photo mirrors nextPosition (uploads.ts:
 * max + 1). The re-sort after a batch runs the REAL resortAfterUpload against
 * a client stub backed by this store. Refuses unless E2E_THEME_PREVIEW=1.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resortAfterUpload, type GallerySortMode } from '@/lib/gallery/sortMode'
import type { SortMode, SortResult } from '@/lib/actions/galleries'

interface Photo {
  name: string
  takenAt: string | null
  createdAt: number
  position: number
}

const store: { mode: GallerySortMode; photos: Photo[]; clock: number; resorts: number } = {
  mode: 'manual',
  photos: [],
  clock: 0,
  resorts: 0,
}
const enabled = () => process.env.E2E_THEME_PREVIEW === '1'

function sortStore(mode: SortMode) {
  store.mode = mode === 'taken' ? 'taken_at' : 'manual'
  const key = (p: Photo) => (mode === 'taken' && p.takenAt ? Date.parse(p.takenAt) : Number.POSITIVE_INFINITY)
  const ordered = [...store.photos].sort((a, b) => key(a) - key(b) || a.createdAt - b.createdAt)
  ordered.forEach((photo, index) => {
    photo.position = index + 1
  })
}

/** The bits of a Supabase client resortAfterUpload uses, backed by the store. */
const storeClient = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { sort_mode: store.mode }, error: null }) }),
    }),
  }),
  rpc: async (_fn: string, args: { p_mode: SortMode }) => {
    store.resorts += 1
    sortStore(args.p_mode)
    return { data: store.photos.length, error: null }
  },
} as unknown as SupabaseClient

export async function e2eSortState() {
  const photos = [...store.photos].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
  return { mode: store.mode, resorts: store.resorts, photos: photos.map((p) => ({ name: p.name, takenAt: p.takenAt })) }
}

export async function e2eSort(mode: SortMode): Promise<SortResult> {
  if (!enabled()) return { ok: false, error: 'failed' }
  sortStore(mode)
  return { ok: true, changed: store.photos.length, mode: store.mode, modeStored: true }
}

export async function e2eRegister(name: string, takenAt: string | null): Promise<void> {
  if (!enabled()) return
  const last = store.photos.reduce((max, p) => Math.max(max, p.position), 0)
  store.photos.push({ name, takenAt, createdAt: ++store.clock, position: last + 1 })
}

export async function e2eAfterBatch(): Promise<{ resorted: boolean }> {
  if (!enabled()) return { resorted: false }
  return { resorted: (await resortAfterUpload(storeClient, 'e2e')).resorted }
}

export async function e2eResetSort(): Promise<void> {
  if (!enabled()) return
  store.mode = 'manual'
  store.photos = []
  store.clock = 0
  store.resorts = 0
}

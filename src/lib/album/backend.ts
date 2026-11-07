'use client'

/**
 * Where the album builder keeps its data. The UI talks only to this
 * interface; two implementations:
 *   * server — server actions on Supabase (RLS: owner only), the real cabinet;
 *   * local  — localStorage + the bundled showcase photos, for the demo and
 *              the Playwright e2e suite, which runs without a database.
 */
import {
  createAlbumProject,
  deleteAlbumProfile,
  deleteAlbumProject,
  listAlbumGalleries,
  listAlbumProfiles,
  listAlbumProjects,
  loadAlbumProject,
  refreshAlbumPhotos,
  renameAlbumProject,
  saveAlbumProfile,
  saveAlbumSpread,
  signAlbumOriginals,
  syncAlbumSpreads,
  type ActionResult,
} from '@/lib/actions/albums'
import { normalizeSpec } from './profiles'
import type { AlbumPhoto, AlbumProject, AlbumProjectSummary, AlbumSpread, PrintProfile, PrintSpec } from './types'

export interface GalleryOption {
  id: string
  title: string
  photoCount: number
}

export interface LoadedProject {
  project: AlbumProject
  photos: AlbumPhoto[]
  /** Gallery the «add photos» uploader writes to (album's own gallery), or null. */
  uploadGalleryId: string | null
}

export interface AlbumBackend {
  kind: 'server' | 'local'
  listProfiles(): Promise<PrintProfile[]>
  saveProfile(input: { id?: string; name: string; spec: PrintSpec }): Promise<PrintProfile>
  deleteProfile(id: string): Promise<void>
  listGalleries(): Promise<GalleryOption[]>
  listProjects(): Promise<AlbumProjectSummary[]>
  createProject(input: { title: string; spec: PrintSpec; profileId: string | null; galleryId: string | null }): Promise<{ id: string }>
  renameProject(id: string, title: string): Promise<void>
  deleteProject(id: string): Promise<void>
  loadProject(id: string): Promise<LoadedProject>
  refreshPhotos(projectId: string): Promise<AlbumPhoto[]>
  saveSpread(projectId: string, spread: AlbumSpread, position: number): Promise<void>
  syncSpreads(projectId: string, ids: string[]): Promise<void>
  /** Export only. */
  originalUrls(projectId: string, assetIds: string[]): Promise<Record<string, string>>
}

async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export const serverBackend: AlbumBackend = {
  kind: 'server',
  listProfiles: () => unwrap(listAlbumProfiles()),
  saveProfile: (input) => unwrap(saveAlbumProfile(input)),
  deleteProfile: async (id) => void (await unwrap(deleteAlbumProfile(id))),
  listGalleries: () => unwrap(listAlbumGalleries()),
  listProjects: () => unwrap(listAlbumProjects()),
  createProject: (input) => unwrap(createAlbumProject(input)),
  renameProject: async (id, title) => void (await unwrap(renameAlbumProject(id, title))),
  deleteProject: async (id) => void (await unwrap(deleteAlbumProject(id))),
  loadProject: (id) => unwrap(loadAlbumProject(id)),
  refreshPhotos: (id) => unwrap(refreshAlbumPhotos(id)),
  saveSpread: async (projectId, spread, position) => void (await unwrap(saveAlbumSpread(projectId, spread, position))),
  syncSpreads: async (projectId, ids) => void (await unwrap(syncAlbumSpreads(projectId, ids))),
  originalUrls: async (projectId, assetIds) => {
    const out: Record<string, string> = {}
    for (let i = 0; i < assetIds.length; i += 60) {
      Object.assign(out, await unwrap(signAlbumOriginals(projectId, assetIds.slice(i, i + 60))))
    }
    return out
  },
}

// ---------------------------------------------------------------------------
// local (demo / e2e)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'proiav-album-demo-v1'
export const DEMO_GALLERY_ID = 'demo-gallery'

/** Bundled showcase photos (public/showcase): the demo «gallery». */
const DEMO_SIZES: [number, number][] = [
  [1333, 2000], [1333, 2000], [1333, 2000], [1333, 2000], [2000, 1335], [1333, 2000], [1333, 2000], [1333, 2000],
  [1333, 2000], [1333, 2000], [1333, 2000], [1333, 2000], [1333, 2000], [1333, 2000], [1333, 2000], [2000, 1333],
]

export function demoPhotos(): AlbumPhoto[] {
  return DEMO_SIZES.map(([width, height], i) => {
    const n = String(i + 1).padStart(2, '0')
    return { id: `demo-${n}`, width, height, thumbUrl: `/showcase/${n}.webp`, previewUrl: `/showcase/${n}.jpg`, name: `${n}.jpg` }
  })
}

interface LocalState {
  profiles: PrintProfile[]
  projects: (AlbumProject & { updatedAt: string; profileId: string | null })[]
}

function read(): LocalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LocalState
  } catch {
    // private mode / corrupted — start fresh
  }
  return { profiles: [], projects: [] }
}

function write(state: LocalState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota / private mode: the demo keeps working for this page view
  }
}

function update<T>(fn: (state: LocalState) => T): T {
  const state = read()
  const out = fn(state)
  write(state)
  return out
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 30))

export const localBackend: AlbumBackend = {
  kind: 'local',
  async listProfiles() {
    await delay()
    return read().profiles
  },
  async saveProfile(input) {
    await delay()
    const name = input.name.trim()
    if (!name) throw new Error('Вкажіть назву профілю')
    const profile: PrintProfile = { id: input.id ?? crypto.randomUUID(), name, spec: normalizeSpec(input.spec) }
    return update((s) => {
      const i = s.profiles.findIndex((p) => p.id === profile.id)
      if (i >= 0) s.profiles[i] = profile
      else s.profiles.push(profile)
      return profile
    })
  },
  async deleteProfile(id) {
    update((s) => {
      s.profiles = s.profiles.filter((p) => p.id !== id)
    })
  },
  async listGalleries() {
    return [{ id: DEMO_GALLERY_ID, title: 'Демо: весілля Ані й Тараса', photoCount: DEMO_SIZES.length }]
  },
  async listProjects() {
    await delay()
    return read().projects.map((p) => ({
      id: p.id,
      title: p.title,
      galleryId: p.galleryId,
      spec: p.spec,
      updatedAt: p.updatedAt,
      spreadCount: p.spreads.length,
    }))
  },
  async createProject(input) {
    await delay()
    const title = input.title.trim()
    if (!title) throw new Error('Вкажіть назву альбому')
    const id = crypto.randomUUID()
    update((s) => {
      s.projects.unshift({
        id,
        title,
        galleryId: input.galleryId,
        spec: normalizeSpec(input.spec),
        spreads: [],
        updatedAt: new Date().toISOString(),
        profileId: input.profileId,
      })
    })
    return { id }
  },
  async renameProject(id, title) {
    update((s) => {
      const p = s.projects.find((x) => x.id === id)
      if (p) p.title = title.trim() || p.title
    })
  },
  async deleteProject(id) {
    update((s) => {
      s.projects = s.projects.filter((p) => p.id !== id)
    })
  },
  async loadProject(id) {
    await delay()
    const p = read().projects.find((x) => x.id === id)
    if (!p) throw new Error('Альбом не знайдено')
    return {
      project: { id: p.id, title: p.title, galleryId: p.galleryId, spec: p.spec, spreads: p.spreads },
      photos: p.galleryId === DEMO_GALLERY_ID ? demoPhotos() : [],
      uploadGalleryId: null,
    }
  },
  async refreshPhotos(projectId) {
    const p = read().projects.find((x) => x.id === projectId)
    return p?.galleryId === DEMO_GALLERY_ID ? demoPhotos() : []
  },
  async saveSpread(projectId, spread, position) {
    await delay()
    update((s) => {
      const p = s.projects.find((x) => x.id === projectId)
      if (!p) throw new Error('Альбом не знайдено')
      const i = p.spreads.findIndex((x) => x.id === spread.id)
      if (i >= 0) p.spreads[i] = spread
      else p.spreads.splice(Math.min(position, p.spreads.length), 0, spread)
      p.updatedAt = new Date().toISOString()
    })
  },
  async syncSpreads(projectId, ids) {
    await delay()
    update((s) => {
      const p = s.projects.find((x) => x.id === projectId)
      if (!p) return
      const byId = new Map(p.spreads.map((x) => [x.id, x]))
      p.spreads = ids.map((id) => byId.get(id)).filter((x): x is AlbumSpread => !!x)
      p.updatedAt = new Date().toISOString()
    })
  },
  async originalUrls(_projectId, assetIds) {
    // The demo «originals» are the bundled showcase JPEGs.
    const byId = new Map(demoPhotos().map((p) => [p.id, p.previewUrl]))
    return Object.fromEntries(assetIds.filter((id) => byId.has(id)).map((id) => [id, byId.get(id)!]))
  },
}

export function backendFor(kind: 'server' | 'local'): AlbumBackend {
  return kind === 'server' ? serverBackend : localBackend
}

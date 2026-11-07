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
  setAlbumSpec,
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
  /** Title of the source gallery (the cover of «Магічна збірка»). */
  galleryTitle?: string | null
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
  /** Another print profile (only for an album with nothing placed yet). */
  setSpec(id: string, spec: PrintSpec): Promise<PrintSpec>
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
  setSpec: (id, spec) => unwrap(setAlbumSpec(id, spec)),
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

/**
 * «Магічна збірка» demo: a wedding day from the bundled frames (public/themes
 * + public/showcase) with capture times and real pauses between four parts of
 * the day, two frames without a date (placed by file name), hidden frames,
 * client hearts and a retouch request — what a real gallery gives the planner.
 */
export const DEMO_MAGIC_GALLERY_ID = 'demo-magic'
/** The same frames ×20 (each copy its own URL, so the browser really fetches it): speed check. */
export const DEMO_MAGIC_800_ID = 'demo-magic-800'

interface DemoFrame {
  key: string
  w: number
  h: number
  thumb: string
  preview: string
}
const themeFrame = (n: number): DemoFrame => {
  const nn = String(n).padStart(2, '0')
  const portrait = [6, 9, 10, 13, 18, 19].includes(n)
  return { key: `t${nn}`, w: portrait ? 1335 : 2000, h: portrait ? 2000 : 1335, thumb: `/themes/${nn}-1080.webp`, preview: `/themes/${nn}.jpg` }
}
const showcaseFrame = (n: number): DemoFrame => {
  const nn = String(n).padStart(2, '0')
  const [w, h] = DEMO_SIZES[n - 1]!
  return { key: `s${nn}`, w, h, thumb: `/showcase/${nn}.webp`, preview: `/showcase/${nn}.jpg` }
}
/** [chapter start (minutes after 10:00), frames, minutes between frames]. */
const DEMO_DAY: [number, DemoFrame[], number][] = [
  [0, [2, 6, 8, 10, 12, 13, 15, 16].map(showcaseFrame), 4],
  [150, [1, 3, 11, 4].map(showcaseFrame), 5],
  [300, [...Array.from({ length: 24 }, (_, i) => themeFrame(i + 1)), showcaseFrame(5)], 3],
  [570, [7, 9, 14].map(showcaseFrame), 6],
]
const DEMO_T0 = Date.UTC(2026, 8, 12, 10, 0, 0)
const DEMO_HIDDEN = new Set(['t09', 's12'])
const DEMO_HEARTS: Record<string, number> = { t18: 2, t07: 1, s14: 1 }
const DEMO_RETOUCH = new Set(['s02'])
const DEMO_UNDATED = new Set(['t20', 't21'])

export function demoMagicPhotos(): AlbumPhoto[] {
  const out: AlbumPhoto[] = []
  DEMO_DAY.forEach(([start, frames, step], c) => {
    frames.forEach((f, i) => {
      out.push({
        id: `magic-${f.key}`,
        width: f.w,
        height: f.h,
        thumbUrl: f.thumb,
        previewUrl: f.preview,
        name: `IMG_${c + 1}${String(i + 1).padStart(3, '0')}.jpg`,
        takenAt: DEMO_UNDATED.has(f.key) ? null : DEMO_T0 + (start + i * step) * 60_000,
        hidden: DEMO_HIDDEN.has(f.key),
        favorites: DEMO_HEARTS[f.key] ?? 0,
        retouch: DEMO_RETOUCH.has(f.key),
      })
    })
  })
  return out
}

export function demoMagic800(): AlbumPhoto[] {
  const base = demoMagicPhotos()
  return Array.from({ length: 800 }, (_, i) => {
    const b = base[i % base.length]!
    const chapter = Math.floor(i / 200)
    return {
      ...b,
      id: `bench-${i}`,
      thumbUrl: `${b.thumbUrl}?copy=${i}`,
      name: `IMG_${String(1000 + i)}.jpg`,
      takenAt: DEMO_T0 + chapter * 150 * 60_000 + (i % 200) * 25_000,
      hidden: i % 97 === 13,
      favorites: i % 61 === 7 ? 1 : 0,
      retouch: false,
    }
  })
}

function demoPhotosOf(galleryId: string | null): AlbumPhoto[] {
  if (galleryId === DEMO_GALLERY_ID) return demoPhotos()
  if (galleryId === DEMO_MAGIC_GALLERY_ID) return demoMagicPhotos()
  if (galleryId === DEMO_MAGIC_800_ID) return demoMagic800()
  return []
}

const DEMO_GALLERIES = [
  { id: DEMO_GALLERY_ID, title: 'Демо: весілля Ані й Тараса', photoCount: DEMO_SIZES.length },
  { id: DEMO_MAGIC_GALLERY_ID, title: 'Демо: день весілля (з часом зйомки)', photoCount: 40 },
  { id: DEMO_MAGIC_800_ID, title: 'Демо: 800 кадрів (заміри)', photoCount: 800 },
]

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
    return DEMO_GALLERIES
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
  async setSpec(id, spec) {
    const clean = normalizeSpec(spec)
    update((s) => {
      const p = s.projects.find((x) => x.id === id)
      if (p) p.spec = clean
    })
    return clean
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
      photos: demoPhotosOf(p.galleryId),
      uploadGalleryId: null,
      galleryTitle: p.galleryId === DEMO_MAGIC_800_ID ? 'Великий день' : p.galleryId ? 'Аня й Тарас' : null,
    }
  },
  async refreshPhotos(projectId) {
    const p = read().projects.find((x) => x.id === projectId)
    return demoPhotosOf(p?.galleryId ?? null)
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
  async originalUrls(projectId, assetIds) {
    // The demo «originals» are the bundled showcase JPEGs.
    const p = read().projects.find((x) => x.id === projectId)
    const byId = new Map(demoPhotosOf(p?.galleryId ?? DEMO_GALLERY_ID).map((x) => [x.id, x.previewUrl]))
    return Object.fromEntries(assetIds.filter((id) => byId.has(id)).map((id) => [id, byId.get(id)!]))
  },
}

export function backendFor(kind: 'server' | 'local'): AlbumBackend {
  return kind === 'server' ? serverBackend : localBackend
}

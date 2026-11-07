'use server'

/**
 * Album builder (stage 1) server actions. Every query runs with the user's
 * own Supabase client, so RLS (migrations 0061–0062: owner only) is the gate;
 * the explicit owner filters are belt and braces. Media never passes through
 * here: the editor gets short-lived signed preview URLs, and only the export
 * asks for originals (signOriginals), a few at a time.
 */
import { redirect } from 'next/navigation'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeSpec, profileFromRow, rowFromSpec, type PrintProfileRow } from '@/lib/album/profiles'
import { normalizeRotation } from '@/lib/album/crop'
import { sanitizeText } from '@/lib/album/texts'
import type {
  AlbumPhoto,
  AlbumProject,
  AlbumProjectSummary,
  AlbumSpread,
  PrintProfile,
  PrintSpec,
  SpreadKind,
} from '@/lib/album/types'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

const PREVIEW_TTL = 3 * 60 * 60
const ORIGINAL_TTL = 15 * 60
const MAX_ORIGINALS_PER_CALL = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')
  return { supabase, user }
}

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    // redirect() throws a special error that must propagate.
    if (error && typeof error === 'object' && 'digest' in error && String((error as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw error
    return { ok: false, error: error instanceof Error ? error.message : 'Помилка' }
  }
}

const PROFILE_COLUMNS =
  'id, name, spread_width_mm, spread_height_mm, bleed_mm, safe_mm, margin_mm, gap_mm, dpi, color_profile, cover_width_mm, cover_height_mm, cover_bleed_mm, cover_spine_mm, cover_spine_per_spread_mm'

// ---------------------------------------------------------------------------
// print profiles
// ---------------------------------------------------------------------------

export async function listAlbumProfiles(): Promise<ActionResult<PrintProfile[]>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
      .from('album_print_profiles')
      .select(PROFILE_COLUMNS)
      .eq('owner_id', user.id)
      .order('created_at')
      .returns<PrintProfileRow[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map(profileFromRow)
  })
}

export async function saveAlbumProfile(input: { id?: string; name: string; spec: PrintSpec }): Promise<ActionResult<PrintProfile>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const name = input.name.trim().slice(0, 80)
    if (!name) throw new Error('Вкажіть назву профілю')
    const row = rowFromSpec(name, normalizeSpec(input.spec))
    const query = input.id
      ? supabase.from('album_print_profiles').update(row).eq('id', input.id).eq('owner_id', user.id)
      : supabase.from('album_print_profiles').insert({ ...row, owner_id: user.id })
    const { data, error } = await query.select(PROFILE_COLUMNS).single<PrintProfileRow>()
    if (error) throw new Error(error.message)
    return profileFromRow(data)
  })
}

export async function deleteAlbumProfile(id: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { error } = await supabase.from('album_print_profiles').delete().eq('id', id).eq('owner_id', user.id)
    if (error) throw new Error(error.message)
    return null
  })
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

export async function listAlbumGalleries(): Promise<ActionResult<{ id: string; title: string; photoCount: number }[]>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
      .from('galleries')
      .select('id, title, assets(count)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .returns<{ id: string; title: string; assets: { count: number }[] }[]>()
    if (error) throw new Error(error.message)
    return (data ?? []).map((g) => ({ id: g.id, title: g.title, photoCount: g.assets?.[0]?.count ?? 0 }))
  })
}

export async function listAlbumProjects(): Promise<ActionResult<AlbumProjectSummary[]>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
      .from('album_projects')
      .select('id, title, gallery_id, spec, updated_at, album_spreads(count)')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .returns<
        { id: string; title: string; gallery_id: string | null; spec: PrintSpec; updated_at: string; album_spreads: { count: number }[] }[]
      >()
    if (error) throw new Error(error.message)
    return (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      galleryId: p.gallery_id,
      spec: p.spec,
      updatedAt: p.updated_at,
      spreadCount: p.album_spreads?.[0]?.count ?? 0,
    }))
  })
}

export async function createAlbumProject(input: {
  title: string
  spec: PrintSpec
  profileId: string | null
  galleryId: string | null
}): Promise<ActionResult<{ id: string }>> {
  return wrap(async () => {
    const { supabase } = await requireUser()
    const title = input.title.trim().slice(0, 120)
    if (!title) throw new Error('Вкажіть назву альбому')
    const spec = normalizeSpec(input.spec)
    // One RPC (0065): checks the gallery is the caller's, or creates the
    // album's own unpublished service gallery and marks it — that mark keeps
    // the gallery out of the Free 30-day cleanup while the album exists.
    const { data, error } = await supabase.rpc('album_create_project', {
      p_title: title,
      p_spec: spec,
      p_profile: input.profileId && UUID.test(input.profileId) ? input.profileId : null,
      p_gallery: input.galleryId && UUID.test(input.galleryId) ? input.galleryId : null,
    })
    if (error) throw new Error(error.message.includes('gallery_not_found') ? 'Галерею не знайдено' : error.message)
    return { id: data as string }
  })
}

export async function renameAlbumProject(id: string, title: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const clean = title.trim().slice(0, 120)
    if (!clean) throw new Error('Вкажіть назву')
    const { error } = await supabase.from('album_projects').update({ title: clean }).eq('id', id).eq('owner_id', user.id)
    if (error) throw new Error(error.message)
    return null
  })
}

export async function deleteAlbumProject(id: string): Promise<ActionResult<null>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    // The source gallery (and its photos) stays: it may be the client's gallery.
    const { error } = await supabase.from('album_projects').delete().eq('id', id).eq('owner_id', user.id)
    if (error) throw new Error(error.message)
    return null
  })
}

interface AssetRow {
  id: string
  r2_key: string
  width: number | null
  height: number | null
  variants: Record<string, string> | null
  focal_x: number | null
  focal_y: number | null
}

async function photosOf(supabase: ReturnType<typeof createSupabaseServerClient>, galleryId: string | null): Promise<AlbumPhoto[]> {
  if (!galleryId) return []
  const { data, error } = await supabase
    .from('assets')
    .select('id, r2_key, width, height, variants, focal_x, focal_y')
    .eq('gallery_id', galleryId)
    .eq('kind', 'photo')
    .order('position')
    .order('created_at')
    .returns<AssetRow[]>()
  if (error) throw new Error(error.message)
  const storage = getStorage()
  const sign = async (key: string) => {
    try {
      return await storage.getSignedReadUrl(key, { expiresInSeconds: PREVIEW_TTL })
    } catch {
      return ''
    }
  }
  return Promise.all(
    (data ?? [])
      // Without the original size there is no DPI check — such rows are
      // half-finished uploads; they show up after a refresh once complete.
      .filter((a) => a.width && a.height)
      .map(async (a) => {
        const v = a.variants ?? {}
        // Editor works on previews only; the original is never signed here.
        const [thumbUrl, previewUrl] = await Promise.all([sign(v.thumb ?? v.preview ?? a.r2_key), sign(v.preview ?? v.thumb ?? a.r2_key)])
        return {
          id: a.id,
          width: a.width!,
          height: a.height!,
          thumbUrl,
          previewUrl,
          name: (a.r2_key.split('/').pop() ?? a.id).replace(/^[0-9a-f-]{37}/, ''),
          focalX: a.focal_x === null ? null : a.focal_x / 100,
          focalY: a.focal_y === null ? null : a.focal_y / 100,
        }
      })
  )
}

interface SlotRow {
  position: number
  x_mm: number | string
  y_mm: number | string
  w_mm: number | string
  h_mm: number | string
  asset_id: string | null
  zoom: number | string
  focal_x: number | string
  focal_y: number | string
  rotation: number | string | null
}

export async function loadAlbumProject(id: string): Promise<
  ActionResult<{ project: AlbumProject; photos: AlbumPhoto[]; uploadGalleryId: string | null }>
> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { data: row, error } = await supabase
      .from('album_projects')
      .select('id, title, gallery_id, spec')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle<{ id: string; title: string; gallery_id: string | null; spec: PrintSpec }>()
    if (error) throw new Error(error.message)
    if (!row) throw new Error('Альбом не знайдено')
    const { data: spreads, error: spreadError } = await supabase
      .from('album_spreads')
      .select('id, kind, layout, position, texts, spine_mm, album_slots(position, x_mm, y_mm, w_mm, h_mm, asset_id, zoom, focal_x, focal_y, rotation)')
      .eq('project_id', id)
      .order('position')
      .order('created_at')
      .returns<{ id: string; kind: SpreadKind; layout: string; position: number; texts: unknown; spine_mm: number | string | null; album_slots: SlotRow[] }[]>()
    if (spreadError) throw new Error(spreadError.message)
    const project: AlbumProject = {
      id: row.id,
      title: row.title,
      galleryId: row.gallery_id,
      spec: row.spec,
      spreads: (spreads ?? []).map((s) => ({
        id: s.id,
        kind: s.kind,
        layout: s.layout,
        texts: (Array.isArray(s.texts) ? s.texts : []).map(sanitizeText).filter((t): t is NonNullable<typeof t> => !!t),
        spineMm: s.spine_mm === null || s.spine_mm === undefined ? null : Number(s.spine_mm),
        slots: [...(s.album_slots ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((slot) => ({
            id: `${s.id}-${slot.position}`,
            x: Number(slot.x_mm),
            y: Number(slot.y_mm),
            w: Number(slot.w_mm),
            h: Number(slot.h_mm),
            assetId: slot.asset_id,
            zoom: Number(slot.zoom),
            fx: Number(slot.focal_x),
            fy: Number(slot.focal_y),
            rotation: Number(slot.rotation ?? 0),
          })),
      })),
    }
    // Uploads go to the source gallery only when it is the album's own
    // (unpublished «Альбом: …») one — a client gallery is managed on its page.
    const { data: gallery } = row.gallery_id
      ? await supabase.from('galleries').select('id, is_published').eq('id', row.gallery_id).maybeSingle<{ id: string; is_published: boolean }>()
      : { data: null }
    return { project, photos: await photosOf(supabase, row.gallery_id), uploadGalleryId: gallery && !gallery.is_published ? gallery.id : null }
  })
}

export async function refreshAlbumPhotos(projectId: string): Promise<ActionResult<AlbumPhoto[]>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const { data } = await supabase
      .from('album_projects')
      .select('gallery_id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .maybeSingle<{ gallery_id: string | null }>()
    if (!data) throw new Error('Альбом не знайдено')
    return photosOf(supabase, data.gallery_id)
  })
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits

export async function saveAlbumSpread(projectId: string, spread: AlbumSpread, position: number): Promise<ActionResult<null>> {
  return wrap(async () => {
    const { supabase } = await requireUser()
    if (!UUID.test(spread.id) || !UUID.test(projectId)) throw new Error('Невірний id')
    const payload = {
      id: spread.id,
      project_id: projectId,
      position,
      kind: spread.kind,
      layout: spread.layout,
      spine_mm: spread.kind === 'cover' && typeof spread.spineMm === 'number' ? round(spread.spineMm, 1) : null,
      texts: (spread.texts ?? []).slice(0, 40).map(sanitizeText).filter(Boolean),
      slots: spread.slots.slice(0, 40).map((s, i) => ({
        position: i,
        x_mm: round(s.x, 2),
        y_mm: round(s.y, 2),
        w_mm: round(s.w, 2),
        h_mm: round(s.h, 2),
        asset_id: s.assetId && UUID.test(s.assetId) ? s.assetId : null,
        zoom: round(Math.min(Math.max(s.zoom, 1), 10), 3),
        focal_x: round(Math.min(Math.max(s.fx, 0), 1), 4),
        focal_y: round(Math.min(Math.max(s.fy, 0), 1), 4),
        rotation: normalizeRotation(s.rotation),
      })),
    }
    const { error } = await supabase.rpc('album_save_spread', { p_spread: payload })
    if (error) throw new Error(error.message)
    return null
  })
}

export async function syncAlbumSpreads(projectId: string, ids: string[]): Promise<ActionResult<null>> {
  return wrap(async () => {
    const { supabase } = await requireUser()
    if (!ids.every((id) => UUID.test(id))) throw new Error('Невірний id')
    const { error } = await supabase.rpc('album_sync_spreads', { p_project: projectId, p_ids: ids })
    if (error) throw new Error(error.message)
    return null
  })
}

/** Export only: short-lived signed URLs of ORIGINALS for photos of this album's gallery. */
export async function signAlbumOriginals(projectId: string, assetIds: string[]): Promise<ActionResult<Record<string, string>>> {
  return wrap(async () => {
    const { supabase, user } = await requireUser()
    const ids = [...new Set(assetIds)].filter((id) => UUID.test(id)).slice(0, MAX_ORIGINALS_PER_CALL)
    const { data: project } = await supabase
      .from('album_projects')
      .select('gallery_id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .maybeSingle<{ gallery_id: string | null }>()
    if (!project?.gallery_id || !ids.length) return {}
    const { data, error } = await supabase
      .from('assets')
      .select('id, r2_key')
      .in('id', ids)
      .eq('owner_id', user.id)
      .eq('gallery_id', project.gallery_id)
      .returns<{ id: string; r2_key: string }[]>()
    if (error) throw new Error(error.message)
    const storage = getStorage()
    const out: Record<string, string> = {}
    await Promise.all(
      (data ?? []).map(async (a) => {
        out[a.id] = await storage.getSignedReadUrl(a.r2_key, { expiresInSeconds: ORIGINAL_TTL })
      })
    )
    return out
  })
}

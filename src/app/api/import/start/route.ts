import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MAX_IMPORT_FILES,
  MAX_IMPORT_GROUPS,
  MAX_TITLE_LENGTH,
  mimeFromName,
} from '@/lib/import/zip-plan'
import { effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { slugify } from '@/lib/slug'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { MAX_FILE_BYTES } from '@/lib/uploads'

export const runtime = 'nodejs'
export const maxDuration = 60

interface StartFile {
  name: string
  size: number
}

interface StartBody {
  zipName: string
  filesTotal: number
  galleries: { title: string; files: StartFile[] }[]
}

function parseBody(value: unknown): StartBody | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.zipName !== 'string' || !v.zipName.trim() || v.zipName.length > 300) return null
  if (typeof v.filesTotal !== 'number' || !Array.isArray(v.galleries)) return null
  if (v.galleries.length === 0 || v.galleries.length > MAX_IMPORT_GROUPS) return null

  let fileCount = 0
  for (const gallery of v.galleries) {
    if (typeof gallery !== 'object' || gallery === null) return null
    const g = gallery as Record<string, unknown>
    if (typeof g.title !== 'string' || !g.title.trim() || g.title.length > MAX_TITLE_LENGTH) {
      return null
    }
    if (!Array.isArray(g.files) || g.files.length === 0) return null
    for (const file of g.files) {
      const f = file as Record<string, unknown>
      if (
        typeof f?.name !== 'string' ||
        !f.name ||
        f.name.length > 512 ||
        typeof f.size !== 'number' ||
        f.size <= 0
      ) {
        return null
      }
    }
    fileCount += g.files.length
  }
  if (fileCount > MAX_IMPORT_FILES) return null
  return v as unknown as StartBody
}

/** Keys per imported_galleries lookup: Cyrillic titles percent-encode ~6x, so
 * one IN over 200 of them would overflow the request URL. */
const LOOKUP_CHUNK = 20

/**
 * original_name values already in a gallery (PostgREST caps a page at 1000).
 * Throws on a failed read: guessing "nothing there" would re-upload everything.
 */
async function existingNames(supabase: SupabaseClient, galleryId: string): Promise<Set<string>> {
  const names = new Set<string>()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('assets')
      .select('original_name')
      .eq('gallery_id', galleryId)
      .not('original_name', 'is', null)
      .range(from, from + pageSize - 1)
      .returns<{ original_name: string }[]>()
    if (error) throw new Error(`existing names: ${error.message}`)
    for (const row of data ?? []) names.add(row.original_name)
    if (!data || data.length < pageSize) break
  }
  return names
}

/**
 * Zip import, step 1. The browser has read the zip's table of contents and
 * sends the plan (galleries + file names/sizes, no bytes). Here we:
 *   - reuse the galleries an earlier import of the same zip created, and list
 *     the file names they already hold, so re-running an import resumes it;
 *   - check the plan's storage BEFORE anything is created — a zip that does
 *     not fit fails upfront, not at 80%;
 *   - create the missing galleries as drafts and the gallery_imports row.
 * Files then go through the regular upload endpoints, tagged with importId.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = parseBody(await request.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, grace_until, storage_used_bytes, storage_limit_bytes, display_name')
    .eq('user_id', user.id)
    .single<{
      plan: string
      grace_until: string | null
      storage_used_bytes: number
      storage_limit_bytes: number
      display_name: string | null
    }>()
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  const plan = effectiveGalleryPlan(profile.plan, profile.grace_until)
  const videoAllowed = plan.features.video

  // Any failed read below answers 500 before anything is created: resuming on
  // a partial picture would duplicate galleries and files.
  const titles = body.galleries.map((gallery) => gallery.title.trim())
  const galleryIdByTitle = new Map<string, string>()
  for (let i = 0; i < titles.length; i += LOOKUP_CHUNK) {
    const { data: mapped, error: mappedError } = await supabase
      .from('imported_galleries')
      .select('gallery_id, source_key')
      .eq('owner_id', user.id)
      .in('source_key', titles.slice(i, i + LOOKUP_CHUNK))
      .returns<{ gallery_id: string; source_key: string }[]>()
    if (mappedError) {
      console.error('import start: imported_galleries lookup failed', mappedError.message)
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
    }
    for (const row of mapped ?? []) galleryIdByTitle.set(row.source_key, row.gallery_id)
  }

  // What will really be uploaded: not already there, allowed by the plan.
  let newBytes = 0
  const existingByTitle = new Map<string, string[]>()
  for (const gallery of body.galleries) {
    const title = gallery.title.trim()
    const galleryId = galleryIdByTitle.get(title)
    let existing = new Set<string>()
    if (galleryId) {
      try {
        existing = await existingNames(supabase, galleryId)
      } catch (cause) {
        console.error('import start:', cause)
        return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
      }
    }
    existingByTitle.set(title, [...existing])
    for (const file of gallery.files) {
      if (existing.has(file.name)) continue
      const type = mimeFromName(file.name)
      if (!type || file.size > MAX_FILE_BYTES) continue
      if (type.startsWith('video/') && !videoAllowed) continue
      newBytes += file.size
    }
  }

  const limit = Math.min(profile.storage_limit_bytes, planStorageBytes(plan))
  const availableBytes = Math.max(limit - profile.storage_used_bytes, 0)
  if (newBytes > availableBytes) {
    return NextResponse.json(
      { error: 'storage_quota_exceeded', neededBytes: newBytes, availableBytes },
      { status: 403 }
    )
  }

  const brand = (profile.display_name ?? '').trim()
  const result: { title: string; galleryId: string; existing: string[] }[] = []
  for (const gallery of body.galleries) {
    const title = gallery.title.trim()
    let galleryId = galleryIdByTitle.get(title)
    if (!galleryId) {
      // Same shape as createGallery(): brand-prefixed slug, unpublished draft.
      const { data: created, error } = await supabase
        .from('galleries')
        .insert({
          owner_id: user.id,
          slug: slugify([brand, title].filter(Boolean).join(' ')),
          title,
        })
        .select('id')
        .single<{ id: string }>()
      if (error || !created) {
        console.error('import start: gallery create failed', error?.message)
        return NextResponse.json({ error: 'gallery_create_failed' }, { status: 500 })
      }
      galleryId = created.id
      // Without this mapping a re-run could not find the gallery and would
      // create a second one, so an unmapped gallery is removed again.
      const { error: mapError } = await supabase
        .from('imported_galleries')
        .insert({ gallery_id: galleryId, owner_id: user.id, source_key: title })
      if (mapError) {
        console.error('import start: imported_galleries insert failed', mapError.message)
        await supabase.from('galleries').delete().eq('id', galleryId)
        return NextResponse.json({ error: 'gallery_create_failed' }, { status: 500 })
      }
    }
    result.push({ title, galleryId, existing: existingByTitle.get(title) ?? [] })
  }

  // Created last: a failure above leaves no import stuck in 'running'
  // (the galleries already made are mapped, so a re-run resumes into them).
  const { data: importRow, error: importError } = await supabase
    .from('gallery_imports')
    .insert({
      owner_id: user.id,
      zip_name: body.zipName.trim(),
      files_total: Math.max(0, Math.floor(body.filesTotal)),
    })
    .select('id')
    .single<{ id: string }>()
  if (importError || !importRow) {
    console.error('import start: gallery_imports insert failed', importError?.message)
    return NextResponse.json({ error: 'import_create_failed' }, { status: 500 })
  }

  return NextResponse.json({
    importId: importRow.id,
    videoAllowed,
    galleries: result,
  })
}

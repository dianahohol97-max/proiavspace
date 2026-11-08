import { NextResponse, type NextRequest } from 'next/server'
import { galleryAssetsClient, isGalleryUnlocked } from '@/lib/gallery-access'
import { downloadsDisabledResponse, readDownloadsSetting } from '@/lib/gallery/downloads'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Asset } from '@/lib/types'

export const runtime = 'nodejs'
// Next to Supabase (eu-central-1) — same region as the public gallery page.
export const preferredRegion = 'fra1'

/**
 * "Download all" without server egress: hands the browser a list of
 * presigned original URLs; the client fetches straight from storage and
 * builds the zip locally (src/lib/gallery/archive.ts). One archive event is
 * logged per invocation.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, has_password, owner_id')
    .eq('slug', params.slug)
    .single<{ id: string; has_password: boolean; owner_id: string }>()
  if (!gallery) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!(await isGalleryUnlocked(gallery))) {
    return NextResponse.json({ error: 'locked' }, { status: 403 })
  }

  // «Клієнт може завантажувати фото» вимкнено (0070): 403 з людським текстом.
  // Власник галереї завантажує завжди. Без міграції колонки нема → дозволено.
  if (!(await readDownloadsSetting(supabase, gallery.id)).enabled) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id !== gallery.owner_id) return downloadsDisabledResponse(request, 'json')
  }

  const { data: assets } = await galleryAssetsClient(supabase, gallery)
    .from('assets')
    .select('*')
    .eq('gallery_id', gallery.id)
    // Service role for password galleries bypasses the RLS rule (0054).
    .eq('hidden_from_client', false)
    .order('position')
    .order('created_at')
    .returns<Asset[]>()

  const storage = getStorage()
  const files = await Promise.all(
    (assets ?? []).map(async (asset, index) => {
      const baseName = (asset.r2_key.split('/').pop() ?? 'file').replace(/^[0-9a-f-]{37}/, '')
      return {
        // Index prefix keeps names unique inside the zip.
        name: `${String(index + 1).padStart(3, '0')}-${baseName}`,
        // Files are fetched one after another and every URL is handed out at
        // the start, so a 2 500-photo wedding on a slow line needs well over an
        // hour; with 15 minutes the tail of the archive got 403 (CL-03).
        url: await storage.getSignedReadUrl(asset.r2_key, { expiresInSeconds: 6 * 60 * 60 }),
        size: asset.size_bytes,
      }
    })
  )

  await supabase.rpc('record_gallery_archive', { gid: gallery.id })

  return NextResponse.json({ files })
}

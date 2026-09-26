import { NextResponse, type NextRequest } from 'next/server'
import { galleryAssetsClient, isGalleryUnlocked } from '@/lib/gallery-access'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Asset } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * "Download all" without server egress: hands the browser a list of
 * short-lived presigned original URLs; the client fetches straight from R2
 * and builds the zip locally (see DownloadAllButton). One archive event is
 * logged per invocation.
 */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, has_password')
    .eq('slug', params.slug)
    .single()
  if (!gallery) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!isGalleryUnlocked(gallery)) {
    return NextResponse.json({ error: 'locked' }, { status: 403 })
  }

  const { data: assets } = await galleryAssetsClient(supabase, gallery)
    .from('assets')
    .select('*')
    .eq('gallery_id', gallery.id)
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
        url: await storage.getSignedReadUrl(asset.r2_key, { expiresInSeconds: 15 * 60 }),
      }
    })
  )

  await supabase.rpc('record_gallery_archive', { gid: gallery.id })

  return NextResponse.json({ files })
}

import { NextResponse, type NextRequest } from 'next/server'
import { MAX_OFFLINE_PHOTOS_SERVER, offlinePhotoKey } from '@/lib/app/offline-pack'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * «Портфоліо офлайн»: short-lived read URLs of a gallery's MOBILE previews
 * (never originals), for the phone to keep in Cache Storage
 * (lib/app/portfolio.ts). Owner only: the gallery is read under RLS AND
 * filtered by owner_id (published galleries are readable by everyone).
 */
export async function GET(_request: NextRequest, { params }: { params: { galleryId: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!/^[0-9a-f-]{36}$/i.test(params.galleryId)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, title')
    .eq('id', params.galleryId)
    .eq('owner_id', user.id)
    .maybeSingle<{ id: string; title: string }>()
  if (!gallery) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, kind, variants, width, height, hidden_from_client')
    .eq('gallery_id', gallery.id)
    .eq('owner_id', user.id)
    .eq('kind', 'photo')
    .eq('hidden_from_client', false)
    .order('position')
    .order('created_at')
    .limit(MAX_OFFLINE_PHOTOS_SERVER * 2)
    .returns<{ id: string; variants: Record<string, string> | null; width: number | null; height: number | null }[]>()
  if (error) return NextResponse.json({ error: 'read_failed' }, { status: 500 })

  const storage = getStorage()
  const usable = (assets ?? [])
    .map((asset) => ({ asset, key: offlinePhotoKey(asset.variants) }))
    .filter((entry): entry is { asset: (typeof entry)['asset']; key: string } => entry.key !== null)
    .slice(0, MAX_OFFLINE_PHOTOS_SERVER)
  const photos = await Promise.all(
    usable.map(async ({ asset, key }) => ({
      url: await storage.getSignedReadUrl(key, { expiresInSeconds: 60 * 60 }),
      width: asset.width,
      height: asset.height,
    }))
  )
  return NextResponse.json(
    { id: gallery.id, title: gallery.title, photos },
    { headers: { 'cache-control': 'private, no-store' } }
  )
}

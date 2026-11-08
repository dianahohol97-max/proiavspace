import { NextResponse, type NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { isGalleryUnlocked } from '@/lib/gallery-access'
import { notifyClientPick } from '@/lib/push/events'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SelectionKind } from '@/lib/types'

export const runtime = 'nodejs'
// Next to Supabase (eu-central-1) — same region as the public gallery page.
export const preferredRegion = 'fra1'

interface ToggleBody {
  assetId: string
  kind: SelectionKind
  selected: boolean
}

function isToggleBody(value: unknown): value is ToggleBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.assetId === 'string' &&
    (v.kind === 'favorite' || v.kind === 'retouch') &&
    typeof v.selected === 'boolean'
  )
}

/**
 * Client photo selection ("favorites" / "send to retouch") — no registration.
 * Identity is the `ct` cookie minted by the middleware; RLS only allows
 * writes into published, non-expired galleries.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const clientToken = request.cookies.get('ct')?.value
  if (!clientToken) {
    return NextResponse.json({ error: 'no_client_token' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!isToggleBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, has_password')
    .eq('slug', params.slug)
    .single()
  if (!gallery) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!(await isGalleryUnlocked(gallery))) {
    return NextResponse.json({ error: 'locked' }, { status: 403 })
  }

  // Writes go through a SECURITY DEFINER RPC scoped by the client token: the
  // selections table is no longer directly writable by the anon key, so one
  // visitor can't touch another's picks even by calling PostgREST directly.
  const { error } = await supabase.rpc('set_selection', {
    p_slug: params.slug,
    p_asset: body.assetId,
    p_kind: body.kind,
    p_selected: body.selected,
    p_token: clientToken,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // «Клієнт обрав фото / позначив ретуш» on the photographer's phone (one per
  // gallery and hour, see lib/push/events). Never holds up the client's tap.
  if (body.selected) waitUntil(notifyClientPick(gallery.id, body.kind).catch(() => null))

  return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { getStorage } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * After the browser PUTs the reel video to R2, save its public URL on the post
 * and flip it from `needs_video` to `ready`. Founder-only.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    postId?: string
    key?: string
  } | null
  if (!body?.postId || !body.key || !body.key.startsWith(`u/${user.id}/social/`)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const videoUrl = await getStorage().getSignedReadUrl(body.key)
  const { data: row } = await admin
    .from('social_posts')
    .select('media')
    .eq('id', body.postId)
    .single()
  const media = { ...((row?.media as Record<string, unknown>) ?? {}), video: videoUrl }

  const { error } = await admin
    .from('social_posts')
    .update({ media, status: 'ready' })
    .eq('id', body.postId)
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, video: videoUrl })
}

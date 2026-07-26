import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_BYTES = 500 * 1024 * 1024 // 500 MB — comfortably above a short reel

/** Presign a direct R2 PUT for a reel video (founder-only). */
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
    contentType?: string
    sizeBytes?: number
  } | null
  if (!body?.postId || !body.contentType?.startsWith('video/') || !body.sizeBytes) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (body.sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const ext = body.contentType === 'video/quicktime' ? 'mov' : 'mp4'
  const key = `u/${user.id}/social/${body.postId}/video.${ext}`
  const { url } = await getStorage().getUploadUrl({ key, contentType: body.contentType })
  return NextResponse.json({ url, key })
}

import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { isAllowedFrameUrl } from '@/lib/social/stories'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Founder-only download proxy for story frames: streams a factory-repo file
 * back with Content-Disposition: attachment so the browser saves it instead
 * of opening the image. Only factory RAW urls are allowed (no open proxy).
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('u')
  if (!url || !isAllowedFrameUrl(url)) {
    return NextResponse.json({ error: 'bad_url' }, { status: 400 })
  }

  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const name = url.split('/').slice(-2).join('_') || 'story.png'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

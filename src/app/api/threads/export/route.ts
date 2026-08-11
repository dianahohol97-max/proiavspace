import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function authed(req: NextRequest): boolean {
  const secret = process.env.MAKE_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Make pulls this on a schedule to mirror the Threads reply queue into the
 * command center, which is where the founder reviews drafts. Read-only:
 * statuses set in the command center never flow back here.
 */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const days = Math.min(Number(req.nextUrl.searchParams.get('days')) || 14, 60)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('threads_replies')
    .select(
      'source_url, source_author, source_text, draft_reply, keyword, status, source_created_at, created_at'
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  return NextResponse.json({ replies: data ?? [] })
}

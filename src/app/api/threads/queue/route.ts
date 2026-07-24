import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function authed(req: NextRequest): boolean {
  const secret = process.env.MAKE_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

/** Make polls this for the next approved Threads reply to publish. */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const { data } = await admin
    .from('threads_replies')
    .select('id, source_url, source_author, draft_reply')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1)

  const reply = data?.[0]
  if (!reply) return NextResponse.json({ reply: null })
  return NextResponse.json({ reply })
}

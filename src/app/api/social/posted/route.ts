import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function authed(req: NextRequest): boolean {
  const secret = process.env.MAKE_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

/** Make calls this after publishing to mark a post as posted. */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { id?: string; external_id?: string }
  if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const patch: Record<string, unknown> = {
    status: 'posted',
    posted_at: new Date().toISOString(),
  }
  if (body.external_id) patch.external_id = body.external_id

  const { error } = await admin.from('social_posts').update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

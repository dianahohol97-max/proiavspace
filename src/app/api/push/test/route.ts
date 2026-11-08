import { NextResponse } from 'next/server'
import { notifyOwner } from '@/lib/push/send'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** «Надіслати пробне»: one notification to every device of the signed-in photographer. */
export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const result = await notifyOwner({
    ownerId: user.id,
    kind: 'test',
    dedupeKey: `test:${Date.now()}`,
    message: (t) => ({ title: t.pushTestTitle, body: t.pushTestBody, path: '/dashboard/settings' }),
  })
  if (result.status === 'skipped') {
    const status = result.reason === 'not_configured' ? 503 : 409
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json(result, { status: result.delivered > 0 ? 200 : 502 })
}

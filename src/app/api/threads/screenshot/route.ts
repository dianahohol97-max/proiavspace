import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { composeCommentFromScreenshot } from '@/lib/threads/voice'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024 // 8 МБ — з головою для скріншота

/**
 * Founder uploads a screenshot of any Threads post → Gemini vision extracts
 * author + text and drafts an on-voice comment → lands in threads_replies as
 * a draft (source «скрін»), reviewable in the admin like every other reply.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  const apiKey = process.env.GEMINI_API_KEY
  if (!admin || !apiKey) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('image')
  const sourceUrl = String(form?.get('source_url') ?? '').trim()
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'no_image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const mime = file.type || 'image/png'
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const draft = await composeCommentFromScreenshot(apiKey, base64, mime)
  if (!draft) {
    return NextResponse.json({ error: 'not_readable' }, { status: 422 })
  }

  const { error } = await admin.from('threads_replies').insert({
    source_url: sourceUrl || `screenshot:${Date.now()}`,
    source_author: draft.author ? `@${draft.author.replace(/^@/, '')}` : null,
    source_text: draft.text,
    draft_reply: draft.reply,
    keyword: 'скрін',
    source_created_at: new Date().toISOString(),
    status: 'draft',
  })
  if (error) return NextResponse.json({ error: 'db' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

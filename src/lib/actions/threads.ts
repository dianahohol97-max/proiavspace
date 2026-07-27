'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { composeReply } from '@/lib/threads/scan'
import type { Locale } from '@/lib/i18n/config'
import type { ReplyStatus } from '@/lib/social/threads'

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect('/uk/dashboard')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Service role not configured')
  return admin
}

export async function setReplyStatus(
  locale: Locale,
  id: string,
  status: ReplyStatus
): Promise<void> {
  const admin = await requireAdmin()
  const patch: Record<string, unknown> = { status }
  if (status === 'posted') patch.posted_at = new Date().toISOString()
  const { error } = await admin.from('threads_replies').update(patch).eq('id', id)
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/threads`)
}

/**
 * Manual seed: the founder pastes a Threads post (link + its text) she found
 * herself, and проЯв drafts a reply for it — no dependence on the thin keyword
 * search. The draft lands in the same «На затвердження» list.
 */
export async function draftReplyFromInput(locale: Locale, formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const text = String(formData.get('source_text') ?? '').trim()
  const url = String(formData.get('source_url') ?? '').trim()
  const author = String(formData.get('source_author') ?? '').trim()
  if (!text) return

  const apiKey = process.env.GEMINI_API_KEY
  const draft = apiKey ? await composeReply(apiKey, text, author || null, false) : null

  const { error } = await admin.from('threads_replies').insert({
    source_url: url || `manual:${Date.now()}`,
    source_author: author ? (author.startsWith('@') ? author : `@${author}`) : null,
    source_text: text,
    draft_reply: draft ?? '',
    keyword: 'вручну',
    source_created_at: new Date().toISOString(),
    status: 'draft',
  })
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/threads`)
}

/** Edit the drafted reply before approving. */
export async function updateReplyDraft(locale: Locale, id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const draft_reply = String(formData.get('draft_reply') ?? '').trim()
  if (!draft_reply) return
  const { error } = await admin.from('threads_replies').update({ draft_reply }).eq('id', id)
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/threads`)
}

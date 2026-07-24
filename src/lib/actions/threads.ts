'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

/** Edit the drafted reply before approving. */
export async function updateReplyDraft(locale: Locale, id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const draft_reply = String(formData.get('draft_reply') ?? '').trim()
  if (!draft_reply) return
  const { error } = await admin.from('threads_replies').update({ draft_reply }).eq('id', id)
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/threads`)
}

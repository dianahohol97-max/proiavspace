import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Threads engagement: the system drafts a helpful reply from проЯв to a relevant
 * post; the founder approves (or edits/skips); Make publishes approved ones.
 */
export type ReplyStatus = 'draft' | 'approved' | 'posted' | 'skipped'

export interface ThreadsReply {
  id: string
  source_url: string
  source_author: string | null
  source_text: string
  draft_reply: string
  keyword: string | null
  status: ReplyStatus
  source_created_at: string | null
  posted_at: string | null
  created_at: string
}

const COLS =
  'id,source_url,source_author,source_text,draft_reply,keyword,status,source_created_at,posted_at,created_at'

/**
 * Reply to fresh posts only. On the Ukrainian photographer niche the volume is
 * low, so a 24h window almost never has enough posts — 72h still catches an
 * active conversation while keeping the queue useful.
 */
export const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000

export function isFresh(sourceCreatedAt: string | null): boolean {
  if (!sourceCreatedAt) return false
  return Date.now() - new Date(sourceCreatedAt).getTime() <= FRESH_WINDOW_MS
}

export function ageLabel(sourceCreatedAt: string | null): string {
  if (!sourceCreatedAt) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(sourceCreatedAt).getTime()) / 60000))
  if (mins < 60) return `${mins} хв тому`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} год тому`
  const days = Math.round(hours / 24)
  return `${days} дн тому`
}

export async function getThreadsReplies(): Promise<ThreadsReply[]> {
  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('threads_replies')
    .select(COLS)
    .order('created_at', { ascending: false })
  return (data as ThreadsReply[] | null) ?? []
}

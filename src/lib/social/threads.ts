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
  posted_at: string | null
  created_at: string
}

const COLS =
  'id,source_url,source_author,source_text,draft_reply,keyword,status,posted_at,created_at'

export async function getThreadsReplies(): Promise<ThreadsReply[]> {
  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('threads_replies')
    .select(COLS)
    .order('created_at', { ascending: false })
  return (data as ThreadsReply[] | null) ?? []
}

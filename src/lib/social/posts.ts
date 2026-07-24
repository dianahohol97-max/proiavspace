import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Social content pipeline (mirrors the blog data layer). Posts flow through a
 * status the founder approves; Make picks up `approved` rows and publishes.
 */
export type SocialStatus =
  | 'draft'
  | 'needs_video'
  | 'ready'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'archived'

export interface SocialPost {
  id: string
  kind: string
  rubric: string
  hook: string
  caption: string
  hashtags: string
  status: SocialStatus
  media: { cover?: string; count?: number; video?: string } | null
  video_prompt: string
  external_id: string | null
  scheduled_at: string | null
  posted_at: string | null
  position: number
}

const COLS =
  'id,kind,rubric,hook,caption,hashtags,status,media,video_prompt,external_id,scheduled_at,posted_at,position'

export async function getAdminPosts(): Promise<SocialPost[]> {
  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('social_posts')
    .select(COLS)
    .order('position', { ascending: true })
  return (data as SocialPost[] | null) ?? []
}

export async function getSocialTopicStats(): Promise<{ todo: number; done: number }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { todo: 0, done: 0 }
  const [{ count: todo }, { count: done }] = await Promise.all([
    admin.from('social_topics').select('*', { count: 'exact', head: true }).eq('status', 'todo'),
    admin.from('social_topics').select('*', { count: 'exact', head: true }).eq('status', 'done'),
  ])
  return { todo: todo ?? 0, done: done ?? 0 }
}

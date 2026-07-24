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

export interface ReelScene {
  text?: string
  broll?: string
}

export interface SocialPost {
  id: string
  kind: string
  rubric: string
  hook: string
  caption: string
  hashtags: string
  status: SocialStatus
  media: { cover?: string; count?: number; video?: string; slides?: string[] } | null
  body: { scenes?: ReelScene[]; duration?: string; audio?: string } | null
  video_prompt: string
  external_id: string | null
  scheduled_at: string | null
  posted_at: string | null
  position: number
}

const COLS =
  'id,kind,rubric,hook,caption,hashtags,status,media,body,video_prompt,external_id,scheduled_at,posted_at,position'

// The content factory publishes rendered slides + captions here (raw CDN).
const FACTORY_RAW =
  'https://raw.githubusercontent.com/dianahohol97-max/proyav-content-factory/main'

export interface ResolvedPost extends SocialPost {
  slides: string[]
  resolvedCaption: string
  resolvedHashtags: string
}

export async function getAdminPosts(): Promise<SocialPost[]> {
  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('social_posts')
    .select(COLS)
    .order('position', { ascending: true })
  return (data as SocialPost[] | null) ?? []
}

/** One post with carousel slides + caption resolved from the factory queue. */
export async function getAdminPost(id: string): Promise<ResolvedPost | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { data } = await admin.from('social_posts').select(COLS).eq('id', id).single()
  if (!data) return null
  const post = data as SocialPost
  const media = post.media ?? {}
  let slides = media.slides ?? (media.cover ? [media.cover] : [])
  let caption = post.caption ?? ''
  let hashtags = post.hashtags ?? ''

  if (post.kind === 'carousel' && post.external_id) {
    try {
      const res = await fetch(`${FACTORY_RAW}/queue/carousel_queue.json`, { cache: 'no-store' })
      const items = (await res.json()) as Array<{
        id: string
        slides?: string[]
        caption?: string
        hashtags?: string
      }>
      const item = items.find((x) => x.id === post.external_id)
      if (item) {
        if (item.slides?.length) slides = item.slides
        if (!caption && item.caption) caption = item.caption
        if (!hashtags && item.hashtags) hashtags = item.hashtags
      }
    } catch {
      /* fall back to whatever the row already carries */
    }
  }

  return { ...post, slides, resolvedCaption: caption, resolvedHashtags: hashtags }
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

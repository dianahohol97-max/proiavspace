import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// The content factory publishes rendered slides + captions here (raw CDN).
const FACTORY_RAW =
  'https://raw.githubusercontent.com/dianahohol97-max/proyav-content-factory/main'

function authed(req: NextRequest): boolean {
  const secret = process.env.MAKE_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

interface FactoryItem {
  id: string
  caption?: string
  hashtags?: string
  slides?: string[]
}

/**
 * Make polls this for the next approved post of a given format (carousel / reel
 * / single). Service-role read stays inside the app; Make only carries the
 * shared MAKE_SECRET. For carousels the slides + caption come from the factory
 * queue so nothing is duplicated in the DB.
 */
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const format = new URL(req.url).searchParams.get('format')
  let query = admin
    .from('social_posts')
    .select('*')
    .eq('status', 'approved')
    .order('position', { ascending: true })
    .limit(1)
  if (format) query = query.eq('kind', format)

  const { data } = await query
  const post = data?.[0]
  if (!post) return NextResponse.json({ post: null })

  const media = (post.media ?? {}) as { cover?: string; slides?: string[]; video?: string }
  let slides = media.slides ?? []
  let caption = post.caption ?? ''
  let hashtags = post.hashtags ?? ''

  if (post.kind === 'carousel' && post.external_id) {
    try {
      const res = await fetch(`${FACTORY_RAW}/queue/carousel_queue.json`, { cache: 'no-store' })
      const items = (await res.json()) as FactoryItem[]
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

  return NextResponse.json({
    post: {
      id: post.id,
      kind: post.kind,
      rubric: post.rubric,
      hook: post.hook,
      caption,
      hashtags,
      cover: media.cover ?? slides[0] ?? null,
      slides,
      video: media.video ?? null,
      external_id: post.external_id,
    },
  })
}

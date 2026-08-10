import { NextResponse, type NextRequest } from 'next/server'
import { queueCandidates, type IncomingPost } from '@/lib/threads/scan'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Apify ingest for the Threads engagement queue.
 *
 * Threads' own keyword_search only returns posts from accounts with a role on
 * our Meta app until `threads_keyword_search` clears App Review, so it finds
 * nothing useful. Until then an Apify Threads scraper runs on a schedule and
 * calls this route, which pushes the results through the SAME freshness /
 * dedupe / relevance filters as the native sweep. When Meta approves, drop the
 * Apify schedule and nothing else changes.
 *
 * Accepts either shape:
 *   - an Apify webhook body — we read resource.defaultDatasetId and pull the
 *     dataset items with APIFY_TOKEN
 *   - { posts: [...] } — items passed straight through, for manual replay
 *
 * Env: APIFY_TOKEN (dataset read), MAKE_SECRET or CRON_SECRET (auth).
 */

interface ApifyWebhookBody {
  resource?: { defaultDatasetId?: string }
  defaultDatasetId?: string
  datasetId?: string
  posts?: unknown[]
}

function authed(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const cron = process.env.CRON_SECRET
  const make = process.env.MAKE_SECRET
  return Boolean((cron && auth === `Bearer ${cron}`) || (make && auth === `Bearer ${make}`))
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

/**
 * Apify Threads actors disagree on field names, so accept the common spellings
 * rather than pinning to one actor. Anything without a URL and text is dropped
 * downstream by the freshness gate.
 */
function normalise(raw: unknown): IncomingPost | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const user = (r.user ?? r.owner ?? r.author) as Record<string, unknown> | undefined

  const permalink =
    str(r.permalink) ?? str(r.url) ?? str(r.postUrl) ?? str(r.threadUrl) ?? str(r.link)
  const text = str(r.text) ?? str(r.caption) ?? str(r.content) ?? str(r.postText)
  if (!permalink || !text) return null

  const rawTs = r.timestamp ?? r.takenAt ?? r.taken_at ?? r.publishedOn ?? r.createdAt ?? r.date
  let timestamp: string | undefined
  if (typeof rawTs === 'number') {
    // Unix seconds vs milliseconds — anything below ~1e12 is seconds.
    timestamp = new Date(rawTs < 1e12 ? rawTs * 1000 : rawTs).toISOString()
  } else if (str(rawTs)) {
    const d = new Date(str(rawTs) as string)
    if (!Number.isNaN(d.getTime())) timestamp = d.toISOString()
  }

  return {
    id: str(r.id) ?? str(r.postId) ?? str(r.pk) ?? permalink,
    text,
    username: (str(r.username) ?? str(r.ownerUsername) ?? str(user?.username))?.replace(/^@/, ''),
    timestamp,
    permalink,
    keyword: str(r.searchQuery) ?? str(r.query) ?? str(r.keyword) ?? 'apify',
  }
}

async function fetchDataset(datasetId: string): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not set')
  const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=500`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`apify dataset ${res.status}`)
  const json = await res.json()
  return Array.isArray(json) ? json : []
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: ApifyWebhookBody
  try {
    body = (await req.json()) as ApifyWebhookBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const datasetId = body.resource?.defaultDatasetId ?? body.defaultDatasetId ?? body.datasetId
  let items: unknown[]
  if (Array.isArray(body.posts)) {
    items = body.posts
  } else if (datasetId) {
    try {
      items = await fetchDataset(datasetId)
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 })
    }
  } else {
    return NextResponse.json({ error: 'no posts or datasetId' }, { status: 400 })
  }

  const posts = items.map(normalise).filter((p): p is IncomingPost => p !== null)
  const result = await queueCandidates(posts, 'threads-apify', {
    datasetId: datasetId ?? null,
    rawItems: items.length,
    usable: posts.length,
  })
  await recordRun(items.length, posts.length, result.found, result.inserted)
  return NextResponse.json({ rawItems: items.length, usable: posts.length, ...result })
}

/**
 * Heartbeat for the command center. An empty queue is ambiguous on its own —
 * quiet week or dead monitor — so every sweep records its funnel there even
 * when it inserted nothing. Best-effort: never fail the ingest over it.
 */
async function recordRun(rawItems: number, usable: number, fresh: number, inserted: number) {
  const url = process.env.CC_SUPABASE_URL
  const key = process.env.CC_SUPABASE_SERVICE_KEY
  const projectId = process.env.CC_PROYAV_PROJECT_ID
  if (!url || !key || !projectId) return
  try {
    await fetch(`${url}/rest/v1/cc_scan_runs`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        project_id: projectId,
        origin: 'apify',
        raw_items: rawItems,
        usable,
        fresh,
        inserted,
      }),
    })
  } catch {
    /* heartbeat only */
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { queueCandidates, type IncomingPost } from '@/lib/threads/scan'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Apify ingest — the only source feeding the Threads engagement queue.
 *
 * Threads' own keyword_search stayed scoped to our own account (a probe run
 * returned 18 month-old posts from us and nothing else), so an Apify Threads
 * scraper does the finding on a schedule and calls this route. The native
 * sweep is no longer scheduled; /api/threads/scan stays only as a manual probe.
 *
 * Accepts any of these shapes:
 *   - a bare `[...]` array — the Apify run-sync-get-dataset-items response
 *     forwarded verbatim. This is what the Make scenario sends: its HTTP module
 *     passes the response buffer through as a raw body, so nothing is
 *     re-serialised on the way and no JSON escaping can go wrong.
 *   - an Apify webhook body — we read resource.defaultDatasetId and pull the
 *     dataset items with APIFY_TOKEN
 *   - { posts: [...] } — items passed straight through, for manual replay
 *
 * Env: APIFY_TOKEN (dataset read), MAKE_SECRET or CRON_SECRET (auth).
 * `apifyToken` in the body overrides the env var — the Make scenario already
 * holds the token, and this route is behind the shared secret either way.
 */

interface ApifyWebhookBody {
  resource?: { defaultDatasetId?: string }
  defaultDatasetId?: string
  datasetId?: string
  apifyToken?: string
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
/** First non-empty string among the given keys, camelCase or snake_case alike. */
const pick = (r: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = str(r[k])
    if (v) return v
  }
  return undefined
}

/** Threads permalinks carry the handle: https://www.threads.com/@handle/post/CODE */
const handleFromUrl = (url: string): string | undefined =>
  /threads\.(?:net|com)\/@([^/?#]+)/i.exec(url)?.[1]

function normalise(raw: unknown): IncomingPost | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const user = (r.user ?? r.owner ?? r.author) as Record<string, unknown> | undefined

  const permalink = pick(r, 'permalink', 'url', 'postUrl', 'post_url', 'threadUrl', 'thread_url', 'link')
  const text = pick(r, 'text', 'caption', 'content', 'postText', 'post_text', 'text_content', 'caption_text')
  if (!permalink || !text) return null

  const rawTs =
    r.timestamp ??
    r.takenAt ??
    r.taken_at ??
    r.taken_at_timestamp ??
    r.publishedOn ??
    r.published_at ??
    r.createdAt ??
    r.created_at ??
    r.date
  let timestamp: string | undefined
  if (typeof rawTs === 'number') {
    // Unix seconds vs milliseconds — anything below ~1e12 is seconds.
    timestamp = new Date(rawTs < 1e12 ? rawTs * 1000 : rawTs).toISOString()
  } else if (str(rawTs)) {
    const d = new Date(str(rawTs) as string)
    if (!Number.isNaN(d.getTime())) timestamp = d.toISOString()
  }

  // Actors spell the author a dozen ways and some omit it entirely, so fall
  // back to the handle embedded in the permalink — it is always there.
  const username =
    pick(
      r,
      'username',
      'user_name',
      'ownerUsername',
      'owner_username',
      'authorUsername',
      'author_username',
      'accountUsername',
      'account_username',
      'handle',
    ) ??
    (user ? pick(user, 'username', 'user_name', 'handle') : undefined) ??
    handleFromUrl(permalink)

  return {
    id: pick(r, 'id', 'postId', 'post_id', 'post_code', 'postCode', 'code', 'pk') ?? permalink,
    text,
    username: username?.replace(/^@/, ''),
    timestamp,
    permalink,
    keyword: pick(r, 'searchQuery', 'search_query', 'query', 'keyword') ?? 'apify',
  }
}

async function fetchDataset(datasetId: string, bodyToken?: string): Promise<unknown[]> {
  const token = bodyToken || process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not set')
  const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=500`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`apify dataset ${res.status}`)
  const json = await res.json()
  return Array.isArray(json) ? json : []
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  // A bare array is the dataset itself, forwarded verbatim by the scenario.
  const body: ApifyWebhookBody = Array.isArray(parsed)
    ? { posts: parsed }
    : ((parsed ?? {}) as ApifyWebhookBody)

  const datasetId = body.resource?.defaultDatasetId ?? body.defaultDatasetId ?? body.datasetId
  let items: unknown[]
  if (Array.isArray(body.posts)) {
    items = body.posts
  } else if (datasetId) {
    try {
      items = await fetchDataset(datasetId, str(body.apifyToken))
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

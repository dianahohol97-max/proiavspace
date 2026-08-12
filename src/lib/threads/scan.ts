import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Threads engagement engine: search Threads for relevant fresh (<24h) posts,
 * draft an on-brand reply from проЯв for each, and queue them for the founder
 * to approve. Runs on a schedule (Vercel Cron). No posting happens here — the
 * founder replies manually, so the search token can be from ANY account.
 *
 * Env: THREADS_SEARCH_TOKEN (Threads API token with keyword search),
 *      GEMINI_API_KEY (drafting). Missing either → the run no-ops cleanly.
 */

// Threads keyword_search matches literally, so niche multi-word phrases return
// nothing. We search BROAD terms real Ukrainian photographers post (these
// reliably return recent posts) plus a few high-precision niche ones, then a
// Gemini relevance gate (see draftReply) keeps only posts where проЯв fits.
const KEYWORDS = [
  // broad — high volume, filtered by the relevance gate
  'фотограф',
  'фотосесія',
  'весільний фотограф',
  'сімейний фотограф',
  'фотографія клієнту',
  // niche — rarer but high precision when they hit
  'віддати фото клієнту',
  'галерея для фотографа',
  'pixieset',
]

const GRAPH = 'https://graph.threads.net/v1.0'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
// The sweep is now manual — a button in the command center, pressed every few
// days — so a 24h window (sized for a twice-daily cron) threw away almost
// everything: a real run saw 29 usable posts and kept 3. Three days still
// lands under threads people are reading, and matches how often the button
// actually gets pressed.
const FRESH_MS = 72 * 60 * 60 * 1000
const MAX_NEW_PER_RUN = 8
// Cap Gemini calls per run: we evaluate at most this many fresh candidates
// (relevance + draft in one call) to find up to MAX_NEW_PER_RUN good replies.
const MAX_EVAL_PER_RUN = 30

interface FoundPost {
  id: string
  text?: string
  username?: string
  timestamp?: string
  permalink?: string
}
type Candidate = FoundPost & { keyword: string }

interface SearchOutcome {
  posts: FoundPost[]
  status: number
  error?: string
}

/**
 * One-off diagnostic: run a single keyword search and return the raw HTTP
 * status plus a snippet of the raw response body, so we can tell apart an
 * empty-but-authorized search from a dev-mode / permission-scoped one.
 */
export async function probeKeyword(
  q: string
): Promise<{ tokenPresent: boolean; status: number; count: number | null; raw: string }> {
  const token = process.env.THREADS_SEARCH_TOKEN
  if (!token) return { tokenPresent: false, status: 0, count: null, raw: 'no token' }
  const url =
    `${GRAPH}/keyword_search?q=${encodeURIComponent(q)}&search_type=RECENT` +
    `&fields=id,text,username,timestamp,permalink&access_token=${token}`
  try {
    const res = await fetch(url)
    const body = await res.text()
    let count: number | null = null
    try {
      const j = JSON.parse(body) as { data?: unknown[] }
      count = Array.isArray(j.data) ? j.data.length : null
    } catch {
      /* non-JSON body */
    }
    return { tokenPresent: true, status: res.status, count, raw: body.slice(0, 600) }
  } catch (e) {
    return { tokenPresent: true, status: 0, count: null, raw: String(e).slice(0, 300) }
  }
}

async function searchKeyword(token: string, q: string): Promise<SearchOutcome> {
  const url =
    `${GRAPH}/keyword_search?q=${encodeURIComponent(q)}&search_type=RECENT` +
    `&fields=id,text,username,timestamp,permalink&access_token=${token}`
  try {
    const res = await fetch(url)
    const json = (await res.json().catch(() => null)) as { data?: FoundPost[]; error?: unknown } | null
    if (!res.ok) {
      return { posts: [], status: res.status, error: JSON.stringify(json?.error ?? json ?? {}).slice(0, 300) }
    }
    return { posts: json?.data ?? [], status: res.status }
  } catch (e) {
    return { posts: [], status: 0, error: String(e).slice(0, 200) }
  }
}

/**
 * Compose a проЯв reply to a Threads post via Gemini. With `gate: true` the
 * model may return exactly SKIP for off-topic posts (used by the auto-scan on
 * broad keywords); with `gate: false` it always drafts (used when the founder
 * hand-picks a post to reply to). Returns null on SKIP or any error.
 */
export async function composeReply(
  apiKey: string,
  text: string,
  author?: string | null,
  gate = true
): Promise<string | null> {
  const brand =
    `Ти — голос українського бренду проЯв: онлайн-галерея для фотографів, де клієнт ` +
    `отримує красиву галерею замість архіву в Google Drive (100 ГБ за 79 грн, безкоштовний ` +
    `старт, проЯв.space).\n\n` +
    `Ось пост у Threads від @${author ?? 'автор'}:\n"${text ?? ''}"\n\n`
  // Deliberately permissive: the earlier wording demanded the post already be
  // about delivering photos, and a real run rejected all 33 fresh candidates.
  // Anything from a working photographer is fair game to answer warmly; only
  // clearly unrelated posts are dropped. The founder approves every draft
  // before it goes out, so she is the real filter — this step only has to
  // avoid writing under posts where a reply would be bizarre.
  const gated =
    `КРОК 1 — доречність. Відповідай, якщо автор — фотограф або говорить про зйомку, ` +
    `клієнтів, роботу з фото: процес, віддачу чи передачу фото, галереї, архіви, ` +
    `Google Drive чи файлообмінники, ціни, дедлайни, вигорання, пошук клієнтів, ` +
    `обробку, організацію роботи — будь-що з життя фотографа.\n` +
    `SKIP став лише тоді, коли пост узагалі не стосується фотографії й фотографів ` +
    `(політика, реклама чужих товарів, особисте без звʼязку з роботою) або коли ` +
    `відповідь від бренду виглядала б недоречно (горе, конфлікт, чутлива тема). ` +
    `Якщо вагаєшся — краще напиши відповідь, ніж пропусти.\n\n` +
    `КРОК 2 — напиши `
  const ask =
    (gate ? gated : 'Напиши ') +
    `КОРОТКУ (1–2 речення) теплу, корисну відповідь українською. ` +
    `Спершу цінність, без спаму й прямої реклами; проЯв згадай ненав'язливо лише якщо доречно. ` +
    `Без хештегів, без лапок навколо відповіді.`
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: brand + ask }] }],
          generationConfig: { temperature: 0.8 },
        }),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const out = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof out !== 'string' || !out.trim()) return null
    const clean = out.trim()
    if (gate && (/^skip\b/i.test(clean) || clean.toUpperCase() === 'SKIP')) return null
    return clean
  } catch {
    return null
  }
}

/** Auto-scan drafting: relevance-gated compose over a found candidate. */
async function draftReply(apiKey: string, post: Candidate): Promise<string | null> {
  return composeReply(apiKey, post.text ?? '', post.username, true)
}

/**
 * How close a post sits to what проЯв actually solves. Used to order
 * candidates, never to reject them — the relevance gate decides that, and the
 * founder decides after it. Weights are blunt on purpose: a post naming the
 * pain outranks one that merely mentions a shoot.
 */
const TOPIC_WEIGHTS: Array<[RegExp, number]> = [
  // the pain itself
  [/google\s*drive|гугл\s*драйв|дропбокс|dropbox|wetransfer|файлообмінник/i, 10],
  [/галере[її]|gallery|pixieset|pic-?time|zenfolio/i, 8],
  [/віддат|переда[тю]|надісла|відправ|скид(аю|ати)/i, 6],
  [/архів|посилання\s*на\s*фото|zip/i, 5],
  // the work around it
  [/клієнт/i, 4],
  [/фотограф|фотосесі|зйомк|знімк/i, 2],
  [/обробк|ретуш|дедлайн|терпінн|чека[ює]/i, 2],
]

function onTopicScore(text?: string): number {
  if (!text) return 0
  let score = 0
  for (const [re, w] of TOPIC_WEIGHTS) if (re.test(text)) score += w
  return score
}

export interface ScanResult {
  skipped?: string
  found: number
  inserted: number
  /** Dropped for being older than the window. */
  stale?: number
  /** The window itself, so a caller can tell which build answered it. */
  windowHours?: number
}

export type IncomingPost = FoundPost & { keyword?: string }

/**
 * Freshness gate → dedupe against the queue → relevance-gated draft → insert.
 * Shared by the native keyword_search sweep and the Apify ingest route, so both
 * sources land in threads_replies through exactly the same filters.
 */
export async function queueCandidates(
  posts: IncomingPost[],
  source: string,
  extraLog: Record<string, unknown> = {}
): Promise<ScanResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { skipped: 'service role not configured', found: 0, inserted: 0 }
  const apiKey = process.env.GEMINI_API_KEY

  const log = async (payload: Record<string, unknown>) => {
    try {
      await admin.from('scan_log').insert({ source, payload })
    } catch {
      /* diagnostics only */
    }
  }

  if (!apiKey) {
    await log({ ...extraLog, received: posts.length, skipped: 'GEMINI_API_KEY not set' })
    return { skipped: 'GEMINI_API_KEY not set', found: 0, inserted: 0 }
  }

  const now = Date.now()
  const fresh = new Map<string, Candidate>()
  let stale = 0
  for (const p of posts) {
    if (!p.permalink || !p.text) continue
    const ts = p.timestamp ? new Date(p.timestamp).getTime() : 0
    if (!ts || now - ts > FRESH_MS) {
      stale++
      continue
    }
    if (!fresh.has(p.permalink)) fresh.set(p.permalink, { ...p, keyword: p.keyword ?? '' })
  }

  const found = fresh.size
  let inserted = 0
  let evaluated = 0
  let skipped = 0
  if (found > 0) {
    const urls = [...fresh.keys()]
    const { data: existing } = await admin
      .from('threads_replies')
      .select('source_url')
      .in('source_url', urls)
    const have = new Set((existing ?? []).map((r) => (r as { source_url: string }).source_url))

    // Both caps below bite when a sweep brings back dozens of candidates, so
    // the order they are visited decides which posts get a draft at all.
    // Scrape order is arbitrary — score first, so the closest matches to what
    // проЯв actually solves are the ones that make the cut.
    const ranked = [...fresh].sort((a, b) => onTopicScore(b[1].text) - onTopicScore(a[1].text))

    for (const [url, p] of ranked) {
      if (inserted >= MAX_NEW_PER_RUN) break
      if (evaluated >= MAX_EVAL_PER_RUN) break
      if (have.has(url)) continue
      evaluated++
      const draft = await draftReply(apiKey, p) // null = irrelevant (SKIP) or error
      if (!draft) {
        skipped++
        continue
      }
      const { error } = await admin.from('threads_replies').insert({
        source_url: url,
        source_author: p.username ? `@${p.username}` : null,
        source_text: p.text ?? '',
        draft_reply: draft,
        keyword: p.keyword,
        source_created_at: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
        status: 'draft',
      })
      if (!error) inserted++
    }
  }

  await log({ ...extraLog, received: posts.length, stale, found, evaluated, skipped, inserted })
  return { found, inserted, stale, windowHours: FRESH_MS / 3_600_000 }
}

export async function scanThreads(): Promise<ScanResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { skipped: 'service role not configured', found: 0, inserted: 0 }
  const token = process.env.THREADS_SEARCH_TOKEN
  const apiKey = process.env.GEMINI_API_KEY

  const log = async (payload: Record<string, unknown>) => {
    try {
      await admin.from('scan_log').insert({ source: 'threads', payload })
    } catch {
      /* diagnostics only */
    }
  }

  if (!token || !apiKey) {
    const skipped = !token ? 'THREADS_SEARCH_TOKEN not set' : 'GEMINI_API_KEY not set'
    await log({ tokenPresent: !!token, geminiPresent: !!apiKey, skipped })
    return { skipped, found: 0, inserted: 0 }
  }

  const collected: IncomingPost[] = []
  const diag: Array<{ kw: string; status: number; total: number; error?: string }> = []
  for (const keyword of KEYWORDS) {
    const r = await searchKeyword(token, keyword)
    diag.push({ kw: keyword, status: r.status, total: r.posts.length, ...(r.error ? { error: r.error } : {}) })
    for (const p of r.posts) collected.push({ ...p, keyword })
  }

  return queueCandidates(collected, 'threads', { keywords: diag })
}

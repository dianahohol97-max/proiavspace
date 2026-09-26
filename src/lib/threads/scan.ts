import { geminiModel } from '@/lib/gemini'
import { GALLERY_PLANS } from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Threads engagement engine: search Threads for relevant fresh (<24h) posts,
 * draft an on-brand reply from проЯв for each, and queue them for the founder
 * to approve. Not scheduled at the moment (manual mode, see AUTOMATION_SETUP.md
 * §D); run by hand or put back on Vercel Cron. No posting happens here — the
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
// A 24h window (sized for a twice-daily cron) threw away almost everything: a
// real run saw 29 usable posts and kept 3. Three days still lands under
// threads people are reading; overlapping runs are kept out by the dedupe
// against threads_replies. (Not scheduled at the moment — see
// AUTOMATION_SETUP.md §D for how to turn it back on.)
const FRESH_MS = 72 * 60 * 60 * 1000
const MAX_NEW_PER_RUN = 8
// Cap Gemini calls per run: we evaluate at most this many fresh candidates
// (relevance + draft in one call) to find up to MAX_NEW_PER_RUN good replies.
const MAX_EVAL_PER_RUN = 30
// Permalinks per dedupe query (keeps the PostgREST request URL short).
const DEDUPE_CHUNK = 50
// Time budget: the routes run with maxDuration = 60 s. Drafts are made
// DRAFT_CONCURRENCY at a time, no new batch starts after the deadline, and
// every outbound call has its own timeout — so the run always finishes and
// writes its scan_log row instead of being killed mid-way.
const DRAFT_CONCURRENCY = 5
const SEARCH_TIMEOUT_MS = 8_000
const GEMINI_TIMEOUT_MS = 12_000
export const EVAL_BUDGET_MS = 35_000

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
    const res = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
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
 * hand-picks a post to reply to). A SKIP (off-topic) and a failed call are
 * different outcomes: failures must be counted and surfaced, never mistaken
 * for "nothing relevant this week".
 */
export type ComposeOutcome =
  | { kind: 'reply'; text: string }
  | { kind: 'skip' }
  | { kind: 'error'; error: string }

export async function composeReply(
  apiKey: string,
  text: string,
  author?: string | null,
  gate = true
): Promise<ComposeOutcome> {
  const brand =
    `Ти — голос українського бренду проЯв: онлайн-галерея для фотографів, де клієнт ` +
    `отримує красиву галерею замість архіву в Google Drive (${GALLERY_PLANS.basic.storageGb} ГБ за ${GALLERY_PLANS.basic.priceUahMonth} грн, безкоштовний ` +
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
    const MODEL = geminiModel()
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: brand + ask }] }],
          generationConfig: { temperature: 0.8 },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    )
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300)
      return { kind: 'error', error: `gemini ${MODEL} ${res.status}: ${body}` }
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const out = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof out !== 'string' || !out.trim()) {
      return { kind: 'error', error: `gemini ${MODEL}: empty response` }
    }
    const clean = out.trim()
    if (gate && (/^skip\b/i.test(clean) || clean.toUpperCase() === 'SKIP')) return { kind: 'skip' }
    return { kind: 'reply', text: clean }
  } catch (e) {
    return { kind: 'error', error: `gemini: ${String(e).slice(0, 200)}` }
  }
}

/** Auto-scan drafting: relevance-gated compose over a found candidate. */
async function draftReply(apiKey: string, post: Candidate): Promise<ComposeOutcome> {
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
  /** Gemini calls / inserts that failed (not SKIPs). */
  errors?: number
  /** Set when the run as a whole failed — callers answer 5xx so it's visible. */
  error?: string
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
  extraLog: Record<string, unknown> = {},
  /** No new draft batch starts after this (epoch ms). */
  deadline = Date.now() + EVAL_BUDGET_MS
): Promise<ScanResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { skipped: 'service role not configured', found: 0, inserted: 0 }
  const apiKey = process.env.GEMINI_API_KEY

  const log = async (payload: Record<string, unknown>) => {
    const { error } = await admin.from('scan_log').insert({ source, payload })
    if (error) console.error(`threads ${source}: scan_log insert failed:`, error.message)
  }

  if (!apiKey) {
    console.error(`threads ${source}: GEMINI_API_KEY not set, nothing drafted`)
    await log({ ...extraLog, received: posts.length, skipped: 'GEMINI_API_KEY not set' })
    return { skipped: 'GEMINI_API_KEY not set', found: 0, inserted: 0, error: 'GEMINI_API_KEY not set' }
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
  let errors = 0
  let lastError: string | undefined
  let outOfTime = false
  if (found > 0) {
    // Dedupe against the queue. Chunked: an Apify batch can bring hundreds of
    // permalinks and one huge IN list overflows the request URL. If the lookup
    // fails the run stops — drafting blind would queue duplicates.
    const urls = [...fresh.keys()]
    const have = new Set<string>()
    for (let i = 0; i < urls.length; i += DEDUPE_CHUNK) {
      const { data: existing, error: dedupeError } = await admin
        .from('threads_replies')
        .select('source_url')
        .in('source_url', urls.slice(i, i + DEDUPE_CHUNK))
      if (dedupeError) {
        const error = `dedupe lookup failed: ${dedupeError.message}`
        console.error(`threads ${source}:`, error)
        await log({ ...extraLog, received: posts.length, stale, found, error })
        return { found, inserted: 0, stale, windowHours: FRESH_MS / 3_600_000, error }
      }
      for (const r of existing ?? []) have.add((r as { source_url: string }).source_url)
    }

    // Both caps below bite when a sweep brings back dozens of candidates, so
    // the order they are visited decides which posts get a draft at all.
    // Scrape order is arbitrary — score first, so the closest matches to what
    // проЯв actually solves are the ones that make the cut.
    const ranked = [...fresh].sort((a, b) => onTopicScore(b[1].text) - onTopicScore(a[1].text))

    const todo = ranked.filter(([url]) => !have.has(url))
    let next = 0
    while (next < todo.length && inserted < MAX_NEW_PER_RUN && evaluated < MAX_EVAL_PER_RUN) {
      if (Date.now() > deadline) {
        outOfTime = true
        break
      }
      const batch = todo.slice(next, next + Math.min(DRAFT_CONCURRENCY, MAX_EVAL_PER_RUN - evaluated))
      next += batch.length
      evaluated += batch.length
      // composeReply never throws (errors come back as outcomes), so one bad
      // call can't sink the batch.
      const outcomes = await Promise.all(batch.map(([, p]) => draftReply(apiKey, p)))

      for (let i = 0; i < batch.length; i++) {
        const [url, p] = batch[i]
        const outcome = outcomes[i]
        if (outcome.kind === 'skip') {
          skipped++
          continue
        }
        if (outcome.kind === 'error') {
          errors++
          lastError = outcome.error
          console.error(`threads ${source}: draft failed:`, outcome.error)
          continue
        }
        // Batches can overshoot the cap; the extra drafts are simply dropped.
        if (inserted >= MAX_NEW_PER_RUN) continue
        const { error } = await admin.from('threads_replies').insert({
          source_url: url,
          source_author: p.username ? `@${p.username}` : null,
          source_text: p.text ?? '',
          draft_reply: outcome.text,
          keyword: p.keyword,
          source_created_at: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
          status: 'draft',
        })
        if (error) {
          errors++
          lastError = `threads_replies insert: ${error.message}`
          console.error(`threads ${source}: insert failed:`, error.message)
        } else {
          inserted++
        }
      }
    }
    if (outOfTime) console.error(`threads ${source}: time budget reached after ${evaluated} drafts`)
  }

  // Every evaluation failed → the run failed (bad key, quota, retired model),
  // which must not read as "0 inserted, quiet week".
  const runError =
    evaluated > 0 && errors >= evaluated ? `all ${evaluated} drafts failed: ${lastError}` : undefined
  await log({
    ...extraLog,
    received: posts.length,
    stale,
    found,
    evaluated,
    skipped,
    errors,
    ...(lastError ? { lastError } : {}),
    ...(outOfTime ? { outOfTime } : {}),
    inserted,
  })
  return {
    found,
    inserted,
    stale,
    windowHours: FRESH_MS / 3_600_000,
    errors,
    ...(runError ? { error: runError } : {}),
  }
}

export async function scanThreads(): Promise<ScanResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { skipped: 'service role not configured', found: 0, inserted: 0 }
  const token = process.env.THREADS_SEARCH_TOKEN
  const apiKey = process.env.GEMINI_API_KEY

  const log = async (payload: Record<string, unknown>) => {
    const { error } = await admin.from('scan_log').insert({ source: 'threads', payload })
    if (error) console.error('threads scan: scan_log insert failed:', error.message)
  }

  if (!token || !apiKey) {
    const skipped = !token ? 'THREADS_SEARCH_TOKEN not set' : 'GEMINI_API_KEY not set'
    console.error(`threads scan: ${skipped}, nothing searched`)
    await log({ tokenPresent: !!token, geminiPresent: !!apiKey, skipped })
    return { skipped, found: 0, inserted: 0, error: skipped }
  }

  const runStart = Date.now()
  const collected: IncomingPost[] = []
  const diag: Array<{ kw: string; status: number; total: number; error?: string }> = []
  // All keywords at once (each with its own timeout); searchKeyword never throws.
  const results = await Promise.all(KEYWORDS.map((keyword) => searchKeyword(token, keyword)))
  KEYWORDS.forEach((keyword, i) => {
    const r = results[i]
    diag.push({ kw: keyword, status: r.status, total: r.posts.length, ...(r.error ? { error: r.error } : {}) })
    for (const p of r.posts) collected.push({ ...p, keyword })
  })

  // Every keyword search failed (expired token, API change) → the run failed.
  const failedSearches = diag.filter((d) => d.status !== 200)
  if (failedSearches.length === KEYWORDS.length) {
    const error = `all ${KEYWORDS.length} Threads searches failed: ${failedSearches[0]?.status} ${failedSearches[0]?.error ?? ''}`
    console.error('threads scan:', error)
    await log({ keywords: diag, error })
    return { found: 0, inserted: 0, error }
  }

  return queueCandidates(collected, 'threads', { keywords: diag }, runStart + EVAL_BUDGET_MS)
}

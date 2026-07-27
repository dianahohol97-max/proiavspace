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

const KEYWORDS = [
  'гугл диск фото',
  'google drive фотограф',
  'як віддати фото клієнту',
  'галерея для фотографа',
  'передати фотографії клієнту',
  'pixieset',
  'pixover',
  'gallera',
  'файлообмінник для фото',
  'wetransfer фото',
]

const GRAPH = 'https://graph.threads.net/v1.0'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const FRESH_MS = 24 * 60 * 60 * 1000
const MAX_NEW_PER_RUN = 10

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

async function draftReply(apiKey: string, post: Candidate): Promise<string | null> {
  const prompt =
    `Ти — голос українського бренду проЯв: онлайн-галерея для фотографів, де клієнт ` +
    `отримує красиву галерею замість архіву в Google Drive (100 ГБ за 79 грн, безкоштовний ` +
    `старт, проЯв.space).\n` +
    `Напиши КОРОТКУ (1–2 речення), теплу, корисну відповідь українською на цей пост у Threads. ` +
    `Спершу цінність, без спаму й прямої реклами; проЯв згадай ненав'язливо лише якщо доречно. ` +
    `Без хештегів, без лапок навколо відповіді.\n` +
    `Пост від @${post.username ?? 'автор'}: "${post.text ?? ''}"\nВідповідь:`
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8 },
        }),
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

export interface ScanResult {
  skipped?: string
  found: number
  inserted: number
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

  const now = Date.now()
  const fresh = new Map<string, Candidate>()
  const diag: Array<{ kw: string; status: number; total: number; error?: string }> = []
  for (const keyword of KEYWORDS) {
    const r = await searchKeyword(token, keyword)
    diag.push({ kw: keyword, status: r.status, total: r.posts.length, ...(r.error ? { error: r.error } : {}) })
    for (const p of r.posts) {
      if (!p.permalink || !p.text) continue
      const ts = p.timestamp ? new Date(p.timestamp).getTime() : 0
      if (!ts || now - ts > FRESH_MS) continue // fresh only (<24h)
      if (!fresh.has(p.permalink)) fresh.set(p.permalink, { ...p, keyword })
    }
  }

  const found = fresh.size
  let inserted = 0
  if (found > 0) {
    const urls = [...fresh.keys()]
    const { data: existing } = await admin
      .from('threads_replies')
      .select('source_url')
      .in('source_url', urls)
    const have = new Set((existing ?? []).map((r) => (r as { source_url: string }).source_url))

    for (const [url, p] of fresh) {
      if (inserted >= MAX_NEW_PER_RUN) break
      if (have.has(url)) continue
      const draft = await draftReply(apiKey, p)
      if (!draft) continue
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

  await log({ tokenPresent: true, geminiPresent: true, found, inserted, keywords: diag })
  return { found, inserted }
}

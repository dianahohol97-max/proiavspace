import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Crash-forensics sink: the global error hook and the error boundaries post
 * the error text + a log of foreign DOM mutations here, and the row lands in
 * debug_events (service-role only). Always answers 204 — diagnostics must
 * never produce user-visible failures.
 */
/** Hard caps: this endpoint is public, so a bot must not be able to fill the table. */
const MAX_BODY_BYTES = 32 * 1024
const MAX_MUTATIONS = 150
const MAX_MUTATION_CHARS = 300
const MAX_EVENTS_PER_HOUR = 60

type DebugBody = { url?: unknown; ua?: unknown; message?: unknown; mut?: unknown }

export async function POST(request: NextRequest) {
  try {
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })
    const text = await request.text().catch(() => '')
    if (!text || text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })

    let body: DebugBody | null = null
    try {
      body = JSON.parse(text) as DebugBody | null
    } catch {
      body = null
    }
    // Service role only: debug_events has no anon insert path any more.
    const client = createSupabaseAdminClient()
    if (body && client) {
      // Global ceiling instead of a per-IP limiter (no extra infrastructure):
      // real crash reports are rare, so anything above this is noise or abuse.
      const since = new Date(Date.now() - 3600 * 1000).toISOString()
      const { count } = await client
        .from('debug_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
      if ((count ?? 0) < MAX_EVENTS_PER_HOUR) {
        await client.from('debug_events').insert({
          url: String(body.url ?? '').slice(0, 500),
          ua: String(body.ua ?? '').slice(0, 400),
          message: String(body.message ?? '').slice(0, 4000),
          mutations: Array.isArray(body.mut)
            ? body.mut
                .slice(0, MAX_MUTATIONS)
                .map((entry) => String(entry).slice(0, MAX_MUTATION_CHARS))
            : null,
        })
      }
    }
  } catch {
    // swallow everything — this endpoint must never throw
  }
  return new NextResponse(null, { status: 204 })
}

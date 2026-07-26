import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * TEMP crash-forensics sink (gallery white-screen investigation): the global
 * error hook posts the error text + a log of foreign DOM mutations here, and
 * the row lands in debug_events (service-role only). Always answers 204 —
 * diagnostics must never produce user-visible failures. Remove after the
 * investigation closes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      url?: unknown
      ua?: unknown
      message?: unknown
      mut?: unknown
    } | null
    // Prefer the service-role client; fall back to the anon server client
    // (an insert-only RLS policy covers it) when the key isn't configured.
    const client = createSupabaseAdminClient() ?? createSupabaseServerClient()
    if (body && client) {
      await client.from('debug_events').insert({
        url: String(body.url ?? '').slice(0, 500),
        ua: String(body.ua ?? '').slice(0, 400),
        message: String(body.message ?? '').slice(0, 4000),
        mutations: Array.isArray(body.mut) ? body.mut.slice(0, 150) : null,
      })
    }
  } catch {
    // swallow everything — this endpoint must never throw
  }
  return new NextResponse(null, { status: 204 })
}

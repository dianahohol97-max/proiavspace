import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { probeKeyword, scanThreads } from '@/lib/threads/scan'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Threads scan sweep (Vercel Cron, see vercel.json). Finds fresh relevant posts
 * and queues draft replies. Protected by CRON_SECRET (Vercel sends it as a
 * Bearer token on cron invocations).
 */
export async function GET(request: NextRequest) {
  // Triggered either by Vercel Cron (CRON_SECRET) or by Make (MAKE_SECRET), so
  // the cadence can be daily out of the box or every few hours via Make.
  const auth = request.headers.get('authorization')
  const cron = process.env.CRON_SECRET
  const make = process.env.MAKE_SECRET
  const ok = (cron && auth === `Bearer ${cron}`) || (make && auth === `Bearer ${make}`)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Diagnostic: ?probe=<term> runs a single search and records the raw Threads
  // API response to scan_log, so we can see whether keyword_search returns
  // public posts at all (dev-mode/permission scoping vs genuinely empty).
  const probe = request.nextUrl.searchParams.get('probe')
  if (probe) {
    const out = await probeKeyword(probe)
    const admin = createSupabaseAdminClient()
    if (admin) await admin.from('scan_log').insert({ source: 'threads-probe', payload: { probe, ...out } })
    return NextResponse.json({ probe, ...out })
  }

  const result = await scanThreads()
  return NextResponse.json(result)
}

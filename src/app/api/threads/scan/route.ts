import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { probeKeyword, scanThreads } from '@/lib/threads/scan'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Threads scan sweep (not scheduled at the moment — see AUTOMATION_SETUP.md §D
 * to put it on Vercel Cron or Make). Finds fresh relevant posts
 * and queues draft replies. Protected by CRON_SECRET (Vercel sends it as a
 * Bearer token on cron invocations).
 */
export async function GET(request: NextRequest) {
  // Accepts Vercel Cron (CRON_SECRET) or Make (MAKE_SECRET), so it can be put
  // back on either schedule later; neither is configured right now.
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
    if (admin) {
      const { error } = await admin
        .from('scan_log')
        .insert({ source: 'threads-probe', payload: { probe, ...out } })
      if (error) console.error('threads probe: scan_log insert failed:', error.message)
    }
    return NextResponse.json({ probe, ...out })
  }

  const result = await scanThreads()
  // A failed run answers 502 so it shows up as failed in the cron logs.
  return NextResponse.json(result, { status: result.error ? 502 : 200 })
}

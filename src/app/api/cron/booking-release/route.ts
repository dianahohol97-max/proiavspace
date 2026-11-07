import { NextResponse, type NextRequest } from 'next/server'
import { releaseExpiredBookings } from '@/lib/booking/release'
import { reportServerError } from '@/lib/sentry/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Hourly (vercel.json): frees expired unpaid bookings of every photographer
 * and removes their Google Calendar events — see src/lib/booking/release.ts.
 * Protected by CRON_SECRET like the other crons.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 })
  }
  try {
    const summary = await releaseExpiredBookings(admin)
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    reportServerError(error, { area: 'booking.release' })
    return NextResponse.json({ error: 'db_read_failed' }, { status: 500 })
  }
}

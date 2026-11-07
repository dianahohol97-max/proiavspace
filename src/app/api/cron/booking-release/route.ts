import { NextResponse, type NextRequest } from 'next/server'
import { releaseExpiredBookings } from '@/lib/booking/releaseExpired'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Hourly (vercel.json): frees priced bookings left unpaid past the
 * photographer's `unpaid_release_hours`, for every owner, with the service
 * role (src/lib/booking/releaseExpired.ts). Before this the release only ran
 * when the photographer opened the booking dashboard. Protected by CRON_SECRET.
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
    console.log('booking-release:', JSON.stringify(summary))
    return NextResponse.json(summary, { status: summary.errors > 0 ? 500 : 200 })
  } catch (cause) {
    console.error('booking-release: read failed', cause)
    return NextResponse.json({ error: 'db_read_failed' }, { status: 500 })
  }
}

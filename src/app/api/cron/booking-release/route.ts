import { NextResponse, type NextRequest } from 'next/server'
import { releaseExpiredBookings } from '@/lib/booking/releaseExpired'
import { cleanupReleasedSlotEvents } from '@/lib/booking/releaseEvents'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Hourly (vercel.json): frees priced bookings left unpaid past the
 * photographer's `unpaid_release_hours`, for every owner, with the service
 * role (src/lib/booking/releaseExpired.ts). Before this the release only ran
 * when the photographer opened the booking dashboard. Protected by CRON_SECRET.
 *
 * Then the Google Calendar events of freed slots are deleted, as reopenSlot
 * does (src/lib/booking/releaseEvents.ts). Google is advisory: its failures
 * go to Sentry and are retried next hour, they do not turn the run into 500.
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
    const released = await releaseExpiredBookings(admin)
    const events = await cleanupReleasedSlotEvents(admin)
    const summary = { ...released, ...events }
    console.log('booking-release:', JSON.stringify(summary))
    return NextResponse.json(summary, { status: summary.errors > 0 ? 500 : 200 })
  } catch (cause) {
    console.error('booking-release: read failed', cause)
    return NextResponse.json({ error: 'db_read_failed' }, { status: 500 })
  }
}

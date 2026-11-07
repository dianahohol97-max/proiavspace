import { NextResponse, type NextRequest } from 'next/server'
import { readSecret } from '@/lib/booking/secrets'
import { reportServerError } from '@/lib/sentry/server'
import { wfpIsPaid } from '@/lib/booking/wayforpay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * WayForPay serviceUrl callback. Same trust model as Monobank: the body only
 * points us at an orderReference (= slot id); the actual status is re-queried
 * from WayForPay with the photographer's merchant secret. Idempotent via the
 * status-guarded UPDATE.
 */
export async function POST(request: NextRequest) {
  // WFP may post JSON or a JSON string as form key — handle both.
  let payload: unknown = await request.json().catch(() => null)
  if (payload === null) {
    const text = await request.text().catch(() => '')
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }
  const orderReference =
    typeof payload === 'object' && payload !== null &&
    typeof (payload as Record<string, unknown>).orderReference === 'string'
      ? ((payload as Record<string, unknown>).orderReference as string)
      : null
  if (!orderReference) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { data: slot } = await admin
    .from('booking_slots')
    .select('id, owner_id, status')
    .eq('id', orderReference)
    .eq('payment_method', 'wfp')
    .single()

  if (slot && slot.status === 'booked') {
    const { data: settings } = await admin
      .from('booking_settings')
      .select('wfp_merchant, wfp_secret')
      .eq('user_id', slot.owner_id)
      .single()
    const wfpSecret = readSecret(settings?.wfp_secret, 'wfp_secret', (e) =>
      reportServerError(e, { area: 'booking.secrets' })
    )
    if (settings?.wfp_merchant && wfpSecret) {
      if (await wfpIsPaid(settings.wfp_merchant, wfpSecret, orderReference)) {
        await admin
          .from('booking_slots')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', slot.id)
          .eq('status', 'booked')
      }
    }
  }

  // WFP expects an accept acknowledgement.
  return NextResponse.json({ orderReference, status: 'accept', time: Math.floor(Date.now() / 1000) })
}

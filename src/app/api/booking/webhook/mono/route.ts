import { NextResponse, type NextRequest } from 'next/server'
import { readSecret } from '@/lib/booking/secrets'
import { reportServerError } from '@/lib/sentry/server'
import { monoIsPaid } from '@/lib/booking/monobank'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Monobank webhook. The body is UNTRUSTED input — we only take the invoiceId
 * from it, then re-query the real status from Monobank with the
 * photographer's own token. Only a genuine `success` flips booked -> paid,
 * and the guarded UPDATE makes it idempotent (a second delivery is a no-op).
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  const invoiceId =
    typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).invoiceId === 'string'
      ? ((body as Record<string, unknown>).invoiceId as string)
      : null
  if (!invoiceId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { data: slot } = await admin
    .from('booking_slots')
    .select('id, owner_id, status')
    .eq('invoice_id', invoiceId)
    .eq('payment_method', 'mono')
    .single()
  if (!slot) {
    return NextResponse.json({ ok: true }) // unknown invoice — acknowledge, do nothing
  }
  if (slot.status !== 'booked') {
    return NextResponse.json({ ok: true }) // already paid/canceled — idempotent
  }

  const { data: settings } = await admin
    .from('booking_settings')
    .select('mono_token')
    .eq('user_id', slot.owner_id)
    .single()
  const monoToken = readSecret(settings?.mono_token, 'mono_token', (e) =>
    reportServerError(e, { area: 'booking.secrets' })
  )
  if (!monoToken) {
    return NextResponse.json({ ok: true })
  }

  if (await monoIsPaid(monoToken, invoiceId)) {
    await admin
      .from('booking_slots')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', slot.id)
      .eq('status', 'booked')
  }

  return NextResponse.json({ ok: true })
}

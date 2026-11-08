import { NextResponse, type NextRequest } from 'next/server'
import { viewerCanSeeSites } from '@/lib/features/sites-server'
import { monoCreateInvoice } from '@/lib/booking/monobank'
import { wfpCreateInvoice } from '@/lib/booking/wayforpay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

interface PayBody {
  slotId: string
  bookingToken: string
  method: 'mono' | 'wfp'
  locale?: string
}

function isPayBody(value: unknown): value is PayBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.slotId === 'string' &&
    typeof v.bookingToken === 'string' &&
    (v.method === 'mono' || v.method === 'wfp') &&
    (v.locale === undefined || typeof v.locale === 'string')
  )
}

/**
 * Creates a payment invoice ON THE PHOTOGRAPHER's own credentials — money
 * goes directly to them, never through the platform. Authorized by the
 * booking token handed out at booking time; acquiring tokens are read
 * server-side only.
 */
export async function POST(request: NextRequest) {
  // Shelved (src/lib/features/sites.ts): 404 unless sites are on or it is the owner.
  if (!(await viewerCanSeeSites())) return new NextResponse('Not found', { status: 404 })
  const body: unknown = await request.json().catch(() => null)
  if (!isPayBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
  }

  const { data: slot } = await admin
    .from('booking_slots')
    .select('id, owner_id, status, booking_token, starts_at, price_uah')
    .eq('id', body.slotId)
    .single()
  if (!slot || slot.booking_token !== body.bookingToken || slot.status !== 'booked') {
    return NextResponse.json({ error: 'not_payable' }, { status: 403 })
  }
  if (Number(slot.price_uah) <= 0) {
    return NextResponse.json({ error: 'free_slot' }, { status: 400 })
  }

  const { data: settings } = await admin
    .from('booking_settings')
    .select('handle, mono_enabled, mono_token, wfp_enabled, wfp_merchant, wfp_secret')
    .eq('user_id', slot.owner_id)
    .single()
  if (!settings) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const locale = body.locale === 'en' ? 'en' : 'uk'
  const redirectUrl = `${appUrl}/${locale}/b/${settings.handle}?paid=1`
  const destination = 'Бронювання фотозйомки'

  try {
    if (body.method === 'mono') {
      if (!settings.mono_enabled || !settings.mono_token) {
        return NextResponse.json({ error: 'method_disabled' }, { status: 400 })
      }
      const invoice = await monoCreateInvoice(settings.mono_token, {
        amountUah: Number(slot.price_uah),
        reference: slot.id,
        destination,
        redirectUrl,
        webHookUrl: `${appUrl}/api/booking/webhook/mono`,
      })
      await admin
        .from('booking_slots')
        .update({ payment_method: 'mono', invoice_id: invoice.invoiceId })
        .eq('id', slot.id)
      return NextResponse.json({ url: invoice.pageUrl })
    }

    if (!settings.wfp_enabled || !settings.wfp_merchant || !settings.wfp_secret) {
      return NextResponse.json({ error: 'method_disabled' }, { status: 400 })
    }
    const invoice = await wfpCreateInvoice(settings.wfp_merchant, settings.wfp_secret, {
      amountUah: Number(slot.price_uah),
      orderReference: slot.id,
      productName: destination,
      domain: new URL(appUrl).host,
      serviceUrl: `${appUrl}/api/booking/webhook/wfp`,
    })
    await admin
      .from('booking_slots')
      .update({ payment_method: 'wfp', invoice_id: slot.id })
      .eq('id', slot.id)
    return NextResponse.json({ url: invoice.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invoice_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

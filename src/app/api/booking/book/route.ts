import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'
import { formatSlot } from '@/lib/booking/types'
import { insertCalendarEvent, refreshAccessToken } from '@/lib/booking/googleCalendar'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface BookBody {
  slotId: string
  name: string
  phone: string
  email: string
}

function isBookBody(value: unknown): value is BookBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.slotId === 'string' &&
    typeof v.name === 'string' &&
    typeof v.phone === 'string' &&
    typeof v.email === 'string'
  )
}

/**
 * Books a slot. All contact fields are required (validated here AND in the
 * RPC). The booking is race-safe: the security-definer RPC flips the slot
 * free -> booked atomically; a second simultaneous client gets 409.
 * The booking does not wait for payment.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  if (!isBookBody(body) || !body.name.trim() || !body.phone.trim() || !body.email.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: token, error } = await supabase.rpc('book_slot', {
    p_slot: body.slotId,
    p_name: body.name,
    p_phone: body.phone,
    p_email: body.email,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!token) {
    return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
  }

  // Notify the photographer immediately with the client's contacts.
  // Uses the service-role client (settings are owner-only under RLS);
  // silently skipped when email or the admin key is not configured.
  const admin = createSupabaseAdminClient()
  if (admin) {
    const { data: slot } = await admin
      .from('booking_slots')
      .select('owner_id, starts_at, duration_minutes, price_uah')
      .eq('id', body.slotId)
      .single()
    if (slot) {
      const { data: settings } = await admin
        .from('booking_settings')
        .select('notify_email, google_refresh_token, google_calendar_id')
        .eq('user_id', slot.owner_id)
        .single()
      if (settings?.notify_email) {
        await sendEmail({
          to: settings.notify_email,
          subject: `Нове бронювання: ${formatSlot(slot.starts_at)}`,
          text: [
            `Щойно заброньовано зйомку на ${formatSlot(slot.starts_at)} (${slot.duration_minutes} хв, ${slot.price_uah} грн).`,
            '',
            `Клієнт: ${body.name.trim()}`,
            `Телефон: ${body.phone.trim()}`,
            `Пошта: ${body.email.trim()}`,
            '',
            'Статус оплати дивіться в кабінеті.',
          ].join('\n'),
        })
      }

      // Google Calendar sync (best-effort): push the booking into the
      // photographer's calendar. A calendar failure must never fail the
      // booking, so everything here is wrapped and swallowed.
      if (settings?.google_refresh_token) {
        try {
          const accessToken = await refreshAccessToken(settings.google_refresh_token)
          const eventId = await insertCalendarEvent(
            accessToken,
            settings.google_calendar_id || 'primary',
            {
              startsAt: slot.starts_at,
              durationMinutes: slot.duration_minutes,
              summary: `Зйомка · ${body.name.trim()}`,
              description: [
                `Клієнт: ${body.name.trim()}`,
                `Телефон: ${body.phone.trim()}`,
                `Пошта: ${body.email.trim()}`,
                Number(slot.price_uah) > 0 ? `Вартість: ${slot.price_uah} грн` : null,
                'Бронювання через проЯв.',
              ]
                .filter(Boolean)
                .join('\n'),
            }
          )
          if (eventId) {
            await admin
              .from('booking_slots')
              .update({ google_event_id: eventId })
              .eq('id', body.slotId)
          }
        } catch {
          // calendar is optional; ignore and keep the booking
        }
      }
    }
  }

  return NextResponse.json({ bookingToken: token })
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { monoStatement } from '@/lib/booking/monoPersonal'
import { deleteCalendarEvent, refreshAccessToken } from '@/lib/booking/googleCalendar'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')
  return { supabase, user }
}

function str(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? '').trim()
  return value || null
}

export async function saveBookingSettings(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()

  const handle = str(formData, 'handle')?.toLowerCase() ?? null
  if (handle && !/^[a-z0-9][a-z0-9-]{2,31}$/.test(handle)) {
    throw new Error('Handle must be 3-32 chars: latin letters, digits, dashes')
  }

  const releaseHours = Number(formData.get('unpaid_release_hours') ?? 24)

  const { error } = await supabase.from('booking_settings').upsert(
    {
      user_id: user.id,
      enabled: formData.get('enabled') === 'on',
      handle,
      notify_email: str(formData, 'notify_email'),
      unpaid_release_hours:
        Number.isFinite(releaseHours) && releaseHours >= 0 && releaseHours <= 336
          ? Math.round(releaseHours)
          : 24,
      auto_confirm_manual: formData.get('auto_confirm_manual') === 'on',
      mono_personal_token: str(formData, 'mono_personal_token'),
      mono_personal_account: str(formData, 'mono_personal_account') ?? '0',
      mono_enabled: formData.get('mono_enabled') === 'on',
      mono_token: str(formData, 'mono_token'),
      wfp_enabled: formData.get('wfp_enabled') === 'on',
      wfp_merchant: str(formData, 'wfp_merchant'),
      wfp_secret: str(formData, 'wfp_secret'),
      manual_link_enabled: formData.get('manual_link_enabled') === 'on',
      manual_link: str(formData, 'manual_link'),
      card_enabled: formData.get('card_enabled') === 'on',
      card_details: str(formData, 'card_details'),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`Failed to save booking settings: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/booking`)
}

export async function addBookingSlot(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()

  const date = str(formData, 'date')
  const time = str(formData, 'time')
  const duration = Number(formData.get('duration') ?? 60)
  const price = Number(formData.get('price') ?? 0)
  if (!date || !time || !Number.isFinite(duration) || !Number.isFinite(price)) {
    throw new Error('Date, time, duration and price are required')
  }

  const { error } = await supabase.from('booking_slots').insert({
    owner_id: user.id,
    starts_at: `${date}T${time}:00`,
    duration_minutes: Math.round(duration),
    price_uah: price,
  })
  if (error) throw new Error(`Failed to add slot: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/booking`)
}

export async function deleteBookingSlot(locale: Locale, slotId: string): Promise<void> {
  const { supabase } = await requireUser()
  // RLS scopes the delete to the owner; only untouched slots can be removed.
  const { error } = await supabase
    .from('booking_slots')
    .delete()
    .eq('id', slotId)
    .eq('status', 'free')
  if (error) throw new Error(`Failed to delete slot: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

/** Manual payment confirmation — the photographer checked their bank. */
export async function markSlotPaid(locale: Locale, slotId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('booking_slots')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', slotId)
    .eq('status', 'booked')
  if (error) throw new Error(`Failed to mark paid: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

/**
 * Auto-confirm manual payments: reads the photographer's Monobank personal
 * statement (their own token, owner-scoped under RLS) and matches incoming
 * credits to booked slots by exact amount received after booking time.
 * Each statement entry confirms at most one slot (invoice_id = 'stmt:<id>').
 * Personal API allows 1 request/min — guarded by last_statement_check.
 */
export async function checkManualPayments(locale: Locale): Promise<void> {
  const { supabase, user } = await requireUser()

  const { data: settings } = await supabase
    .from('booking_settings')
    .select('auto_confirm_manual, mono_personal_token, mono_personal_account, last_statement_check')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!settings?.auto_confirm_manual || !settings.mono_personal_token) return

  if (
    settings.last_statement_check &&
    Date.now() - new Date(settings.last_statement_check).getTime() < 60_000
  ) {
    return // rate limit: Monobank personal API is 1 req/min
  }
  await supabase
    .from('booking_settings')
    .update({ last_statement_check: new Date().toISOString() })
    .eq('user_id', user.id)

  // Candidates: booked, priced, and NOT in an auto-provider flow.
  const { data: slots } = await supabase
    .from('booking_slots')
    .select('id, price_uah, booked_at')
    .eq('owner_id', user.id)
    .eq('status', 'booked')
    .is('payment_method', null)
    .gt('price_uah', 0)
    .order('booked_at')
  if (!slots || slots.length === 0) return

  const earliest = Math.min(...slots.map((s) => new Date(s.booked_at ?? 0).getTime()))
  const entries = await monoStatement(
    settings.mono_personal_token,
    settings.mono_personal_account ?? '0',
    Math.floor(earliest / 1000)
  )
  if (entries.length === 0) return

  // Entries already used to confirm a slot must not confirm another one.
  const { data: used } = await supabase
    .from('booking_slots')
    .select('invoice_id')
    .eq('owner_id', user.id)
    .like('invoice_id', 'stmt:%')
  const usedIds = new Set((used ?? []).map((r) => r.invoice_id as string))

  for (const slot of slots) {
    const bookedAt = new Date(slot.booked_at ?? 0).getTime() / 1000
    const match = entries.find(
      (entry) =>
        !usedIds.has(`stmt:${entry.id}`) &&
        entry.amount === Math.round(Number(slot.price_uah) * 100) &&
        entry.time >= bookedAt
    )
    if (!match) continue
    usedIds.add(`stmt:${match.id}`)
    await supabase
      .from('booking_slots')
      .update({
        status: 'paid',
        paid_at: new Date(match.time * 1000).toISOString(),
        payment_method: 'manual',
        invoice_id: `stmt:${match.id}`,
      })
      .eq('id', slot.id)
      .eq('status', 'booked')
  }

  revalidatePath(`/${locale}/dashboard/booking`)
}

/** Cancels a booking and reopens the time for other clients. */
export async function reopenSlot(locale: Locale, slotId: string): Promise<void> {
  const { supabase, user } = await requireUser()

  // Best-effort: remove the event we pushed to Google Calendar so a reopened
  // (freed) slot doesn't leave a ghost booking in the photographer's calendar.
  const { data: slot } = await supabase
    .from('booking_slots')
    .select('google_event_id')
    .eq('id', slotId)
    .maybeSingle()
  if (slot?.google_event_id) {
    const { data: settings } = await supabase
      .from('booking_settings')
      .select('google_refresh_token, google_calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (settings?.google_refresh_token) {
      try {
        const accessToken = await refreshAccessToken(settings.google_refresh_token)
        await deleteCalendarEvent(
          accessToken,
          settings.google_calendar_id || 'primary',
          slot.google_event_id
        )
      } catch {
        // calendar cleanup is optional; the slot is still reopened below
      }
    }
  }

  const { error } = await supabase
    .from('booking_slots')
    .update({
      status: 'free',
      client_name: null,
      client_phone: null,
      client_email: null,
      booking_token: null,
      payment_method: null,
      invoice_id: null,
      booked_at: null,
      paid_at: null,
      google_event_id: null,
    })
    .eq('id', slotId)
    .in('status', ['booked', 'paid'])
  if (error) throw new Error(`Failed to reopen slot: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

/** Disconnects Google Calendar — clears the stored refresh token and email. */
export async function disconnectGoogleCalendar(locale: Locale): Promise<void> {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('booking_settings')
    .update({ google_refresh_token: null, google_email: null })
    .eq('user_id', user.id)
  if (error) throw new Error(`Failed to disconnect Google Calendar: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

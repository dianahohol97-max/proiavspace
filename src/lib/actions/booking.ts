'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { monoStatement } from '@/lib/booking/monoPersonal'
import { deleteCalendarEvent, refreshAccessToken, revokeToken } from '@/lib/booking/googleCalendar'
import { forgetGoogleAccess } from '@/lib/booking/availability'
import {
  SECRET_FIELDS,
  buildSecretPatch,
  readSecret,
  type SecretField,
} from '@/lib/booking/secrets'
import { reportServerError } from '@/lib/sentry/server'
import { parseCalendarConfig, serializeCalendarConfig, MAX_BUSY_CALENDARS } from '@/lib/booking/calendarConfig'
import {
  DB_MAX_SLOT_MINUTES,
  MAX_SLOTS_PER_BATCH,
  generateSlots,
  parseTemplate,
  type TemplateError,
} from '@/lib/booking/slotTemplate'
import { DEFAULT_BOOKING_TIME_ZONE, addDays, parseDate, slotKey } from '@/lib/booking/time'
import { insertSlotsSkippingDuplicates } from '@/lib/booking/slotInsert'
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

  // Secrets: encrypted at rest; an empty field keeps the stored value, a
  // ticked «стерти» removes it. The form never receives the stored values.
  const { data: current } = await supabase
    .from('booking_settings')
    .select(SECRET_FIELDS.join(', '))
    .eq('user_id', user.id)
    .maybeSingle()
  const { patch: secretPatch, keyMissing } = buildSecretPatch({
    submitted: {
      mono_token: str(formData, 'mono_token'),
      wfp_secret: str(formData, 'wfp_secret'),
      mono_personal_token: str(formData, 'mono_personal_token'),
    },
    clear: SECRET_FIELDS.filter((f) => formData.get(`${f}_clear`) === 'on'),
    existing: (current ?? {}) as Partial<Record<SecretField, string | null>>,
  })

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
      mono_personal_account: str(formData, 'mono_personal_account') ?? '0',
      mono_enabled: formData.get('mono_enabled') === 'on',
      wfp_enabled: formData.get('wfp_enabled') === 'on',
      wfp_merchant: str(formData, 'wfp_merchant'),
      manual_link_enabled: formData.get('manual_link_enabled') === 'on',
      manual_link: str(formData, 'manual_link'),
      card_enabled: formData.get('card_enabled') === 'on',
      card_details: str(formData, 'card_details'),
      ...secretPatch,
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`Failed to save booking settings: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/booking`)
  // Everything else is saved; the new secrets were not (no encryption key).
  if (keyMissing) redirect(`/${locale}/dashboard/booking?settings=secrets_key`)
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

  // A slot with this start may already exist (double click, second tab):
  // that is "already there", not an error.
  const { error } = await insertSlotsSkippingDuplicates(supabase, [
    {
      owner_id: user.id,
      starts_at: slotKey(`${date}T${time}`),
      duration_minutes: Math.round(duration),
      price_uah: price,
    },
  ])
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
  const personalToken = readSecret(settings?.mono_personal_token, 'mono_personal_token', (e) =>
    reportServerError(e, { area: 'booking.secrets' })
  )
  if (!settings?.auto_confirm_manual || !personalToken) return

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
    personalToken,
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
    const refreshToken = readSecret(settings?.google_refresh_token, 'google_refresh_token', (e) =>
      reportServerError(e, { area: 'booking.secrets' })
    )
    if (settings && refreshToken) {
      try {
        const accessToken = await refreshAccessToken(refreshToken)
        await deleteCalendarEvent(
          accessToken,
          parseCalendarConfig(settings.google_calendar_id).write,
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

/**
 * Disconnects Google Calendar: revokes the grant at Google, then clears the
 * stored refresh token and email. If Google does not answer, the token is
 * still deleted here (we can no longer use it) and the failure goes to Sentry.
 */
export async function disconnectGoogleCalendar(locale: Locale): Promise<void> {
  const { supabase, user } = await requireUser()
  const { data: stored } = await supabase
    .from('booking_settings')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()
  const token = readSecret(stored?.google_refresh_token, 'google_refresh_token', (e) =>
    reportServerError(e, { area: 'booking.secrets' })
  )
  if (token) {
    try {
      await revokeToken(token)
    } catch (revokeError) {
      reportServerError(revokeError, { area: 'booking.google.revoke' })
    }
  }
  forgetGoogleAccess(user.id)
  const { error } = await supabase
    .from('booking_settings')
    .update({ google_refresh_token: null, google_email: null })
    .eq('user_id', user.id)
  if (error) throw new Error(`Failed to disconnect Google Calendar: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

export interface TemplateActionResult {
  ok: boolean
  created: number
  duplicates: number
  past: number
  nonexistent: number
  errors: (TemplateError | 'needs_migration' | 'db_error')[]
}

/**
 * Creates slots from a schedule template in ONE insert. The generator is the
 * same one the form previews with; here it runs against the owner's real
 * slots in the period, so a slot with the same owner + starts_at is never
 * created twice. RLS ("booking_slots: owner all") keeps it owner-scoped.
 */
export async function createSlotsFromTemplate(
  locale: Locale,
  payload: unknown
): Promise<TemplateActionResult> {
  const { supabase, user } = await requireUser()
  const empty = { created: 0, duplicates: 0, past: 0, nonexistent: 0 }
  const template = parseTemplate(payload)
  if (!template) return { ok: false, ...empty, errors: ['bad_period'] }
  if (!parseDate(template.from) || !parseDate(template.to)) {
    return { ok: false, ...empty, errors: ['bad_period'] }
  }

  // Existing starts in the period (+1 day: an all-day slot never crosses it,
  // but the bound must include the whole last day).
  const { data: existingRows, error: readError } = await supabase
    .from('booking_slots')
    .select('starts_at')
    .eq('owner_id', user.id)
    .gte('starts_at', `${template.from}T00:00:00`)
    .lt('starts_at', `${addDays(template.to, 1)}T00:00:00`)
  if (readError) return { ok: false, ...empty, errors: ['db_error'] }

  const result = generateSlots(template, {
    existing: (existingRows ?? []).map((r) => String(r.starts_at)),
    timeZone: DEFAULT_BOOKING_TIME_ZONE,
  })
  const counts = {
    duplicates: result.duplicates,
    past: result.past,
    nonexistent: result.nonexistent,
  }
  if (result.errors.length > 0) return { ok: false, created: 0, ...counts, errors: result.errors }
  if (result.slots.length === 0) return { ok: true, created: 0, ...counts, errors: [] }

  // Races with another tab are caught by the unique index (0058) and come
  // back as duplicates, not as an error.
  const inserted = await insertSlotsSkippingDuplicates(
    supabase,
    result.slots.map((slot) => ({ owner_id: user.id, ...slot }))
  )
  const error = inserted.error
  if (error) {
    // 23514 = CHECK violation: slots longer than 8 h until migration 0058.
    const tooLong = result.slots.some((s) => s.duration_minutes > DB_MAX_SLOT_MINUTES)
    return {
      ok: false,
      created: 0,
      ...counts,
      errors: [error.code === '23514' && tooLong ? 'needs_migration' : 'db_error'],
    }
  }

  revalidatePath(`/${locale}/dashboard/booking`)
  return {
    ok: true,
    created: inserted.created,
    ...counts,
    duplicates: counts.duplicates + inserted.duplicates,
    errors: [],
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Bulk delete of FREE slots (booked/paid ones are never touched). */
export async function deleteBookingSlots(
  locale: Locale,
  slotIds: string[]
): Promise<{ deleted: number }> {
  const { supabase, user } = await requireUser()
  const ids = [...new Set((Array.isArray(slotIds) ? slotIds : []).filter((id) => typeof id === 'string' && UUID.test(id)))]
  if (ids.length === 0) return { deleted: 0 }
  if (ids.length > MAX_SLOTS_PER_BATCH) throw new Error('Too many slots in one request')
  const { data, error } = await supabase
    .from('booking_slots')
    .delete()
    .eq('owner_id', user.id)
    .eq('status', 'free')
    .in('id', ids)
    .select('id')
  if (error) throw new Error(`Failed to delete slots: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
  return { deleted: data?.length ?? 0 }
}

/** "Close the day": removes every FREE slot starting on that date. */
export async function closeBookingDay(locale: Locale, date: string): Promise<{ deleted: number }> {
  const { supabase, user } = await requireUser()
  if (!parseDate(date)) throw new Error('Bad date')
  const { data, error } = await supabase
    .from('booking_slots')
    .delete()
    .eq('owner_id', user.id)
    .eq('status', 'free')
    .gte('starts_at', `${date}T00:00:00`)
    .lt('starts_at', `${addDays(date, 1)}T00:00:00`)
    .select('id')
  if (error) throw new Error(`Failed to close day: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
  return { deleted: data?.length ?? 0 }
}

/** Which Google calendars count as busy time (stored in google_calendar_id, see calendarConfig). */
export async function saveBusyCalendars(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()
  const { data: settings } = await supabase
    .from('booking_settings')
    .select('google_calendar_id, google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!settings?.google_refresh_token) return
  const config = parseCalendarConfig(settings.google_calendar_id)
  if (!config.busyScopes) return // needs a reconnect first
  const busy = formData
    .getAll('busy_calendar')
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0 && v.length <= 255)
    .slice(0, MAX_BUSY_CALENDARS)
  // Legacy plaintext refresh token → encrypted on this save.
  const { patch: upgrade } = buildSecretPatch({
    submitted: {},
    clear: [],
    existing: { google_refresh_token: settings.google_refresh_token },
  })
  const { error } = await supabase
    .from('booking_settings')
    .update({ google_calendar_id: serializeCalendarConfig({ write: config.write, busy }), ...upgrade })
    .eq('user_id', user.id)
  if (error) throw new Error(`Failed to save calendars: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/booking`)
}

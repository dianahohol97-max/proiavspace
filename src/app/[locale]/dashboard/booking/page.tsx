import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  addBookingSlot,
  checkManualPayments,
  closeBookingDay,
  createSlotsFromTemplate,
  deleteBookingSlots,
  disconnectGoogleCalendar,
  markSlotPaid,
  reopenSlot,
  saveBookingSettings,
  saveBusyCalendars,
} from '@/lib/actions/booking'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import {
  isGoogleConfigured,
  listCalendars,
  refreshAccessToken,
  type GoogleCalendarInfo,
} from '@/lib/booking/googleCalendar'
import { parseCalendarConfig } from '@/lib/booking/calendarConfig'
import { DEFAULT_BOOKING_TIME_ZONE, addDays, todayIn } from '@/lib/booking/time'
import { reportServerError } from '@/lib/sentry/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { BookingSettings } from '@/lib/booking/types'
import { maskSecret, readSecret, type SecretField } from '@/lib/booking/secrets'
import { SlotList, type DashboardSlot } from '@/components/booking/SlotList'
import { SlotTemplateForm } from '@/components/booking/SlotTemplateForm'

export const dynamic = 'force-dynamic'

const inputClass = 'border border-line bg-transparent px-3 py-2 outline-none focus:border-fg'

export default async function BookingDashboardPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { google?: string; settings?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Lazily free bookings whose payment window expired (same function the
  // public page uses), so the dashboard always shows current reality.
  await supabase.rpc('release_expired_slots', { p_owner: user.id })

  // Upcoming slots plus the last 60 days (recent bookings stay visible for
  // payment follow-up without loading years of history).
  const today = todayIn(DEFAULT_BOOKING_TIME_ZONE)
  const [{ data: settingsRow }, { data: slotRows }] = await Promise.all([
    supabase
      .from('booking_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<BookingSettings>(),
    supabase
      .from('booking_slots')
      .select('id, starts_at, duration_minutes, price_uah, status, client_name, client_phone, client_email')
      .eq('owner_id', user.id)
      .gte('starts_at', `${addDays(today, -60)}T00:00:00`)
      .order('starts_at')
      .limit(3000)
      .returns<DashboardSlot[]>(),
  ])
  const slots = slotRows ?? []

  // Secrets never reach the browser: they are split off right here, decrypted
  // only to compute «••••1234» masks (and the Google token to list calendars),
  // and the rest of the page works with `settings` that has none of them.
  const onSecretError = (e: unknown) => reportServerError(e, { area: 'booking.secrets' })
  const {
    mono_token: storedMonoToken,
    wfp_secret: storedWfpSecret,
    mono_personal_token: storedPersonalToken,
    google_refresh_token: storedGoogleToken,
    ...settingsSafe
  } = settingsRow ?? ({} as Partial<BookingSettings>)
  const settings = settingsRow ? (settingsSafe as Omit<BookingSettings, SecretField>) : null
  const secretMask: Record<'mono_token' | 'wfp_secret' | 'mono_personal_token', string | null> = {
    mono_token: storedMonoToken ? maskSecret(readSecret(storedMonoToken, 'mono_token', onSecretError)) ?? '••••' : null,
    wfp_secret: storedWfpSecret ? maskSecret(readSecret(storedWfpSecret, 'wfp_secret', onSecretError)) ?? '••••' : null,
    mono_personal_token: storedPersonalToken
      ? maskSecret(readSecret(storedPersonalToken, 'mono_personal_token', onSecretError)) ?? '••••'
      : null,
  }

  const saveAction = saveBookingSettings.bind(null, locale)
  const addAction = addBookingSlot.bind(null, locale)

  // Google: which calendars count as busy. Accounts connected before the
  // free/busy scope existed are asked to reconnect.
  const calendarConfig = parseCalendarConfig(settings?.google_calendar_id)
  const googleConnected = !!storedGoogleToken
  const needsReconnect = googleConnected && !calendarConfig.busyScopes
  let calendars: GoogleCalendarInfo[] | null = null
  const googleToken = googleConnected ? readSecret(storedGoogleToken, 'google_refresh_token', onSecretError) : null
  if (googleToken && !needsReconnect && isGoogleConfigured()) {
    try {
      calendars = await listCalendars(await refreshAccessToken(googleToken))
    } catch (error) {
      reportServerError(error, { area: 'booking.calendarList' })
      calendars = null
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicUrl =
    settings?.enabled && settings.handle ? `${appUrl}/${locale}/b/${settings.handle}` : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>
      <h1 className="mt-6 font-display text-3xl sm:text-4xl">{dict.booking.title}</h1>

      {publicUrl && (
        <p className="mt-4 break-all text-sm text-muted">
          {dict.booking.publicLink}: {publicUrl}
        </p>
      )}

      {/* -------- schedule -------- */}
      <section className="mt-10" aria-labelledby="schedule-title">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="schedule-title" className="font-display text-2xl">{dict.booking.scheduleTitle}</h2>
          {settings?.auto_confirm_manual && storedPersonalToken && (
            <form action={checkManualPayments.bind(null, locale)}>
              <button type="submit" className="text-sm underline hover:text-accent">
                {dict.booking.checkPayments}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 border border-line p-4 sm:p-6">
          <h3 className="font-display text-xl">{dict.booking.templateTitle}</h3>
          <p className="mb-5 mt-1 text-xs leading-relaxed text-muted">{dict.booking.templateHint}</p>
          <SlotTemplateForm
            today={today}
            existingStarts={slots.map((s) => s.starts_at)}
            labels={dict.booking}
            onCreate={createSlotsFromTemplate.bind(null, locale)}
          />
        </div>

        <details className="mt-4 border border-line p-4 sm:px-6">
          <summary className="cursor-pointer text-sm">{dict.booking.singleTitle}</summary>
          <form action={addAction} className="mt-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <label className="flex flex-col gap-1 text-xs text-muted">
              {dict.booking.dateLabel}
              <input name="date" type="date" required min={today} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {dict.booking.timeLabel}
              <input name="time" type="time" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {dict.booking.durationLabel}
              <input name="duration" type="number" min={15} max={480} step={15} defaultValue={60} className={`${inputClass} sm:w-24`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {dict.booking.priceLabel}
              <input name="price" type="number" min={0} step={50} defaultValue={0} className={`${inputClass} sm:w-28`} />
            </label>
            <button
              type="submit"
              className="col-span-2 border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
            >
              {dict.booking.addSlot}
            </button>
          </form>
        </details>

        <h3 className="mt-10 font-display text-xl">{dict.booking.slotsTitle}</h3>
        <p className="mb-4 mt-1 max-w-xl text-xs leading-relaxed text-muted">{dict.booking.bookedNote}</p>
        <SlotList
          slots={slots}
          lang={locale === 'uk' ? 'uk-UA' : locale}
          labels={dict.booking}
          onDeleteMany={deleteBookingSlots.bind(null, locale)}
          onCloseDay={closeBookingDay.bind(null, locale)}
          onMarkPaid={markSlotPaid.bind(null, locale)}
          onReopen={reopenSlot.bind(null, locale)}
        />
      </section>

      {/* -------- Google Calendar sync -------- */}
      <section className="mt-14 border border-line p-4 sm:p-6">
        <h2 className="font-display text-2xl">{dict.booking.googleTitle}</h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          {dict.booking.googleHint}
        </p>

        {searchParams.google === 'connected' && (
          <p className="mt-4 border border-fg px-4 py-2 text-sm">{dict.booking.googleStatusOk}</p>
        )}
        {searchParams.google === 'secrets_key' && (
          <p className="mt-4 border border-accent px-4 py-2 text-sm text-accent">
            {dict.booking.secretsKeyMissing}
          </p>
        )}
        {searchParams.google === 'error' && (
          <p className="mt-4 border border-accent px-4 py-2 text-sm text-accent">
            {dict.booking.googleStatusError}
          </p>
        )}

        {!isGoogleConfigured() ? (
          <p className="mt-5 text-sm text-muted">{dict.booking.googleUnconfigured}</p>
        ) : settings && googleConnected ? (
          <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="text-sm">
              {dict.booking.googleConnected}
              {settings.google_email ? ` · ${settings.google_email}` : ''}
            </span>
            <form action={disconnectGoogleCalendar.bind(null, locale)}>
              <button type="submit" className="text-sm text-muted underline hover:text-accent">
                {dict.booking.googleDisconnect}
              </button>
            </form>
          </div>

          {needsReconnect ? (
            <div className="mt-5 border border-accent p-4" data-testid="google-reconnect">
              <p className="text-sm font-medium">{dict.booking.googleReconnect}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{dict.booking.googleReconnectHint}</p>
              <a
                href={`/api/booking/google/connect?locale=${locale}`}
                className="mt-3 inline-block border border-fg px-5 py-2 text-xs uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
              >
                {dict.booking.googleReconnectButton}
              </a>
            </div>
          ) : (
            <form action={saveBusyCalendars.bind(null, locale)} className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-medium">{dict.booking.googleBusyTitle}</h3>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{dict.booking.googleBusyHint}</p>
              {calendars === null ? (
                <p className="mt-3 text-sm text-accent">{dict.booking.googleBusyListError}</p>
              ) : (
                <>
                  <ul className="mt-3 flex flex-col gap-2">
                    {calendars.map((cal) => (
                      <li key={cal.id}>
                        <label className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            name="busy_calendar"
                            value={cal.id}
                            defaultChecked={
                              calendarConfig.busy.includes(cal.id) ||
                              (cal.primary && calendarConfig.busy.includes('primary'))
                            }
                            className="h-4 w-4"
                          />
                          <span className="min-w-0 truncate">
                            {cal.summary}
                            {cal.primary && <span className="text-muted"> · {dict.booking.googlePrimary}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {calendarConfig.busy.length === 0 && (
                    <p className="mt-3 text-xs text-muted">{dict.booking.googleBusyNone}</p>
                  )}
                  <button type="submit" className="mt-4 text-sm underline hover:text-accent">
                    {dict.booking.googleBusySave}
                  </button>
                </>
              )}
            </form>
          )}
          </>
        ) : (
          <a
            href={`/api/booking/google/connect?locale=${locale}`}
            className="mt-5 inline-block border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.booking.googleConnect}
          </a>
        )}
      </section>

      {/* -------- settings -------- */}
      <details
        className="group mt-10 border border-line"
        open={!settings?.enabled || searchParams.settings === 'secrets_key'}
      >
        <summary className="cursor-pointer px-4 py-4 font-display text-xl sm:px-6">{dict.booking.settingsTitle}</summary>
      <form action={saveAction} className="flex flex-col gap-5 border-t border-line p-4 sm:p-6">
        {searchParams.settings === 'secrets_key' && (
          <p role="alert" className="border border-accent px-4 py-2 text-sm text-accent">
            {dict.booking.secretsKeyMissing}
          </p>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={settings?.enabled ?? false} />
          {dict.booking.enabled}
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted" htmlFor="handle">
            {dict.booking.handleLabel}
          </label>
          <input
            id="handle"
            name="handle"
            defaultValue={settings?.handle ?? ''}
            placeholder="olena-romaniuk"
            className={inputClass}
          />
          <p className="text-xs text-muted">{dict.booking.handleHint}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted" htmlFor="notify_email">
            {dict.booking.notifyEmailLabel}
          </label>
          <input
            id="notify_email"
            name="notify_email"
            type="email"
            defaultValue={settings?.notify_email ?? ''}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted" htmlFor="unpaid_release_hours">
            {dict.booking.releaseHoursLabel}
          </label>
          <input
            id="unpaid_release_hours"
            name="unpaid_release_hours"
            type="number"
            min={0}
            max={336}
            defaultValue={settings?.unpaid_release_hours ?? 24}
            className={`${inputClass} w-28`}
          />
          <p className="text-xs text-muted">{dict.booking.releaseHoursHint}</p>
        </div>

        <h2 className="mt-2 font-display text-2xl">{dict.booking.payTitle}</h2>
        <p className="text-xs leading-relaxed text-muted">{dict.booking.payHint}</p>

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="mono_enabled" defaultChecked={settings?.mono_enabled} />
            {dict.booking.monoLabel}
          </label>
          <SecretField
            name="mono_token"
            mask={secretMask.mono_token}
            placeholder={dict.booking.monoTokenLabel}
            labels={dict.booking}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="wfp_enabled" defaultChecked={settings?.wfp_enabled} />
            {dict.booking.wfpLabel}
          </label>
          <input
            name="wfp_merchant"
            defaultValue={settings?.wfp_merchant ?? ''}
            placeholder={dict.booking.wfpMerchantLabel}
            className={inputClass}
          />
          <SecretField
            name="wfp_secret"
            mask={secretMask.wfp_secret}
            placeholder={dict.booking.wfpSecretLabel}
            labels={dict.booking}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="manual_link_enabled"
              defaultChecked={settings?.manual_link_enabled}
            />
            {dict.booking.manualLabel}
          </label>
          <input
            name="manual_link"
            defaultValue={settings?.manual_link ?? ''}
            placeholder="https://send.monobank.ua/jar/..."
            className={inputClass}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="card_enabled" defaultChecked={settings?.card_enabled} />
            {dict.booking.cardLabel}
          </label>
          <textarea
            name="card_details"
            defaultValue={settings?.card_details ?? ''}
            placeholder={dict.booking.cardDetailsLabel}
            rows={2}
            className={inputClass}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="auto_confirm_manual"
              defaultChecked={settings?.auto_confirm_manual}
            />
            {dict.booking.autoConfirmLabel}
          </label>
          <p className="text-xs leading-relaxed text-muted">{dict.booking.autoConfirmHint}</p>
          <SecretField
            name="mono_personal_token"
            mask={secretMask.mono_personal_token}
            placeholder={dict.booking.personalTokenLabel}
            labels={dict.booking}
          />
          <input
            name="mono_personal_account"
            defaultValue={settings?.mono_personal_account ?? '0'}
            placeholder={dict.booking.personalAccountLabel}
            className={inputClass}
          />
        </fieldset>

        <button
          type="submit"
          className="mt-2 self-start border border-fg px-8 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
        >
          {dict.booking.save}
        </button>
      </form>
      </details>


    </main>
  )
}

/**
 * A stored secret is shown only as «••••1234». The input starts EMPTY: left
 * empty it keeps the stored value; typed into, it replaces it; «стерти»
 * removes it.
 */
function SecretField({
  name,
  mask,
  placeholder,
  labels,
}: {
  name: string
  mask: string | null
  placeholder: string
  labels: { secretSaved: string; secretReplace: string; secretClear: string }
}) {
  return (
    <div className="flex flex-col gap-1.5" data-testid={`secret-${name}`}>
      {mask && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            {labels.secretSaved}: <span className="font-mono tracking-wider">{mask}</span>
          </span>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name={`${name}_clear`} />
            {labels.secretClear}
          </label>
        </div>
      )}
      <input
        name={name}
        type="password"
        autoComplete="off"
        defaultValue=""
        placeholder={mask ? labels.secretReplace : placeholder}
        aria-label={placeholder}
        className={inputClass}
      />
    </div>
  )
}

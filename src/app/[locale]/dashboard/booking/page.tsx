import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  addBookingSlot,
  checkManualPayments,
  deleteBookingSlot,
  disconnectGoogleCalendar,
  markSlotPaid,
  reopenSlot,
  saveBookingSettings,
} from '@/lib/actions/booking'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { isGoogleConfigured } from '@/lib/booking/googleCalendar'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatSlot, type BookingSettings, type BookingSlot } from '@/lib/booking/types'

export const dynamic = 'force-dynamic'

const inputClass = 'border border-line bg-transparent px-3 py-2 outline-none focus:border-fg'

export default async function BookingDashboardPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { google?: string }
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

  const [{ data: settings }, { data: slots }] = await Promise.all([
    supabase
      .from('booking_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<BookingSettings>(),
    supabase
      .from('booking_slots')
      .select('*')
      .eq('owner_id', user.id)
      .order('starts_at')
      .returns<BookingSlot[]>(),
  ])

  const saveAction = saveBookingSettings.bind(null, locale)
  const addAction = addBookingSlot.bind(null, locale)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicUrl =
    settings?.enabled && settings.handle ? `${appUrl}/${locale}/b/${settings.handle}` : null

  const statusLabel: Record<BookingSlot['status'], string> = {
    free: dict.booking.statusFree,
    booked: dict.booking.statusBooked,
    paid: dict.booking.statusPaid,
    canceled: dict.booking.statusCanceled,
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted hover:text-fg">
        ← {dict.dashboard.title}
      </Link>
      <h1 className="mt-6 font-display text-4xl">{dict.booking.title}</h1>

      {publicUrl && (
        <p className="mt-4 break-all text-sm text-muted">
          {dict.booking.publicLink}: {publicUrl}
        </p>
      )}

      {/* -------- settings -------- */}
      <form action={saveAction} className="mt-10 flex flex-col gap-5 border border-line p-6">
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
          <input
            name="mono_token"
            defaultValue={settings?.mono_token ?? ''}
            placeholder={dict.booking.monoTokenLabel}
            className={inputClass}
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
          <input
            name="wfp_secret"
            defaultValue={settings?.wfp_secret ?? ''}
            placeholder={dict.booking.wfpSecretLabel}
            className={inputClass}
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
          <input
            name="mono_personal_token"
            defaultValue={settings?.mono_personal_token ?? ''}
            placeholder={dict.booking.personalTokenLabel}
            className={inputClass}
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

      {/* -------- Google Calendar sync -------- */}
      <section className="mt-10 border border-line p-6">
        <h2 className="font-display text-2xl">{dict.booking.googleTitle}</h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          {dict.booking.googleHint}
        </p>

        {searchParams.google === 'connected' && (
          <p className="mt-4 border border-fg px-4 py-2 text-sm">{dict.booking.googleStatusOk}</p>
        )}
        {searchParams.google === 'error' && (
          <p className="mt-4 border border-accent px-4 py-2 text-sm text-accent">
            {dict.booking.googleStatusError}
          </p>
        )}

        {!isGoogleConfigured() ? (
          <p className="mt-5 text-sm text-muted">{dict.booking.googleUnconfigured}</p>
        ) : settings?.google_refresh_token ? (
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
        ) : (
          <a
            href={`/api/booking/google/connect?locale=${locale}`}
            className="mt-5 inline-block border border-fg px-6 py-3 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.booking.googleConnect}
          </a>
        )}
      </section>

      {/* -------- slots -------- */}
      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl">{dict.booking.slotsTitle}</h2>
          {settings?.auto_confirm_manual && settings.mono_personal_token && (
            <form action={checkManualPayments.bind(null, locale)}>
              <button type="submit" className="text-sm underline hover:text-accent">
                {dict.booking.checkPayments}
              </button>
            </form>
          )}
        </div>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          {dict.booking.bookedNote}
        </p>

        <form action={addAction} className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="date">{dict.booking.dateLabel}</label>
            <input id="date" name="date" type="date" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="time">{dict.booking.timeLabel}</label>
            <input id="time" name="time" type="time" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="duration">{dict.booking.durationLabel}</label>
            <input id="duration" name="duration" type="number" min={15} max={480} step={15} defaultValue={60} className={`${inputClass} w-24`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="price">{dict.booking.priceLabel}</label>
            <input id="price" name="price" type="number" min={0} step={50} defaultValue={0} className={`${inputClass} w-28`} />
          </div>
          <button
            type="submit"
            className="border border-fg px-6 py-2 text-sm uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            {dict.booking.addSlot}
          </button>
        </form>

        {!slots || slots.length === 0 ? (
          <p className="mt-8 max-w-xl leading-relaxed text-muted">{dict.booking.noSlots}</p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-t border-line">
            {slots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <span className="w-40 font-display text-lg">{formatSlot(slot.starts_at)}</span>
                <span className="text-sm text-muted">
                  {slot.duration_minutes} хв · {Number(slot.price_uah)} грн
                </span>
                <span
                  className={`px-2 py-0.5 text-xs uppercase tracking-widest ${
                    slot.status === 'paid'
                      ? 'bg-fg text-bg'
                      : slot.status === 'booked'
                        ? 'border border-fg'
                        : 'border border-line text-muted'
                  }`}
                >
                  {statusLabel[slot.status]}
                </span>
                {slot.client_name && (
                  <span className="text-sm text-muted">
                    {slot.client_name} · {slot.client_phone} · {slot.client_email}
                  </span>
                )}
                <span className="ml-auto flex gap-4">
                  {slot.status === 'booked' && (
                    <form action={markSlotPaid.bind(null, locale, slot.id)}>
                      <button type="submit" className="text-sm underline hover:text-accent">
                        {dict.booking.markPaid}
                      </button>
                    </form>
                  )}
                  {(slot.status === 'booked' || slot.status === 'paid') && (
                    <form action={reopenSlot.bind(null, locale, slot.id)}>
                      <button type="submit" className="text-sm text-muted underline hover:text-fg">
                        {dict.booking.reopen}
                      </button>
                    </form>
                  )}
                  {slot.status === 'free' && (
                    <form action={deleteBookingSlot.bind(null, locale, slot.id)}>
                      <button type="submit" className="text-sm text-muted underline hover:text-accent">
                        {dict.booking.deleteSlot}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

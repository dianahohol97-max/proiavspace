import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BookingWidget, type PublicSlot } from '@/components/BookingWidget'
import { hideBusySlots } from '@/lib/booking/availability'
import { LangPicker } from '@/components/LangPicker'

export const dynamic = 'force-dynamic'

/** Booking pages are shared by direct link; keep them out of indexes. */
export const metadata = {
  robots: { index: false, follow: false },
}

interface BookingProfile {
  display_name: string | null
  logo_key: string | null
  has_mono: boolean
  has_wfp: boolean
  manual_link: string | null
  card_details: string | null
}

/**
 * Public booking page. Reads go through security-definer RPCs only —
 * acquiring tokens are not part of any result set here. Like galleries,
 * the page carries the photographer's identity, not the platform's.
 */
export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: { locale: string; handle: string }
  searchParams: { paid?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const [{ data: profileData }, { data: slotsData }] = await Promise.all([
    supabase.rpc('get_booking_profile', { p_handle: params.handle }),
    supabase.rpc('get_free_slots', { p_handle: params.handle }),
  ])

  const profile = (profileData as BookingProfile[] | null)?.[0] ?? null
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 text-center">
        <p className="leading-relaxed text-muted">{dict.publicBooking.notFound}</p>
      </main>
    )
  }

  // Google busy time (cached a few minutes per photographer) hides slots that
  // collide with the photographer's own calendar; best-effort, never blocks.
  const slots = await hideBusySlots(params.handle, (slotsData as PublicSlot[] | null) ?? [])
  const logoUrl = profile.logo_key
    ? await getStorage().getSignedReadUrl(profile.logo_key, { expiresInSeconds: 60 * 60 })
    : null

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 flex justify-end">
        <LangPicker current={locale} />
      </div>
      <header className="text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={profile.display_name ?? ''} className="mx-auto mb-6 max-h-14 w-auto" />
        ) : (
          profile.display_name && (
            <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted">
              {profile.display_name}
            </p>
          )
        )}
        <h1 className="font-display text-4xl">{dict.publicBooking.chooseSlot}</h1>
        {searchParams.paid === '1' && (
          <p className="mt-4 inline-block border border-fg px-4 py-2 text-sm">
            {dict.publicBooking.paidBadge}
          </p>
        )}
      </header>

      <div className="mt-12">
        <BookingWidget
          handle={params.handle}
          locale={locale}
          slots={slots}
          methods={{
            mono: profile.has_mono,
            wfp: profile.has_wfp,
            manualLink: profile.manual_link,
            cardDetails: profile.card_details,
          }}
          labels={{
            noSlots: dict.publicBooking.noSlots,
            minutes: dict.publicBooking.minutes,
            free: dict.publicBooking.free,
            nameLabel: dict.publicBooking.nameLabel,
            phoneLabel: dict.publicBooking.phoneLabel,
            emailLabel: dict.publicBooking.emailLabel,
            bookButton: dict.publicBooking.bookButton,
            booking: dict.publicBooking.booking,
            slotTaken: dict.publicBooking.slotTaken,
            slotUnavailable: dict.publicBooking.slotUnavailable,
            bookedTitle: dict.publicBooking.bookedTitle,
            bookedText: dict.publicBooking.bookedText,
            payMono: dict.publicBooking.payMono,
            payWfp: dict.publicBooking.payWfp,
            payManual: dict.publicBooking.payManual,
            payCard: dict.publicBooking.payCard,
            payRedirect: dict.publicBooking.payRedirect,
            payError: dict.publicBooking.payError,
          }}
        />
      </div>
    </main>
  )
}

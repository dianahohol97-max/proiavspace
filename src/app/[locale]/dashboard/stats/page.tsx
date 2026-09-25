import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { setAmbassador, processWithdrawal } from '@/lib/actions/referrals'
import { getDictionary } from '@/lib/i18n'
import { isLocale, type Locale } from '@/lib/i18n/config'
import {
  GALLERY_PLANS,
  SITE_PLANS,
  type GalleryPlanId,
  type SitePlanId,
} from '@/lib/plans'
import { IMPORT_PROMO } from '@/lib/promo'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Owner-only page: never index it (the locale layout defaults to index/follow).
export const metadata = {
  robots: { index: false, follow: false },
}

const GB = 1024 * 1024 * 1024

function formatGb(bytes: number): string {
  const gb = bytes / GB
  return gb >= 1 ? `${gb.toFixed(1)} ГБ` : `${Math.max(Math.round(bytes / (1024 * 1024)), 0)} МБ`
}

interface ProfileRow {
  user_id: string
  display_name: string | null
  plan: string
  site_plan: string
  storage_used_bytes: number | null
  created_at: string
  is_ambassador: boolean | null
}
interface WithdrawalRow {
  id: string
  user_id: string
  amount_kop: number
  details: string
  created_at: string
}
interface GalleryRow {
  owner_id: string
  is_published: boolean
  expires_at: string | null
  has_password: boolean | null
}
interface PaymentRow {
  status: string
  amount: number | string
}
interface BookingRow {
  status: string
  price_uah: number | string
  booked_at: string | null
  paid_at: string | null
}
interface SubRow {
  product: string
  plan: string
  period: string
  status: string
}

/**
 * Founder-only platform stats: how many photographers sit on each plan, how
 * many use sites, active subscriptions and a rough MRR. Reads the whole table
 * via the service role (RLS would only ever show the caller's own row), so the
 * page is gated by an email allowlist first (see lib/admin).
 */
export default async function StatsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)
  const t = dict.stats

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="font-brand text-3xl">{t.title}</h1>
        <p className="mt-6 text-sm text-accent">{t.noService}</p>
      </main>
    )
  }

  const DAY = 24 * 60 * 60 * 1000
  const nowMs = Date.now()
  const since30 = new Date(nowMs - 30 * DAY).toISOString()

  const [
    { data: profiles },
    { data: galleries },
    { data: sites },
    { data: subs },
    { data: refs },
    { count: photosTotal },
    { count: photosDelivered },
    { data: payments30 },
    { data: bookings30 },
    { data: promoGrants },
  ] = await Promise.all([
      admin
        .from('profiles')
        .select('user_id, display_name, plan, site_plan, storage_used_bytes, created_at, is_ambassador')
        .order('created_at', { ascending: true })
        .returns<ProfileRow[]>(),
      admin
        .from('galleries')
        .select('owner_id, is_published, expires_at, has_password')
        .returns<GalleryRow[]>(),
      admin.from('sites').select('is_published').returns<{ is_published: boolean }[]>(),
      admin
        .from('billing_subscriptions')
        .select('product, plan, period, status')
        .returns<SubRow[]>(),
      admin.from('referrals').select('status').returns<{ status: string }[]>(),
      // Photo counts are head-only (no rows transferred). "Delivered" = photos
      // in published galleries; the explicit FK hint is needed because
      // galleries.cover_asset_id is a second path between the two tables.
      admin.from('assets').select('id', { count: 'exact', head: true }).eq('kind', 'photo'),
      admin
        .from('assets')
        .select('id, galleries!assets_gallery_id_fkey!inner(is_published)', {
          count: 'exact',
          head: true,
        })
        .eq('kind', 'photo')
        .eq('galleries.is_published', true),
      admin
        .from('payments')
        .select('status, amount')
        .gte('created_at', since30)
        .returns<PaymentRow[]>(),
      admin
        .from('booking_slots')
        .select('status, price_uah, booked_at, paid_at')
        .in('status', ['booked', 'paid'])
        .or(`booked_at.gte.${since30},paid_at.gte.${since30}`)
        .returns<BookingRow[]>(),
      admin
        .from('promo_grants')
        .select('user_id, ends_at, autopay_at')
        .returns<{ user_id: string; ends_at: string; autopay_at: string | null }[]>(),
    ])
  const referralsTotal = refs?.length ?? 0
  const referralsPaid = (refs ?? []).filter((r) => r.status === 'converted').length

  // Pending ambassador cash-out requests (admin resolves them manually).
  const { data: pendingWithdrawals } = await admin
    .from('withdrawals')
    .select('id, user_id, amount_kop, details, created_at')
    .eq('status', 'requested')
    .order('created_at', { ascending: true })
    .returns<WithdrawalRow[]>()

  // Emails live in auth.users, not profiles — fetch them via the admin API and
  // map by id so the photographer list can show a real contact.
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const profileRows = profiles ?? []
  const galleryRows = galleries ?? []
  const siteRows = sites ?? []
  const subRows = subs ?? []

  // --- aggregates ---
  const galleryPlanIds = Object.keys(GALLERY_PLANS) as GalleryPlanId[]
  const sitePlanIds = Object.keys(SITE_PLANS) as SitePlanId[]

  const galleryPlanCounts = new Map<string, number>()
  const sitePlanCounts = new Map<string, number>()
  let storageUsed = 0
  for (const p of profileRows) {
    galleryPlanCounts.set(p.plan, (galleryPlanCounts.get(p.plan) ?? 0) + 1)
    sitePlanCounts.set(p.site_plan, (sitePlanCounts.get(p.site_plan) ?? 0) + 1)
    storageUsed += p.storage_used_bytes ?? 0
  }

  const galleryPlanName: Record<GalleryPlanId, string> = {
    free: dict.billing.planFree,
    basic: dict.billing.planBasic,
    plus: dict.billing.planPlus,
    pro: dict.billing.planPro,
  }
  const sitePlanName: Record<SitePlanId, string> = {
    site_trial: dict.billing.sitePlanTrial,
    site_basic: dict.billing.sitePlanBasic,
    site_plus: dict.billing.sitePlanPlus,
  }

  // Per-photographer list (founder view): name, contact, plans, storage, join date.
  const photographers = profileRows.map((p) => ({
    userId: p.user_id,
    isAmbassador: p.is_ambassador === true,
    name: p.display_name || '—',
    email: emailById.get(p.user_id) || '—',
    gallery: galleryPlanName[p.plan as GalleryPlanId] ?? p.plan,
    site: sitePlanName[p.site_plan as SitePlanId] ?? p.site_plan,
    storage: formatGb(p.storage_used_bytes ?? 0),
    joined: new Date(p.created_at).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  }))
  const withdrawalRequests = (pendingWithdrawals ?? []).map((w) => ({
    id: w.id,
    name: profileRows.find((p) => p.user_id === w.user_id)?.display_name || emailById.get(w.user_id) || '—',
    email: emailById.get(w.user_id) || '—',
    amount: `${(w.amount_kop / 100).toFixed(0)} ₴`,
    details: w.details,
  }))

  // Import promo (lib/promo): accounts in their free «Базовий» month carry
  // plan = basic but haven't paid — keep them out of the paid count.
  const promoRows = promoGrants ?? []
  const promoRunningUsers = new Set(
    promoRows.filter((g) => new Date(g.ends_at).getTime() > nowMs).map((g) => g.user_id),
  )
  const promoAutopay = promoRows.filter((g) => g.autopay_at).length
  const promoFreeNow = profileRows.filter(
    (p) => p.plan !== 'free' && promoRunningUsers.has(p.user_id),
  ).length

  const paidGalleryUsers =
    galleryPlanIds
      .filter((id) => id !== 'free')
      .reduce((sum, id) => sum + (galleryPlanCounts.get(id) ?? 0), 0) - promoFreeNow

  const activeSubs = subRows.filter((s) => s.status === 'active')
  // Rough MRR: monthly-equivalent price of every active subscription.
  let mrr = 0
  for (const s of activeSubs) {
    let monthly = 0
    if (s.product === 'gallery' && (galleryPlanIds as string[]).includes(s.plan)) {
      const plan = GALLERY_PLANS[s.plan as GalleryPlanId]
      monthly = s.period === 'year' ? plan.priceUahYear / 12 : plan.priceUahMonth
    } else if (s.product === 'site' && (sitePlanIds as string[]).includes(s.plan)) {
      const plan = SITE_PLANS[s.plan as SitePlanId]
      monthly = s.period === 'year' ? plan.priceUahYear / 12 : plan.priceUahMonth
    }
    mrr += monthly
  }

  const activeSubCounts = new Map<string, number>()
  for (const s of activeSubs) {
    const key = `${s.product}:${s.plan}`
    activeSubCounts.set(key, (activeSubCounts.get(key) ?? 0) + 1)
  }

  const publishedSites = siteRows.filter((s) => s.is_published).length
  const publishedGalleries = galleryRows.filter((g) => g.is_published).length

  // --- growth, galleries, payments, bookings (read-only) ---
  const newSince = (days: number) =>
    profileRows.filter((p) => nowMs - new Date(p.created_at).getTime() <= days * DAY).length
  const newUsers7 = newSince(7)
  const newUsers30 = newSince(30)

  // Same rule the public gallery page uses: published and not expired.
  const activeGalleries = galleryRows.filter(
    (g) => g.is_published && (!g.expires_at || new Date(g.expires_at).getTime() > nowMs),
  ).length
  const passwordGalleries = galleryRows.filter((g) => g.has_password === true).length
  const galleriesByOwner = new Map<string, number>()
  for (const g of galleryRows) galleriesByOwner.set(g.owner_id, (galleriesByOwner.get(g.owner_id) ?? 0) + 1)

  const paymentRows = payments30 ?? []
  const paidPayments = paymentRows.filter((p) => p.status === 'paid')
  const paidSum = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const unpaidPayments = paymentRows.filter((p) => p.status === 'pending' || p.status === 'failed').length
  const pastDueSubs = subRows.filter((s) => s.status === 'past_due').length

  const since30Ms = nowMs - 30 * DAY
  const bookingRows = bookings30 ?? []
  const bookingsCount = bookingRows.filter(
    (b) => b.booked_at && new Date(b.booked_at).getTime() >= since30Ms,
  ).length
  const bookingsPaidSum = bookingRows
    .filter((b) => b.status === 'paid' && b.paid_at && new Date(b.paid_at).getTime() >= since30Ms)
    .reduce((sum, b) => sum + Number(b.price_uah), 0)

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  const recentSignups = [...profileRows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)
    .map((p) => ({
      userId: p.user_id,
      email: emailById.get(p.user_id) || '—',
      plan: galleryPlanName[p.plan as GalleryPlanId] ?? p.plan,
      joined: dateFmt(p.created_at),
      galleries: galleriesByOwner.get(p.user_id) ?? 0,
      storage: formatGb(p.storage_used_bytes ?? 0),
    }))
  const uk = locale === 'uk'

  const tile = (label: string, value: string | number) => (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-brand text-3xl">{value}</p>
    </div>
  )

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-brand text-3xl">{t.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.subtitle}</p>

      {/* --- headline tiles --- */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tile(t.totalUsers, profileRows.length)}
        {tile(t.paidUsers, paidGalleryUsers)}
        {tile(t.mrr, `${Math.round(mrr)} ₴`)}
        {tile(t.galleries, `${publishedGalleries} / ${galleryRows.length}`)}
        {tile(t.sites, publishedSites)}
        {tile(t.storage, formatGb(storageUsed))}
        {tile(t.referralsTotal, referralsTotal)}
        {tile(t.referralsPaid, referralsPaid)}
        {tile(
          uk ? 'Промо за імпорт: видано' : 'Import promo: granted',
          `${promoRows.length} / ${IMPORT_PROMO.maxGrants}`,
        )}
        {tile(uk ? 'Промо: з автоплатежем' : 'Promo: auto-payment', promoAutopay)}
      </div>

      {/* --- growth / galleries / photos --- */}
      <section className="mt-12">
        <h2 className="mb-4 font-brand text-xl">{uk ? 'Кабінети й галереї' : 'Accounts & galleries'}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tile(uk ? 'Нових за 7 днів' : 'New, 7 days', newUsers7)}
          {tile(uk ? 'Нових за 30 днів' : 'New, 30 days', newUsers30)}
          {tile(uk ? 'Галереї активні' : 'Active galleries', `${activeGalleries} / ${galleryRows.length}`)}
          {tile(uk ? 'Галереї з паролем' : 'Password-protected', passwordGalleries)}
          {tile(uk ? 'Фото передано клієнтам' : 'Photos delivered', photosDelivered ?? 0)}
          {tile(uk ? 'Фото завантажено всього' : 'Photos uploaded', photosTotal ?? 0)}
        </div>
        <p className="mt-2 text-xs text-muted">
          {uk
            ? 'Активні — опубліковані й з незакінченим терміном. «Передано клієнтам» — фото (assets.kind = photo) в опублікованих галереях; «всього» — усі фото, що зараз зберігаються (видалені не враховуються).'
            : 'Active = published and not expired. "Delivered" = photos (assets.kind = photo) in published galleries; "uploaded" = all photos currently stored (deleted ones are not counted).'}
        </p>
      </section>

      {/* --- payments & bookings, last 30 days --- */}
      <section className="mt-12">
        <h2 className="mb-4 font-brand text-xl">{uk ? 'Оплати й бронювання · 30 днів' : 'Payments & bookings · 30 days'}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tile(uk ? 'Оплат тарифів' : 'Plan payments', paidPayments.length)}
          {tile(uk ? 'Сума оплат' : 'Paid total', `${Math.round(paidSum)} ₴`)}
          {tile(uk ? 'Не оплачені' : 'Unpaid', unpaidPayments)}
          {tile(uk ? 'Прострочені підписки' : 'Past-due subscriptions', pastDueSubs)}
          {tile(uk ? 'Бронювань' : 'Bookings', bookingsCount)}
          {tile(uk ? 'Оплачено бронювань' : 'Bookings paid', `${Math.round(bookingsPaidSum)} ₴`)}
        </div>
        <p className="mt-2 text-xs text-muted">
          {uk
            ? '«Не оплачені» — платежі зі статусом pending або failed за 30 днів (зокрема покинуті checkout). «Прострочені» — підписки зі статусом past_due зараз. Бронювання — слоти, заброньовані за 30 днів; сума — слоти, оплачені за 30 днів.'
            : '"Unpaid" = pending or failed payments in the last 30 days (incl. abandoned checkouts). "Past-due" = subscriptions currently past_due. Bookings = slots booked in the last 30 days; total = slots paid in the last 30 days.'}
        </p>
      </section>

      {/* --- ambassador cash-out requests --- */}
      {withdrawalRequests.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-brand text-xl">
            {locale === 'uk' ? 'Заявки на виведення' : 'Withdrawal requests'} · {withdrawalRequests.length}
          </h2>
          <div className="flex flex-col gap-3">
            {withdrawalRequests.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">
                    {w.name} · <span className="font-brand">{w.amount}</span>
                  </p>
                  <p className="break-all text-sm text-muted">
                    {w.email} — {w.details}
                  </p>
                </div>
                <form action={processWithdrawal.bind(null, locale as Locale, w.id, 'paid')}>
                  <button
                    type="submit"
                    className="rounded-full bg-fg px-4 py-1.5 text-xs font-semibold text-bg"
                  >
                    {locale === 'uk' ? 'Виплачено' : 'Paid'}
                  </button>
                </form>
                <form action={processWithdrawal.bind(null, locale as Locale, w.id, 'rejected')}>
                  <button
                    type="submit"
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-muted hover:border-fg hover:text-fg"
                  >
                    {locale === 'uk' ? 'Відхилити' : 'Reject'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- last 50 sign-ups --- */}
      <section className="mt-12">
        <h2 className="mb-4 font-brand text-xl">
          {uk ? 'Останні реєстрації' : 'Latest sign-ups'} · {recentSignups.length}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">{uk ? 'Тариф' : 'Plan'}</th>
                <th className="px-4 py-3 font-semibold">{uk ? 'Дата' : 'Date'}</th>
                <th className="px-4 py-3 font-semibold">{uk ? 'Галерей' : 'Galleries'}</th>
                <th className="px-4 py-3 font-semibold">{uk ? 'Обсяг' : 'Storage'}</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((r, index) => (
                <tr key={r.userId} className={index > 0 ? 'border-t border-line' : ''}>
                  <td className="px-4 py-3 text-fg">{r.email}</td>
                  <td className="px-4 py-3">{r.plan}</td>
                  <td className="px-4 py-3 text-muted">{r.joined}</td>
                  <td className="px-4 py-3">{r.galleries}</td>
                  <td className="px-4 py-3">{r.storage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- photographers list --- */}
      <section className="mt-12">
        <h2 className="mb-4 font-brand text-xl">
          {locale === 'uk' ? 'Фотографи' : 'Photographers'} · {photographers.length}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'Імʼя' : 'Name'}</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'Галереї' : 'Galleries'}</th>
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'Сайт' : 'Site'}</th>
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'Сховище' : 'Storage'}</th>
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'З' : 'Joined'}</th>
                <th className="px-4 py-3 font-semibold">{locale === 'uk' ? 'Амбасадор' : 'Ambassador'}</th>
              </tr>
            </thead>
            <tbody>
              {photographers.map((p, index) => (
                <tr key={p.email + index} className={index > 0 ? 'border-t border-line' : ''}>
                  <td className="px-4 py-3 font-medium text-fg">{p.name}</td>
                  <td className="px-4 py-3 text-muted">{p.email}</td>
                  <td className="px-4 py-3">{p.gallery}</td>
                  <td className="px-4 py-3">{p.site}</td>
                  <td className="px-4 py-3">{p.storage}</td>
                  <td className="px-4 py-3 text-muted">{p.joined}</td>
                  <td className="px-4 py-3">
                    <form action={setAmbassador.bind(null, locale as Locale, p.userId, !p.isAmbassador)}>
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          p.isAmbassador
                            ? 'border-accent bg-accent text-white'
                            : 'border-line text-muted hover:border-fg hover:text-fg'
                        }`}
                      >
                        {p.isAmbassador
                          ? locale === 'uk'
                            ? '★ Амбасадор'
                            : '★ Ambassador'
                          : locale === 'uk'
                            ? 'Зробити'
                            : 'Make'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- gallery plan breakdown --- */}
      <section className="mt-12">
        <h2 className="mb-4 font-brand text-xl">{t.galleryPlans}</h2>
        <div className="overflow-hidden rounded-2xl border border-line">
          {galleryPlanIds.map((id, index) => (
            <div
              key={id}
              className={`flex items-center justify-between px-5 py-3 text-sm ${
                index > 0 ? 'border-t border-line' : ''
              }`}
            >
              <span>{galleryPlanName[id]}</span>
              <span className="font-brand text-lg">{galleryPlanCounts.get(id) ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t.galleryPlansHint}</p>
      </section>

      {/* --- site plan breakdown --- */}
      <section className="mt-10">
        <h2 className="mb-4 font-brand text-xl">{t.sitePlans}</h2>
        <div className="overflow-hidden rounded-2xl border border-line">
          {sitePlanIds.map((id, index) => (
            <div
              key={id}
              className={`flex items-center justify-between px-5 py-3 text-sm ${
                index > 0 ? 'border-t border-line' : ''
              }`}
            >
              <span>{sitePlanName[id]}</span>
              <span className="font-brand text-lg">{sitePlanCounts.get(id) ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      {/* --- active subscriptions --- */}
      <section className="mt-10">
        <h2 className="mb-4 font-brand text-xl">{t.activeSubs}</h2>
        {activeSubCounts.size === 0 ? (
          <p className="text-sm text-muted">{t.noSubs}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            {[...activeSubCounts.entries()].map(([key, count], index) => {
              const [product, plan] = key.split(':')
              const name =
                product === 'gallery'
                  ? (galleryPlanName[plan as GalleryPlanId] ?? plan)
                  : (sitePlanName[plan as SitePlanId] ?? plan)
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between px-5 py-3 text-sm ${
                    index > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <span>
                    {product === 'gallery' ? t.productGallery : t.productSite} · {name}
                  </span>
                  <span className="font-brand text-lg">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

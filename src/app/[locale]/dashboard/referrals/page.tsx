import { notFound, redirect } from 'next/navigation'
import { requestWithdrawal } from '@/lib/actions/referrals'
import { getDictionary } from '@/lib/i18n'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CopyLinkButton } from '@/components/CopyLinkButton'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'
const WITHDRAW_MIN_KOP = 20000

function uah(kop: number): string {
  const value = kop / 100
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)} ₴`
}

interface Stats {
  invited: number
  converted: number
  credit_kop: number
  cash_kop: number
  is_ambassador: boolean
}

/** «Запросити фотографа» — referral link, balances and cash-out for ambassadors. */
export default async function ReferralsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { w?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale
  const dict = await getDictionary(locale)
  const t = dict.referrals

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('user_id', user.id)
    .single<{ referral_code: string | null }>()

  const { data: statsData } = await supabase.rpc('get_referral_stats')
  const stats: Stats = (statsData as Stats[] | null)?.[0] ?? {
    invited: 0,
    converted: 0,
    credit_kop: 0,
    cash_kop: 0,
    is_ambassador: false,
  }

  const link = profile?.referral_code
    ? `${APP_URL}/${locale}/login?ref=${profile.referral_code}`
    : null
  const canWithdraw = stats.is_ambassador && stats.cash_kop >= WITHDRAW_MIN_KOP

  const tile = (label: string, value: string) => (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-brand text-3xl">{value}</p>
    </div>
  )

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-brand text-3xl">{t.title}</h1>
        {stats.is_ambassador && (
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            {t.ambassadorBadge}
          </span>
        )}
      </div>
      <p className="mt-3 leading-relaxed text-muted">
        {stats.is_ambassador ? t.ambassadorNote : t.lede}
      </p>

      {searchParams.w === 'ok' && (
        <p className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-800">
          {t.withdrawRequested}
        </p>
      )}
      {searchParams.w === 'min' && (
        <p className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {t.withdrawBelowMin}
        </p>
      )}
      {(searchParams.w === 'error' || searchParams.w === 'forbidden') && (
        <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {t.withdrawError}
        </p>
      )}

      {link && (
        <div className="mt-8">
          <p className="text-sm text-muted">{t.yourLink}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
            <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
            <CopyLinkButton url={link} label={t.copy} copiedLabel={t.copied} />
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-3 gap-4">
        {tile(t.statInvited, String(stats.invited))}
        {tile(t.statConverted, String(stats.converted))}
        {stats.is_ambassador
          ? tile(t.cashTitle, uah(stats.cash_kop))
          : tile(t.creditTitle, uah(stats.credit_kop))}
      </div>

      {stats.is_ambassador ? (
        <section className="mt-8 rounded-2xl border border-line p-6">
          <p className="text-sm text-muted">{t.withdrawMin}</p>
          <form action={requestWithdrawal.bind(null, locale)} className="mt-4 flex flex-col gap-3">
            <input
              name="details"
              placeholder={t.withdrawDetails}
              required
              className="border border-line bg-transparent px-3 py-2 outline-none focus:border-fg"
            />
            <button
              type="submit"
              disabled={!canWithdraw}
              className="self-start rounded-full bg-fg px-6 py-2.5 text-sm font-semibold text-bg transition-opacity disabled:opacity-40"
            >
              {t.withdraw}
            </button>
          </form>
        </section>
      ) : (
        <p className="mt-4 text-sm text-muted">{t.creditNote}</p>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-brand text-xl">{t.howTitle}</h2>
        <ol className="flex flex-col gap-3">
          {[t.how1, t.how2, t.how3].map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

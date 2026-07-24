import { notFound, redirect } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CopyLinkButton } from '@/components/CopyLinkButton'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space'

/** «Запросити фотографа» — referral link, stats and how the free month works. */
export default async function ReferralsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
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
  const stats = (
    statsData as { invited: number; converted: number; free_months: number }[] | null
  )?.[0] ?? { invited: 0, converted: 0, free_months: 0 }

  const link = profile?.referral_code
    ? `${APP_URL}/${locale}/login?ref=${profile.referral_code}`
    : null

  const tile = (label: string, value: number) => (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-brand text-3xl">{value}</p>
    </div>
  )

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-brand text-3xl">{t.title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{t.lede}</p>

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
        {tile(t.statInvited, stats.invited)}
        {tile(t.statConverted, stats.converted)}
        {tile(t.statFreeMonths, stats.free_months)}
      </div>

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

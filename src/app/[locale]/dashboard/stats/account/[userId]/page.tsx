import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { endPartnerPeriod, savePartnerPeriod } from '@/lib/actions/partners'
import { isLocale } from '@/lib/i18n/config'
import { planName } from '@/lib/lifecycle-emails'
import { PARTNER_DEFAULT_PLAN, PARTNER_PRESET_MONTHS, type PartnerPeriod } from '@/lib/partners'
import { GALLERY_PLANS } from '@/lib/plans'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const GB = 1024 ** 3
const RESULT_TEXT: Record<string, string> = {
  saved: '✅ Збережено й застосовано.',
  ended: '✅ Партнерський період завершено.',
  bad_plan: '❌ Невідомий тариф.',
  bad_dates: '❌ Кінець має бути пізніше за початок і в майбутньому.',
  has_subscription: '❌ У акаунта активна підписка з автоплатежем — партнерський період їй нічого не додасть.',
  save_failed: '❌ Не вдалося зберегти (див. логи).',
  apply_failed: '⚠️ Збережено, але не застосовано до профілю — крон спробує о 03:00 UTC.',
  none: 'Відкритого періоду немає.',
}

const kyiv = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
const dateInput = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })

/**
 * Admin account card (founder-only): who the photographer is, what they are
 * on, and the «Партнерський період» block (migration 0051).
 */
export default async function AccountCardPage({
  params,
  searchParams,
}: {
  params: { locale: string; userId: string }
  searchParams: { partner?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()
  const admin = createSupabaseAdminClient()
  if (!admin) notFound()

  const userId = params.userId
  const [{ data: profile }, { data: email }, { count: galleries }, { data: periods }, { data: subs }] = await Promise.all([
    admin
      .from('profiles')
      .select('display_name, plan, grace_until, storage_used_bytes, created_at, is_ambassador')
      .eq('user_id', userId)
      .maybeSingle<{
        display_name: string | null
        plan: string
        grace_until: string | null
        storage_used_bytes: number
        created_at: string
        is_ambassador: boolean | null
      }>(),
    admin.rpc('user_email', { p_user: userId }),
    admin.from('galleries').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    admin
      .from('partner_periods')
      .select('id, user_id, plan, starts_at, ends_at, note, applied_at, ending_notice_at, finished_at, finish_reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<PartnerPeriod[]>(),
    admin
      .from('billing_subscriptions')
      .select('product, plan, period, status, next_charge_at')
      .eq('user_id', userId)
      .returns<{ product: string; plan: string; period: string; status: string; next_charge_at: string | null }[]>(),
  ])
  if (!profile) notFound()

  const open = (periods ?? []).find((p) => !p.finished_at) ?? null
  const history = (periods ?? []).filter((p) => p.finished_at)
  const save = savePartnerPeriod.bind(null, locale, userId)
  const end = endPartnerPeriod.bind(null, locale, userId)
  const defaultStart = open ? new Date(open.starts_at) : new Date()
  const paidPlans = (Object.keys(GALLERY_PLANS) as (keyof typeof GALLERY_PLANS)[]).filter((id) => id !== 'free')
  const result = searchParams.partner ? RESULT_TEXT[searchParams.partner] : null
  const input = 'border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg'

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href={`/${locale}/dashboard/stats`} className="text-sm text-muted">
        ← Статистика
      </Link>
      <h1 className="mt-4 font-brand text-3xl">{profile.display_name || (typeof email === 'string' ? email : '—')}</h1>
      <p className="mt-2 text-sm text-muted">
        {typeof email === 'string' ? email : '—'} · з {kyiv(profile.created_at)} · {galleries ?? 0} галерей ·{' '}
        {(Number(profile.storage_used_bytes) / GB).toFixed(1)} ГБ
      </p>
      <p className="mt-1 text-sm text-muted">
        Тариф: «{profile.plan === 'free' ? 'Безкоштовний' : planName(profile.plan)}»
        {profile.grace_until ? ` до ${kyiv(profile.grace_until)}` : ''}
        {profile.is_ambassador ? ' · ★ амбасадор' : ''}
        {(subs ?? [])
          .filter((s) => s.status === 'active')
          .map((s) => ` · автоплатіж ${planName(s.plan)} (${s.period === 'year' ? 'рік' : 'міс'})`)
          .join('')}
      </p>

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-brand text-xl">Партнерський період</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Усі можливості тарифу без оплати. За 7 днів до кінця фотограф отримує лист з посиланням на тарифи з автоплатежем.
          Після кінця — безкоштовний тариф: наявні галереї доступні ще 30 днів, нові — по 30 днів. Оплата під час періоду
          завершує його (далі діє оплачений тариф).
        </p>
        {open && (
          <p className="mt-3 text-sm font-semibold">
            {open.applied_at ? 'Діє' : 'Заплановано'}: «{planName(open.plan)}» {kyiv(open.starts_at)} – {kyiv(open.ends_at)}
            {open.ending_notice_at ? ' · лист «закінчується» надіслано' : ''}
          </p>
        )}
        {result && <p className="mt-3 text-sm">{result}</p>}

        <form action={save} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Тариф</span>
            <select name="plan" defaultValue={open?.plan ?? PARTNER_DEFAULT_PLAN} className={input}>
              {paidPlans.map((id) => (
                <option key={id} value={id}>
                  {planName(id)} — {GALLERY_PLANS[id].storageGb >= 1024 ? `${GALLERY_PLANS[id].storageGb / 1024} ТБ` : `${GALLERY_PLANS[id].storageGb} ГБ`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Початок</span>
            <input type="date" name="starts_at" defaultValue={dateInput(defaultStart)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Примітка — хто, за що (Instagram, кейс, фідбек)</span>
            <textarea name="note" rows={3} defaultValue={open?.note ?? ''} className={input} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            {PARTNER_PRESET_MONTHS.map((months) => (
              <button
                key={months}
                type="submit"
                name="months"
                value={String(months)}
                className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white hover:bg-accent-deep"
              >
                {months} місяці{months > 4 ? 'в' : ''}
              </button>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">або до дати</span>
              <input type="date" name="ends_at" defaultValue={open ? dateInput(new Date(open.ends_at)) : ''} className={input} />
            </label>
            <button type="submit" name="months" value="0" className="rounded-full border border-fg px-5 py-2 text-sm font-bold">
              Зберегти з цією датою
            </button>
          </div>
        </form>

        {open && (
          <form action={end} className="mt-5">
            <button type="submit" className="text-sm font-bold text-red-700 underline">
              {open.applied_at ? 'Завершити зараз' : 'Скасувати'}
            </button>
          </form>
        )}

        {history.length > 0 && (
          <div className="mt-6 border-t border-line pt-4 text-sm text-muted">
            <p className="font-semibold text-fg">Історія</p>
            {history.map((p) => (
              <p key={p.id} className="mt-1">
                «{planName(p.plan)}» {kyiv(p.starts_at)} – {kyiv(p.ends_at)} ·{' '}
                {p.finish_reason === 'paid' ? 'перейшов на оплату' : p.finish_reason === 'revoked' ? 'скасовано' : 'завершено'}
                {p.note ? ` · ${p.note}` : ''}
              </p>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

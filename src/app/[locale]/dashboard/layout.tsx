import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { signOut } from '@/lib/actions/galleries'
import { isAdminEmail } from '@/lib/admin'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import {
  effectiveGalleryPlan,
  isGalleryPlanId,
  planStorageBytes,
} from '@/lib/plans'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { DashNav, type NavItem } from '@/components/dashboard/DashNav'
import type { Profile } from '@/lib/types'

function formatGb(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} ГБ` : `${Math.max(Math.round(bytes / (1024 * 1024)), 0)} МБ`
}

/** Shared dashboard chrome: sidebar navigation + storage meter + account. */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single<Profile>()

  const items: NavItem[] = [
    { href: `/${locale}/dashboard`, label: dict.billing.galleryPlansTitle, prefix: true },
    { href: `/${locale}/dashboard/site`, label: dict.site.navLink },
    { href: `/${locale}/dashboard/booking`, label: dict.booking.navLink },
    { href: `/${locale}/dashboard/billing`, label: dict.dashboard.billingLink },
    { href: `/${locale}/dashboard/settings`, label: dict.dashboard.settingsLink },
  ]
  // Founder-only links (each page re-checks the allowlist).
  if (isAdminEmail(user.email)) {
    items.push({ href: `/${locale}/dashboard/stats`, label: dict.dashboard.statsLink })
    items.push({ href: `/${locale}/dashboard/blog`, label: 'Блог' })
  }

  const planName =
    profile && isGalleryPlanId(profile.plan)
      ? {
          free: dict.billing.planFree,
          basic: dict.billing.planBasic,
          plus: dict.billing.planPlus,
          pro: dict.billing.planPro,
        }[profile.plan]
      : profile?.plan

  // The limit that actually gates uploads (mirrors src/lib/uploads.ts), so the
  // meter matches reality after a downgrade/grace expiry instead of over-reporting.
  const effectiveLimit = profile
    ? Math.min(
        profile.storage_limit_bytes,
        planStorageBytes(effectiveGalleryPlan(profile.plan, profile.grace_until))
      )
    : 0
  const usedPct =
    profile && effectiveLimit > 0
      ? Math.min(Math.round((profile.storage_used_bytes / effectiveLimit) * 100), 100)
      : 0

  const signOutAction = signOut.bind(null, locale)

  return (
    <div className="flex min-h-screen">
      {/* -------- sidebar (desktop) -------- */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col gap-1 border-r border-line bg-white p-4 lg:flex">
        <Link href={`/${locale}`} className="mb-5 block px-3 pt-1 text-fg no-underline">
          <Logo size={20} textSize={14} />
        </Link>
        <DashNav items={items} />
        <div className="mt-auto flex flex-col gap-3">
          {profile && (
            <div className="rounded-2xl bg-bg p-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">
                {dict.dashboard.storageUsed} · {planName}
              </p>
              <div className="my-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-xs font-semibold text-muted">
                {formatGb(profile.storage_used_bytes)} / {formatGb(effectiveLimit)}
              </p>
            </div>
          )}
          <form action={signOutAction} className="px-3 pb-1">
            <p className="truncate text-xs font-semibold text-muted">{user.email}</p>
            <button type="submit" className="text-xs font-bold text-muted underline hover:text-fg">
              {dict.common.signOut}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* -------- top bar (mobile) -------- */}
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <Link href={`/${locale}`} className="flex-none text-fg no-underline">
            <Logo size={18} textSize={13} />
          </Link>
          <DashNav items={items} horizontal />
        </div>
        {children}
      </div>
    </div>
  )
}

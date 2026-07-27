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
import { MobileMenu } from '@/components/dashboard/MobileMenu'
import type { Profile } from '@/lib/types'

/**
 * Page-level "do not translate" for the whole dashboard: browser translators
 * rewrap React-managed text nodes and corrupt the app (observed removeChild
 * crash / silently blank pages). The element-level translate="no" below is
 * not enough once Chrome has already decided to translate the tab.
 */
export const metadata = {
  other: { google: 'notranslate' },
}

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
    { href: `/${locale}/dashboard/referrals`, label: dict.referrals.navLink },
    { href: `/${locale}/dashboard/settings`, label: dict.dashboard.settingsLink },
  ]
  // Founder-only links (each page re-checks the allowlist).
  if (isAdminEmail(user.email)) {
    items.push({ href: `/${locale}/dashboard/stats`, label: dict.dashboard.statsLink })
    items.push({ href: `/${locale}/dashboard/blog`, label: 'Блог' })
    items.push({ href: `/${locale}/dashboard/content`, label: 'Контент' })
    items.push({ href: `/${locale}/dashboard/stories`, label: 'Сторіс' })
    items.push({ href: `/${locale}/dashboard/threads`, label: 'Threads' })
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
    // translate="no" + notranslate: браузерні авто-перекладачі (Chrome,
    // Safari) обгортають текстові вузли своїми тегами всередині DOM, яким
    // керує React, і наступний ре-рендер падає з removeChild-помилкою.
    // Кабінет — україномовний робочий інструмент, тож переклад тут вимкнено.
    <div className="notranslate flex min-h-screen" translate="no">
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
          <Link href={`/${locale}/dashboard`} className="flex-none text-fg no-underline">
            <Logo size={18} textSize={13} />
          </Link>
          <MobileMenu label={dict.dashboard.title}>
            <DashNav items={items} />
            <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
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
              <form action={signOutAction} className="px-2 pb-1">
                <p className="truncate text-xs font-semibold text-muted">{user.email}</p>
                <button type="submit" className="mt-1 text-sm font-bold text-accent underline">
                  {dict.common.signOut}
                </button>
              </form>
            </div>
          </MobileMenu>
        </div>
        {children}
      </div>
    </div>
  )
}

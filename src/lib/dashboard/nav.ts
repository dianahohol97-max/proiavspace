import type { Dictionary } from '@/lib/i18n'

export interface DashboardNavItem {
  href: string
  label: string
  /** Match children too (e.g. /dashboard matches /dashboard/galleries/...). */
  prefix?: boolean
}

/**
 * Founder-only sections. Each of these pages also re-checks the allowlist on
 * the server (isAdminEmail → notFound), so hiding them here is about a clean
 * menu for photographers, not access control.
 */
export const ADMIN_ONLY_SECTIONS = ['stats', 'blog', 'hub', 'content', 'stories', 'threads'] as const

/** The dashboard menu: photographer sections for everyone, admin ones only for the owner. */
export function dashboardNavItems(locale: string, dict: Dictionary, isAdmin: boolean): DashboardNavItem[] {
  const base = `/${locale}/dashboard`
  const items: DashboardNavItem[] = [
    { href: base, label: dict.billing.galleryPlansTitle, prefix: true },
    { href: `${base}/site`, label: dict.site.navLink },
    { href: `${base}/booking`, label: dict.booking.navLink },
    { href: `${base}/offline`, label: dict.app.offlineTitle },
    { href: `${base}/billing`, label: dict.dashboard.billingLink },
    { href: `${base}/referrals`, label: dict.referrals.navLink },
    { href: `${base}/settings`, label: dict.dashboard.settingsLink },
  ]
  if (!isAdmin) return items
  const adminLabels: Record<(typeof ADMIN_ONLY_SECTIONS)[number], string> = {
    stats: dict.dashboard.statsLink,
    blog: 'Блог',
    hub: 'Хаб',
    content: 'Контент',
    stories: 'Сторіс',
    threads: 'Threads',
  }
  for (const section of ADMIN_ONLY_SECTIONS) {
    items.push({ href: `${base}/${section}`, label: adminLabels[section] })
  }
  return items
}

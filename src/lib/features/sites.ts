import { isAdminEmail } from '@/lib/admin'

/**
 * Photographer sites and booking are shelved until their own release.
 * NEXT_PUBLIC_SITES_ENABLED=1 brings everything back exactly as it was; by
 * default it is off. The platform owner (ADMIN_EMAILS — the same check that
 * hides «Блог»/«Хаб»/«Статистика») always sees all of it, to work on themes.
 *
 * Nothing is deleted: the code, routes and data stay; only the menu, the
 * pages and the public endpoints are switched off for everyone else.
 */
export function sitesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SITES_ENABLED === '1'
}

/** Sites and booking are visible to this signed-in user. */
export function canSeeSites(email: string | null | undefined): boolean {
  return sitesEnabled() || isAdminEmail(email)
}

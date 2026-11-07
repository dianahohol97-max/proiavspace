import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface SiteOwnerExtras {
  /** profiles.site_plan of the site's owner; null when it can't be read. */
  sitePlan: string | null
  /** portfolio asset id → key of its `mobile` rendition (only those that have one). */
  mobileKeys: Record<string, string>
}

const NONE: SiteOwnerExtras = { sitePlan: null, mobileKeys: {} }

/**
 * What the public site page needs beyond the security-definer RPCs, read with
 * the service role — the same pattern as isGalleryUnlocked reading
 * password_hash: get_site doesn't expose the owner's plan, and
 * get_site_portfolio returns only the `preview` key. No migration needed.
 *
 * Scoped tightly: only a PUBLISHED site by this handle, only that owner's
 * portfolio rows, only the ids the RPC already returned (so hidden photos
 * stay hidden). Without the admin client everything fails closed: no credit
 * (`sitePlan` null) and no mobile sources (themes fall back to `preview`).
 */
export async function loadSiteOwnerExtras(handle: string, portfolioIds: string[]): Promise<SiteOwnerExtras> {
  const admin = createSupabaseAdminClient()
  if (!admin) return NONE
  try {
    const { data: site } = await admin
      .from('sites')
      .select('user_id')
      .eq('handle', handle)
      .eq('is_published', true)
      .maybeSingle<{ user_id: string }>()
    if (!site) return NONE

    const [{ data: profile }, { data: rows }] = await Promise.all([
      admin.from('profiles').select('site_plan').eq('user_id', site.user_id).maybeSingle<{ site_plan: string }>(),
      portfolioIds.length > 0
        ? admin
            .from('portfolio_assets')
            .select('id, variants')
            .eq('owner_id', site.user_id)
            .in('id', portfolioIds)
            .returns<{ id: string; variants: Record<string, string> | null }[]>()
        : Promise.resolve({ data: [] as { id: string; variants: Record<string, string> | null }[] }),
    ])

    const prefix = `u/${site.user_id}/portfolio/v/`
    const mobileKeys: Record<string, string> = {}
    for (const row of rows ?? []) {
      const key = row.variants?.mobile
      if (typeof key === 'string' && key.startsWith(prefix)) mobileKeys[row.id] = key
    }
    return { sitePlan: profile?.site_plan ?? null, mobileKeys }
  } catch {
    return NONE
  }
}

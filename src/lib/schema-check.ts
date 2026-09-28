import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Is the database on the migrations this deploy expects? The app and the
 * migrations ship separately (Vercel deploys main; SQL is applied by hand),
 * so a merged PR whose migration was not applied yet breaks at runtime — e.g.
 * the payment webhook writes profiles.gallery_closed_at (0048) and answers 500
 * without it, so a paid plan is never applied. One probe per migration the
 * code depends on; /api/admin/billing-check shows the result.
 */
export interface SchemaProbe {
  migration: string
  what: string
  run: (admin: SupabaseClient) => PromiseLike<{ error: { message: string } | null }>
}

const column = (table: string, columns: string) => (admin: SupabaseClient) =>
  admin.from(table).select(columns).limit(0)
const fn = (name: string, args: Record<string, unknown>) => (admin: SupabaseClient) =>
  admin.rpc(name, args)

const ZERO = '00000000-0000-0000-0000-000000000000'

export const SCHEMA_PROBES: SchemaProbe[] = [
  { migration: '0044_referrals_v3', what: 'payments.referral_processed_at', run: column('payments', 'referral_processed_at') },
  { migration: '0047_user_email_helper', what: 'user_email() — адреси для листів', run: fn('user_email', { p_user: ZERO }) },
  { migration: '0048_retention_lifecycle', what: 'profiles.gallery_closed_at — вебхук оплати пише її', run: column('profiles', 'gallery_closed_at') },
  { migration: '0048_retention_lifecycle', what: 'lifecycle_notices', run: column('lifecycle_notices', 'kind') },
  { migration: '0049_free_gallery_expiry', what: 'galleries.free_expires_at (30 днів Free)', run: column('galleries', 'free_expires_at') },
]

export async function missingMigrations(admin: SupabaseClient): Promise<{ migration: string; what: string; error: string }[]> {
  const results = await Promise.all(
    SCHEMA_PROBES.map(async (probe) => {
      const { error } = await probe.run(admin)
      return error ? { migration: probe.migration, what: probe.what, error: error.message } : null
    })
  )
  return results.filter((r): r is NonNullable<typeof r> => r !== null)
}

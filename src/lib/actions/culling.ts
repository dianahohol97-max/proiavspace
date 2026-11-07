'use server'

/**
 * «Сховати від клієнта» for the AI culling panel — PREPARED, NOT ENABLED.
 *
 * Needs assets.hidden_from_client (migration 0054 in branch db/1). Until that
 * is applied and NEXT_PUBLIC_CULLING_HIDE=1 is set, this refuses on the server
 * as well, so a stale client can never write a column that does not exist.
 * The column is writable by the service role only (0041), hence the admin
 * client — after an explicit ownership check with the user's own session.
 */
import { revalidatePath } from 'next/cache'
import { HIDE_FROM_CLIENT_ENABLED } from '@/lib/culling/config'
import type { Locale } from '@/lib/i18n/config'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const MAX_IDS = 2000

export async function setHiddenFromClient(
  locale: Locale,
  galleryId: string,
  assetIds: string[],
  hidden = true
): Promise<void> {
  if (!HIDE_FROM_CLIENT_ENABLED) throw new Error('hide_from_client_disabled')
  const ids = [...new Set(assetIds)].filter((id) => typeof id === 'string' && id.length > 0).slice(0, MAX_IDS)
  if (ids.length === 0) return

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  // Only this owner's photos of this gallery — RLS-scoped read with the user's session.
  const { data: owned, error: readError } = await supabase
    .from('assets')
    .select('id')
    .eq('gallery_id', galleryId)
    .eq('owner_id', user.id)
    .in('id', ids)
    .returns<{ id: string }[]>()
  if (readError) throw new Error(`Failed to check photos: ${readError.message}`)
  const allowed = (owned ?? []).map((a) => a.id)
  if (allowed.length === 0) return

  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('service_role_missing')
  const { error } = await admin
    .from('assets')
    .update({ hidden_from_client: hidden })
    .eq('gallery_id', galleryId)
    .eq('owner_id', user.id)
    .in('id', allowed)
  if (error) throw new Error(`Failed to update photos: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
}

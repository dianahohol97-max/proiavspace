'use server'

/**
 * «Сховати від клієнта» / «Повернути клієнту» for the AI culling panel.
 *
 * assets.hidden_from_client (migration 0054, applied 7.11.2026) is writable
 * by the service role only (0041), hence the admin client — but only for the
 * ids that an explicit ownership check with the user's OWN session returned.
 * The file is never touched; the public gallery, archive, selections and
 * original downloads stop showing the photo (code from db/1).
 */
import { revalidatePath } from 'next/cache'
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

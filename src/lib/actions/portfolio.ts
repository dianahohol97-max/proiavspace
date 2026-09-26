'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

export async function deletePortfolioAsset(locale: Locale, assetId: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')

  const { data: asset } = await supabase
    .from('portfolio_assets')
    .select('id, owner_id, r2_key, variants')
    .eq('id', assetId)
    .single()
  if (!asset || asset.owner_id !== user.id) {
    throw new Error('Portfolio photo not found')
  }

  // Only objects under this user's own portfolio prefix are ever deleted.
  const prefix = `u/${user.id}/portfolio/`
  const variantKeys = Object.values(asset.variants as Record<string, string>)
  await getStorage().delete([asset.r2_key, ...variantKeys].filter((key) => key.startsWith(prefix)))

  const { error } = await supabase.from('portfolio_assets').delete().eq('id', assetId)
  if (error) throw new Error(`Failed to delete portfolio photo: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/site`)
}

/** Toggle whether one portfolio photo appears on the public site. */
export async function setPortfolioVisibility(
  locale: Locale,
  assetId: string,
  visible: boolean
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')

  // RLS (owner-all) already scopes writes to the caller's rows; the explicit
  // owner_id filter is defense in depth.
  const { error } = await supabase
    .from('portfolio_assets')
    .update({ visible })
    .eq('id', assetId)
    .eq('owner_id', user.id)
  if (error) throw new Error(`Failed to update portfolio photo: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/site`)
}

/** Assign (or clear) the category a portfolio photo is grouped under. */
export async function setPortfolioCategory(
  locale: Locale,
  assetId: string,
  category: string
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')

  const trimmed = category.trim().slice(0, 60)
  const { error } = await supabase
    .from('portfolio_assets')
    .update({ category: trimmed || null })
    .eq('id', assetId)
    .eq('owner_id', user.id)
  if (error) throw new Error(`Failed to set category: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/site`)
}

/** Assign (or clear) the optional per-photo caption shown on the site. */
export async function setPortfolioCaption(
  locale: Locale,
  assetId: string,
  caption: string
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')

  const trimmed = caption.trim().slice(0, 120)
  const { error } = await supabase
    .from('portfolio_assets')
    .update({ caption: trimmed || null })
    .eq('id', assetId)
    .eq('owner_id', user.id)
  if (error) throw new Error(`Failed to set caption: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/site`)
}

/** Persist a new portfolio order (position = index in the given id list). */
export async function reorderPortfolio(locale: Locale, orderedIds: string[]): Promise<void> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('portfolio_assets')
        .update({ position: index })
        .eq('id', id)
        .eq('owner_id', user.id)
    )
  )

  revalidatePath(`/${locale}/dashboard/site`)
}

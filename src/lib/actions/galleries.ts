'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hashPassword } from '@/lib/password'
import { slugify } from '@/lib/slug'
import { galleryPrefix, getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')
  return { supabase, user }
}

export async function createGallery(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()

  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('Title is required')

  const description = String(formData.get('description') ?? '').trim() || null
  const eventDate = String(formData.get('event_date') ?? '').trim() || null
  const password = String(formData.get('password') ?? '')
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null

  const { data, error } = await supabase
    .from('galleries')
    .insert({
      owner_id: user.id,
      slug: slugify(title),
      title,
      description,
      event_date: eventDate,
      password_hash: password ? hashPassword(password) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create gallery: ${error.message}`)

  revalidatePath(`/${locale}/dashboard`)
  redirect(`/${locale}/dashboard/galleries/${data.id}`)
}

/**
 * Edit an existing gallery's password and expiry — previously only settable at
 * creation, so protecting or extending a live gallery meant delete + re-upload.
 * Password: blank leaves it unchanged; the «remove» flag clears it. Expiry: the
 * field's value wins (blank clears it). RLS restricts the update to the owner.
 */
export async function updateGallerySettings(
  locale: Locale,
  galleryId: string,
  formData: FormData
): Promise<void> {
  const { supabase } = await requireUser()

  const password = String(formData.get('password') ?? '')
  const removePassword = formData.get('remove_password') === 'on'
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null

  const patch: { expires_at: string | null; password_hash?: string | null } = {
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  }
  if (removePassword) patch.password_hash = null
  else if (password) patch.password_hash = hashPassword(password)

  const { error } = await supabase.from('galleries').update(patch).eq('id', galleryId)
  if (error) throw new Error(`Failed to update gallery settings: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
}

export async function setGalleryCover(
  locale: Locale,
  galleryId: string,
  assetId: string
): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('galleries')
    .update({ cover_asset_id: assetId })
    .eq('id', galleryId)
  if (error) throw new Error(`Failed to set cover: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
}

/** Gallery style: '' = inherit from the site, else a theme-catalog value. */
export async function setGalleryTheme(
  locale: Locale,
  galleryId: string,
  formData: FormData
): Promise<void> {
  const { supabase } = await requireUser()
  const value = String(formData.get('theme') ?? '').trim()
  const { THEME_CATALOG } = await import('@/lib/site/themes')
  if (value && !THEME_CATALOG.some((entry) => entry.value === value)) {
    throw new Error('Unknown gallery theme')
  }

  // Fine-grained design overrides (accent / columns / radius / font). Validated
  // by parseGalleryStyle; an empty object is stored as null (pure theme).
  const { parseGalleryStyle } = await import('@/lib/gallery/style')
  const parsed = parseGalleryStyle({
    accent: String(formData.get('accent') ?? '') || undefined,
    columns: Number(formData.get('columns')) || undefined,
    radius: formData.get('radius') !== null ? Number(formData.get('radius')) : undefined,
    font: String(formData.get('font') ?? '') || undefined,
    focalX: formData.get('focalX') !== null ? Number(formData.get('focalX')) : undefined,
    focalY: formData.get('focalY') !== null ? Number(formData.get('focalY')) : undefined,
  })
  const style = Object.keys(parsed).length > 0 ? parsed : null

  const { error } = await supabase
    .from('galleries')
    .update({ theme: value || null, style })
    .eq('id', galleryId)
  if (error) throw new Error(`Failed to set gallery style: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
}

export async function setGalleryPublished(
  locale: Locale,
  galleryId: string,
  published: boolean
): Promise<void> {
  const { supabase } = await requireUser()

  // RLS restricts the update to the owner's rows.
  const { error } = await supabase
    .from('galleries')
    .update({ is_published: published })
    .eq('id', galleryId)

  if (error) throw new Error(`Failed to update gallery: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
}

export async function deleteGallery(locale: Locale, galleryId: string): Promise<void> {
  const { supabase, user } = await requireUser()

  const { data: gallery, error: fetchError } = await supabase
    .from('galleries')
    .select('id, owner_id')
    .eq('id', galleryId)
    .single()
  if (fetchError || !gallery || gallery.owner_id !== user.id) {
    throw new Error('Gallery not found')
  }

  // R2 objects first (list by prefix catches originals + future variants),
  // then the DB row — the assets cascade delete re-credits the storage quota.
  const storage = getStorage()
  const objects = await storage.list(galleryPrefix(user.id, galleryId))
  await storage.delete(objects.map((o) => o.key))

  const { error } = await supabase.from('galleries').delete().eq('id', galleryId)
  if (error) throw new Error(`Failed to delete gallery: ${error.message}`)

  revalidatePath(`/${locale}/dashboard`)
  redirect(`/${locale}/dashboard`)
}

export async function deleteAsset(locale: Locale, assetId: string): Promise<void> {
  const { supabase, user } = await requireUser()

  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, gallery_id, owner_id, r2_key, variants')
    .eq('id', assetId)
    .single()
  if (fetchError || !asset || asset.owner_id !== user.id) {
    throw new Error('Asset not found')
  }

  const variantKeys = Object.values(asset.variants as Record<string, string>)
  await getStorage().delete([asset.r2_key, ...variantKeys])

  const { error } = await supabase.from('assets').delete().eq('id', assetId)
  if (error) throw new Error(`Failed to delete asset: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/galleries/${asset.gallery_id}`)
}

export async function signOut(locale: Locale): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect(`/${locale}`)
}

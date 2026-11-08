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

/** Insert a draft gallery; shared by both create actions below. */
async function insertGallery(
  formData: FormData
): Promise<{ ok: true; id: string } | { ok: false; error: 'title' | 'failed' }> {
  const { supabase, user } = await requireUser()

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, error: 'title' }

  const description = String(formData.get('description') ?? '').trim() || null
  const eventDate = String(formData.get('event_date') ?? '').trim() || null
  const password = String(formData.get('password') ?? '')
  const expiresAt = String(formData.get('expires_at') ?? '').trim() || null

  // Public URL carries the photographer's brand ahead of the gallery name:
  // proiav.space/uk/g/diana-hohol-vesillia-marty-… (suffix keeps links
  // unguessable). Existing galleries keep their old slugs — links live on.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()
  const brand = (profile?.display_name ?? '').trim()

  const { data, error } = await supabase
    .from('galleries')
    .insert({
      owner_id: user.id,
      slug: slugify([brand, title].filter(Boolean).join(' ')),
      title,
      description,
      event_date: eventDate,
      password_hash: password ? hashPassword(password) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('createGallery failed', error?.message)
    return { ok: false, error: 'failed' }
  }
  return { ok: true, id: data.id as string }
}

export async function createGallery(locale: Locale, formData: FormData): Promise<void> {
  const result = await insertGallery(formData)
  if (!result.ok) {
    throw new Error(result.error === 'title' ? 'Title is required' : 'Failed to create gallery')
  }
  revalidatePath(`/${locale}/dashboard`)
  redirect(`/${locale}/dashboard/galleries/${result.id}`)
}

export type FormState = { status: 'idle' | 'saved' | 'error'; error?: string; at?: number }

/**
 * «Нова галерея» (short form: name + shoot date) for useFormState: problems
 * come back as a code the form turns into plain words, success goes straight
 * to the upload tab of the new gallery.
 */
export async function createGalleryFromForm(
  locale: Locale,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const result = await insertGallery(formData)
  if (!result.ok) return { status: 'error', error: result.error, at: Date.now() }
  revalidatePath(`/${locale}/dashboard`)
  redirect(`/${locale}/dashboard/galleries/${result.id}?tab=photos&created=1`)
}

/** Next's redirect()/notFound() throw on purpose — never swallow them. */
function rethrowNavigation(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest
  if (typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')) {
    throw error
  }
}

/** «Доступ»: password + expiry via useFormState (saved / error instead of a crash page). */
export async function saveGalleryAccess(
  locale: Locale,
  galleryId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await updateGallerySettings(locale, galleryId, formData)
    return { status: 'saved', at: Date.now() }
  } catch (error) {
    rethrowNavigation(error)
    console.error('saveGalleryAccess failed', galleryId, error)
    return { status: 'error', error: 'failed', at: Date.now() }
  }
}

/**
 * «Назва й дата» in the Design tab: title, shoot date and the client-facing
 * description — before, these could only be typed once, at creation.
 */
export async function updateGalleryDetails(
  locale: Locale,
  galleryId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { supabase, user } = await requireUser()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { status: 'error', error: 'title', at: Date.now() }
  const eventDate = String(formData.get('event_date') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const { data, error } = await supabase
    .from('galleries')
    .update({
      title: title.slice(0, 200),
      event_date: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
      description: description ? description.slice(0, 2000) : null,
    })
    .eq('id', galleryId)
    .eq('owner_id', user.id)
    .select('id')
  if (error || !data?.length) {
    if (error) console.error('updateGalleryDetails failed', galleryId, error.message)
    return { status: 'error', error: 'failed', at: Date.now() }
  }
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  revalidatePath(`/${locale}/dashboard`)
  return { status: 'saved', at: Date.now() }
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
  const { GALLERY_CATALOG: THEME_CATALOG } = await import('@/lib/site/themes')
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
    bodyFont: String(formData.get('bodyFont') ?? '') || undefined,
    layout: String(formData.get('layout') ?? '') || undefined,
    gap: formData.get('gap') !== null ? Number(formData.get('gap')) : undefined,
    cover: String(formData.get('cover') ?? '') || undefined,
    titleScale:
      formData.get('titleScale') !== null ? Number(formData.get('titleScale')) : undefined,
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

/**
 * «Статус зйомки для клієнта» (0055): saved straight from the dashboard
 * control on every change — no form, no submit button. Returns ok instead of
 * throwing so the control can show «не вдалося зберегти» and keep the value.
 * The owner check is RLS (galleries_owner_all) plus an explicit owner_id
 * match, so a guessed gallery id updates nothing.
 */
export async function setGalleryDelivery(
  locale: Locale,
  galleryId: string,
  status: string | null,
  eta: string | null
): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser()
  const { parseDeliveryEta, parseDeliveryStatus } = await import('@/lib/gallery/delivery')
  const deliveryStatus = parseDeliveryStatus(status)
  if (status && !deliveryStatus) return { ok: false }
  if (eta && !parseDeliveryEta(eta)) return { ok: false }
  const { data, error } = await supabase
    .from('galleries')
    .update({ delivery_status: deliveryStatus, delivery_eta: parseDeliveryEta(eta) })
    .eq('id', galleryId)
    .eq('owner_id', user.id)
    .select('id')
  if (error || !data?.length) {
    if (error) console.error('setGalleryDelivery failed', galleryId, error.message)
    return { ok: false }
  }
  // «Готово» for the first time + the client's address → «Ваші фото готові»
  // (0067). Once per gallery; a failed letter never fails the status save.
  if (deliveryStatus === 'ready') {
    const { notifyClientIfReady } = await import('@/lib/gallery/ready-email-store')
    await notifyClientIfReady(supabase, user, galleryId)
  }
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  revalidatePath(`/${locale}/dashboard`)
  return { ok: true }
}

/**
 * «Клієнт може завантажувати фото» (galleries.downloads_enabled, 0070). Saved
 * on every flip of the switch. Without the migration the column is missing:
 * answer `migration` so the switch can say so, and change nothing.
 */
export async function setGalleryDownloads(
  locale: Locale,
  galleryId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: 'migration' | 'failed' }> {
  const { supabase, user } = await requireUser()
  const { isMissingDownloadsColumn } = await import('@/lib/gallery/downloads')
  const { data, error } = await supabase
    .from('galleries')
    .update({ downloads_enabled: enabled === true })
    .eq('id', galleryId)
    .eq('owner_id', user.id)
    .select('id')
  if (error) {
    if (isMissingDownloadsColumn(error)) return { ok: false, error: 'migration' }
    console.error('setGalleryDownloads failed', galleryId, error.message)
    return { ok: false, error: 'failed' }
  }
  if (!data?.length) return { ok: false, error: 'failed' }
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  return { ok: true }
}

export async function setGalleryPublished(
  locale: Locale,
  galleryId: string,
  published: boolean
): Promise<void> {
  const { supabase, user } = await requireUser()

  // RLS restricts the update to the owner's rows.
  const { error } = await supabase
    .from('galleries')
    .update({ is_published: published })
    .eq('id', galleryId)

  if (error) throw new Error(`Failed to update gallery: ${error.message}`)
  // Status «Готово» set while the gallery was still a draft: the letter
  // waited for a working link (0067). No-op when already sent / no address.
  if (published) {
    const { notifyClientIfReady } = await import('@/lib/gallery/ready-email-store')
    await notifyClientIfReady(supabase, user, galleryId)
  }
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
    // Already gone (a double click on «Видалити», a second tab) or not ours:
    // nothing to delete — go back to the list instead of an error page.
    revalidatePath(`/${locale}/dashboard`)
    redirect(`/${locale}/dashboard`)
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

/**
 * Per-photo focal point (0–100%) — where cropped layouts (squares/portrait/
 * collage/editorial) aim the frame. Set by clicking the photo in the manage
 * grid. RLS restricts the update to the owner.
 */
export async function setAssetFocal(
  locale: Locale,
  assetId: string,
  x: number,
  y: number
): Promise<void> {
  const { supabase } = await requireUser()
  const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)))
  const { error } = await supabase
    .from('assets')
    .update({ focal_x: clamp(x), focal_y: clamp(y) })
    .eq('id', assetId)
  if (error) throw new Error(`Failed to set photo focus: ${error.message}`)
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

  // Only objects under this user's own gallery prefix are ever deleted, so a
  // tampered variants map can't point the delete at someone else's files.
  const prefix = galleryPrefix(user.id, asset.gallery_id)
  const variantKeys = Object.values(asset.variants as Record<string, string>)
  await getStorage().delete([asset.r2_key, ...variantKeys].filter((key) => key.startsWith(prefix)))

  const { error } = await supabase.from('assets').delete().eq('id', assetId)
  if (error) throw new Error(`Failed to delete asset: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/galleries/${asset.gallery_id}`)
}

export async function signOut(locale: Locale): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect(`/${locale}`)
}

export type SortMode = 'taken' | 'uploaded'
export type SortResult = { ok: true; changed: number } | { ok: false; error: 'not_ready' | 'failed' }

/**
 * «Впорядкувати за часом зйомки» / «за часом завантаження»: rewrites the
 * gallery's order (assets.position) in one call to sort_gallery_assets
 * (migration 0067), which checks ownership itself. Photos from several
 * cameras end up interleaved by capture time; ones without EXIF time go last.
 */
export async function sortGalleryAssets(locale: Locale, galleryId: string, mode: SortMode): Promise<SortResult> {
  if (mode !== 'taken' && mode !== 'uploaded') return { ok: false, error: 'failed' }
  const { supabase } = await requireUser()
  const { data, error } = await supabase.rpc('sort_gallery_assets', { p_gallery: galleryId, p_mode: mode })
  if (error) {
    // Migration 0067 not applied yet: the function doesn't exist.
    const missing = error.code === 'PGRST202' || error.code === '42883' || /sort_gallery_assets/.test(error.message ?? '')
    console.error('sort_gallery_assets failed', galleryId, error.message)
    return { ok: false, error: missing ? 'not_ready' : 'failed' }
  }
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  return { ok: true, changed: typeof data === 'number' ? data : 0 }
}

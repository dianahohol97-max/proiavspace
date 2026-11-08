'use server'

/**
 * «Лист клієнтові» in the gallery dashboard (0066): the client's address
 * (optional, only with the client's consent) and «Надіслати ще раз». The
 * automatic letter itself is sent from setGalleryDelivery / setGalleryPublished
 * via notifyClientIfReady (lib/gallery/ready-email-store).
 */
import { revalidatePath } from 'next/cache'
import type { Locale } from '@/lib/i18n/config'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseClientEmail, sendReadyEmailAgain, type ReadyEmailResult } from '@/lib/gallery/ready-email'
import { isMissingColumn, ownerReadyEmailDeps, saveShareLocale } from '@/lib/gallery/ready-email-store'

export type ClientEmailSaveResult = { ok: true } | { ok: false; error: 'invalid' | 'consent' | 'unavailable' | 'failed' }

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * Saves (or, with an empty value, removes) the client's address. A non-empty
 * address needs the «клієнт погодився» checkbox — the 0066 check enforces
 * the same in the database.
 */
export async function setClientEmail(
  locale: Locale,
  galleryId: string,
  rawEmail: string,
  consent: boolean
): Promise<ClientEmailSaveResult> {
  const { user } = await requireUser()
  if (!user) return { ok: false, error: 'failed' }
  const trimmed = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  const email = trimmed ? parseClientEmail(trimmed) : null
  if (trimmed && !email) return { ok: false, error: 'invalid' }
  if (email && !consent) return { ok: false, error: 'consent' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, error: 'unavailable' }
  const { data, error } = await admin
    .from('galleries')
    .update(
      email
        ? { client_email: email, client_email_consent_at: new Date().toISOString() }
        : { client_email: null, client_email_consent_at: null }
    )
    .eq('id', galleryId)
    .eq('owner_id', user.id)
    .select('id')
  if (error) {
    if (isMissingColumn(error)) return { ok: false, error: 'unavailable' }
    console.error('setClientEmail failed', galleryId, error.message)
    return { ok: false, error: 'failed' }
  }
  if (!data?.length) return { ok: false, error: 'failed' }
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  return { ok: true }
}

/** «Надіслати ще раз». */
export async function sendClientReadyEmailAgain(locale: Locale, galleryId: string): Promise<ReadyEmailResult> {
  const { supabase, user } = await requireUser()
  if (!user) return 'not_found'
  const deps = await ownerReadyEmailDeps(supabase, user)
  if (!deps) return 'send_failed'
  const result = await sendReadyEmailAgain(deps, galleryId, user.id)
  revalidatePath(`/${locale}/dashboard/galleries/${galleryId}`)
  return result
}

/**
 * «Поділитися» → language of the link: remembered on the gallery (0072), so
 * «Ваші фото готові» goes in the same language with the same link. No-op
 * before the migration (the letter then uses the photographer's language).
 */
export async function rememberShareLocale(galleryId: string, shareLocale: string): Promise<boolean> {
  const { user } = await requireUser()
  if (!user) return false
  return saveShareLocale(galleryId, user.id, shareLocale)
}

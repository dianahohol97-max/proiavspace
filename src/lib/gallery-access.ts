import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { Gallery } from './types'

/**
 * Access control for password-protected public galleries.
 * After a correct password the client gets an httpOnly cookie holding an
 * HMAC of the gallery id and the current password hash — no session table
 * needed, nothing sensitive stored, and a new password revokes old cookies.
 */

function unlockSecret(): string {
  const secret = process.env.GALLERY_UNLOCK_SECRET
  if (secret) return secret
  // Fail closed in production: a hardcoded fallback here would let anyone
  // forge the HMAC unlock cookie for any gallery and bypass its password.
  // Locally we allow a dev-only value so setup works without every env var.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GALLERY_UNLOCK_SECRET is required in production')
  }
  return 'insecure-dev-secret'
}

export function unlockCookieName(galleryId: string): string {
  return `g_unlock_${galleryId}`
}

/**
 * The cookie is bound to the current password hash: when the photographer
 * changes the password, every cookie handed out for the old one stops working
 * at once instead of living out its 30 days (CL-05).
 */
export function unlockCookieValue(galleryId: string, passwordHash: string): string {
  return createHmac('sha256', unlockSecret()).update(`${galleryId}:${passwordHash}`).digest('hex')
}

/** True when the gallery has no password or the visitor holds a valid unlock cookie. */
export async function isGalleryUnlocked(gallery: Pick<Gallery, 'id' | 'has_password'>): Promise<boolean> {
  if (!gallery.has_password) return true
  const cookie = cookies().get(unlockCookieName(gallery.id))
  if (!cookie) return false
  // The hash is revoked from anon/authenticated at the column level, so only
  // the service role can read it. Without it, fail closed.
  const admin = createSupabaseAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from('galleries')
    .select('password_hash')
    .eq('id', gallery.id)
    .single<{ password_hash: string | null }>()
  if (!data?.password_hash) return false
  return cookie.value === unlockCookieValue(gallery.id, data.password_hash)
}

/**
 * Client for reading a public gallery's assets AFTER the caller has checked
 * isGalleryUnlocked. Anon RLS only exposes assets of open (password-less)
 * galleries (migration 0042), so a password gallery's assets are read with
 * the service role — the unlock cookie check above is what authorizes it.
 */
export function galleryAssetsClient(
  supabase: SupabaseClient,
  gallery: Pick<Gallery, 'has_password'>
): SupabaseClient {
  if (!gallery.has_password) return supabase
  return createSupabaseAdminClient() ?? supabase
}

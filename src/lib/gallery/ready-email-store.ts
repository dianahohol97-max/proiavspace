import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { greetingName } from '@/lib/email-layout'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  sendReadyEmailOnce,
  type ReadyEmailDeps,
  type ReadyEmailGallery,
  type ReadyEmailResult,
} from '@/lib/gallery/ready-email'

/**
 * Supabase side of «Ваші фото готові» (0064). client_email and
 * ready_email_sent_at are not granted to anon/authenticated (personal data on
 * a publicly readable table), so they are read and written with the service
 * role — and every query is pinned to owner_id, which the caller took from
 * the signed-in session.
 */

const GALLERY_COLUMNS =
  'id, title, slug, is_published, has_password, delivery_status, client_email, ready_email_sent_at'

/** PostgREST / Postgres «column does not exist» — 0064 not applied yet. */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '')
}

export function readyEmailDeps(
  admin: SupabaseClient,
  ownerId: string,
  owner: { email: string | null; displayName: string | null }
): ReadyEmailDeps {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://proiav.space',
    photographer: {
      name: greetingName(owner.displayName, owner.email),
      email: owner.email,
    },
    async load(galleryId) {
      const { data } = await admin
        .from('galleries')
        .select(GALLERY_COLUMNS)
        .eq('id', galleryId)
        .eq('owner_id', ownerId)
        .maybeSingle<ReadyEmailGallery>()
      return data ?? null
    },
    async claim(galleryId, expected, at) {
      let query = admin
        .from('galleries')
        .update({ ready_email_sent_at: at })
        .eq('id', galleryId)
        .eq('owner_id', ownerId)
      query = expected === null ? query.is('ready_email_sent_at', null) : query.eq('ready_email_sent_at', expected)
      const { data, error } = await query.select('id')
      if (error) {
        console.error('ready email claim failed', galleryId, error.message)
        return false
      }
      return (data?.length ?? 0) === 1
    },
    async release(galleryId, at, previous) {
      const { error } = await admin
        .from('galleries')
        .update({ ready_email_sent_at: previous })
        .eq('id', galleryId)
        .eq('owner_id', ownerId)
        .eq('ready_email_sent_at', at)
      if (error) console.error('ready email release failed', galleryId, error.message)
    },
    send: sendEmail,
  }
}

/** Deps for the signed-in owner, or null without a service role key. */
export async function ownerReadyEmailDeps(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<ReadyEmailDeps | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle<{ display_name: string | null }>()
  return readyEmailDeps(admin, user.id, {
    email: user.email ?? null,
    displayName: profile?.display_name ?? null,
  })
}

export interface ClientEmailState {
  /** false until migration 0064 is applied (or without a service role key). */
  available: boolean
  email: string | null
  sentAt: string | null
}

export async function loadClientEmailState(galleryId: string, ownerId: string): Promise<ClientEmailState> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { available: false, email: null, sentAt: null }
  const { data, error } = await admin
    .from('galleries')
    .select('client_email, ready_email_sent_at')
    .eq('id', galleryId)
    .eq('owner_id', ownerId)
    .maybeSingle<{ client_email: string | null; ready_email_sent_at: string | null }>()
  if (error) {
    if (!isMissingColumn(error)) console.error('client email state failed', galleryId, error.message)
    return { available: false, email: null, sentAt: null }
  }
  return { available: true, email: data?.client_email ?? null, sentAt: data?.ready_email_sent_at ?? null }
}

/**
 * The automatic letter, after the status became «Готово» or the gallery was
 * published. Never throws: a letter that could not go out must not fail the
 * status save (the photographer still has «Надіслати ще раз»).
 */
export async function notifyClientIfReady(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  galleryId: string
): Promise<ReadyEmailResult | null> {
  try {
    const deps = await ownerReadyEmailDeps(supabase, user)
    if (!deps) return null
    return await sendReadyEmailOnce(deps, galleryId, user.id)
  } catch (cause) {
    console.error('ready email failed', galleryId, cause)
    return null
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { getDictionary, type Dictionary } from '@/lib/i18n'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { bookingPushEnabled, isMissingTableError, type PushKind } from './kinds'

/**
 * Server side of the photographer's notifications (Web Push, VAPID).
 *
 * notifyOwner() is the one way out: it checks that push is configured, that
 * the photographer has this type on (push_preferences, migration 0068), that
 * this exact event was not sent already (push_deliveries) — and only then
 * sends to every subscribed device in that device's language. Subscriptions
 * the push service reports gone (404/410) are deleted.
 *
 * Everything degrades to «nothing is sent»: no VAPID keys, no service role,
 * migration not applied, no subscriptions. It never throws into the caller —
 * a notification must not break a selection, a booking or a page view.
 */

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

/** VAPID keys from the environment (Vercel); null until they are set. */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@proiav.space'
  return { publicKey, privateKey, subject }
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  locale: string
}

/** Database access notifyOwner needs; supabasePushStore() is the real one. */
export interface PushStore {
  /** Is this type on for the owner? 'missing_table' before migration 0068. */
  isEnabled(ownerId: string, kind: PushKind): Promise<boolean | 'missing_table'>
  subscriptions(ownerId: string): Promise<StoredSubscription[]>
  /** Records the event; false when it was already sent (or cannot be recorded). */
  claim(ownerId: string, kind: PushKind, dedupeKey: string): Promise<boolean>
  /** Undo claim() when no device got it, so a later event can try again. */
  release(ownerId: string, kind: PushKind, dedupeKey: string): Promise<void>
  removeSubscription(id: string): Promise<void>
  touchSubscription(id: string): Promise<void>
}

export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: webpush.RequestOptions
) => Promise<{ statusCode: number }>

const defaultSender: PushSender = (subscription, payload, options) =>
  webpush.sendNotification(subscription, payload, options)

export type AppDict = Dictionary['app']

/** What one device shows. path is inside the dashboard: '/dashboard/…'. */
export interface PushMessage {
  title: string
  body: string
  path: string
}

export interface NotifyInput {
  ownerId: string
  kind: PushKind | 'test'
  /** One event = one key: the same key is never sent twice for this kind. */
  dedupeKey: string
  /** Built per device, in that device's dashboard language. */
  message: (dict: AppDict, locale: Locale) => PushMessage
  /**
   * Last check, run only after the event was claimed (so a costly check —
   * «is the viewer the owner?» — runs once per event, not on every trigger).
   * false → the claim is released and nothing is sent.
   */
  guard?: () => Promise<boolean>
}

export type NotifyResult =
  | { status: 'sent'; delivered: number; removed: number; failed: number }
  | {
      status: 'skipped'
      reason: 'not_configured' | 'migration' | 'disabled' | 'no_subscriptions' | 'duplicate'
    }

export interface NotifyDeps {
  vapid?: VapidConfig | null
  store?: PushStore | null
  sender?: PushSender
}

/** The device's dashboard language; Ukrainian when unknown. */
export function pushLocale(locale: string | null | undefined): Locale {
  return locale && isLocale(locale) ? locale : 'uk'
}

export async function notifyOwner(input: NotifyInput, deps: NotifyDeps = {}): Promise<NotifyResult> {
  try {
    return await notifyOwnerUnsafe(input, deps)
  } catch (error) {
    console.error('push: notifyOwner failed', input.kind, error)
    return { status: 'sent', delivered: 0, removed: 0, failed: 1 }
  }
}

async function notifyOwnerUnsafe(input: NotifyInput, deps: NotifyDeps): Promise<NotifyResult> {
  const vapid = deps.vapid === undefined ? getVapidConfig() : deps.vapid
  if (!vapid) return { status: 'skipped', reason: 'not_configured' }
  const store = deps.store === undefined ? defaultStore() : deps.store
  if (!store) return { status: 'skipped', reason: 'not_configured' }
  const sender = deps.sender ?? defaultSender

  // Booking is shelved behind its flag: no «Нова заявка» at all.
  if (input.kind === 'booking' && !bookingPushEnabled()) return { status: 'skipped', reason: 'disabled' }

  if (input.kind !== 'test') {
    const enabled = await store.isEnabled(input.ownerId, input.kind)
    if (enabled === 'missing_table') return { status: 'skipped', reason: 'migration' }
    if (!enabled) return { status: 'skipped', reason: 'disabled' }
  }

  const subscriptions = await store.subscriptions(input.ownerId)
  if (subscriptions.length === 0) return { status: 'skipped', reason: 'no_subscriptions' }

  if (input.kind !== 'test' && !(await store.claim(input.ownerId, input.kind, input.dedupeKey))) {
    return { status: 'skipped', reason: 'duplicate' }
  }
  if (input.guard && !(await input.guard().catch(() => false))) {
    if (input.kind !== 'test') await store.release(input.ownerId, input.kind, input.dedupeKey).catch(() => {})
    return { status: 'skipped', reason: 'disabled' }
  }

  let delivered = 0
  let removed = 0
  let failed = 0
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const locale = pushLocale(subscription.locale)
      const message = input.message((await getDictionary(locale)).app, locale)
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        url: `/${locale}${message.path}`,
        // Same tag = the newer notification replaces the older one on the phone.
        tag: `${input.kind}:${input.dedupeKey}`.slice(0, 120),
        kind: input.kind,
      })
      try {
        await sender(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          {
            vapidDetails: vapid,
            TTL: 60 * 60 * 24,
            urgency: input.kind === 'booking' ? 'high' : 'normal',
            timeout: 10_000,
          }
        )
        delivered += 1
        await store.touchSubscription(subscription.id).catch(() => {})
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          // The browser dropped this subscription (app removed, permission revoked).
          removed += 1
          await store.removeSubscription(subscription.id).catch(() => {})
        } else {
          failed += 1
          console.error('push: send failed', statusCode ?? error)
        }
      }
    })
  )
  if (delivered === 0 && input.kind !== 'test') {
    await store.release(input.ownerId, input.kind, input.dedupeKey).catch(() => {})
  }
  return { status: 'sent', delivered, removed, failed }
}

function defaultStore(): PushStore | null {
  const admin = createSupabaseAdminClient()
  return admin ? supabasePushStore(admin) : null
}

/** PushStore over the service-role client (bypasses RLS; server only). */
export function supabasePushStore(admin: SupabaseClient): PushStore {
  return {
    async isEnabled(ownerId, kind) {
      const { data, error } = await admin
        .from('push_preferences')
        .select(kind)
        .eq('owner_id', ownerId)
        .maybeSingle<Record<string, boolean>>()
      if (isMissingTableError(error)) return 'missing_table'
      if (error) throw new Error(error.message)
      return data ? data[kind] !== false : true
    },
    async subscriptions(ownerId) {
      const { data, error } = await admin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, locale')
        .eq('owner_id', ownerId)
        .returns<StoredSubscription[]>()
      if (error) {
        if (isMissingTableError(error)) return []
        throw new Error(error.message)
      }
      return data ?? []
    },
    async claim(ownerId, kind, dedupeKey) {
      const { error } = await admin
        .from('push_deliveries')
        .insert({ owner_id: ownerId, kind, dedupe_key: dedupeKey.slice(0, 200) })
      if (!error) return true
      if (error.code !== '23505') console.error('push: claim failed', error.message)
      return false
    },
    async release(ownerId, kind, dedupeKey) {
      await admin
        .from('push_deliveries')
        .delete()
        .eq('owner_id', ownerId)
        .eq('kind', kind)
        .eq('dedupe_key', dedupeKey.slice(0, 200))
    },
    async removeSubscription(id) {
      await admin.from('push_subscriptions').delete().eq('id', id)
    },
    async touchSubscription(id) {
      await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', id)
    },
  }
}

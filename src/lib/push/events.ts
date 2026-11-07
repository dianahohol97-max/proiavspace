import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { formatSlotShort } from '@/lib/app/format'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EXPIRING_WITHIN_DAYS, STORAGE_LOW_THRESHOLD } from './kinds'
import { notifyOwner, type NotifyDeps, type NotifyResult } from './send'

/**
 * The five events a photographer can be notified about, each with its
 * dedupe key (push_deliveries): what makes two triggers «the same event».
 *
 *   client_picks      gallery + favorite/retouch + hour — a client ticking
 *                     30 photos is one notification, not 30
 *   first_view        gallery — once per gallery, ever; the photographer's
 *                     own visits do not count
 *   booking           slot — once per booking
 *   storage_low       month — at most one «місце закінчується» a month
 *   gallery_expiring  gallery + closing date — once per deadline
 */

const replace = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))

/** Kyiv wall-clock hour: «2026-11-07T14». */
function hourBucket(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .replace(' ', 'T')
}

interface GalleryOwnerRow {
  id: string
  owner_id: string
  title: string
}

async function galleryOwner(admin: SupabaseClient, galleryId: string): Promise<GalleryOwnerRow | null> {
  const { data } = await admin
    .from('galleries')
    .select('id, owner_id, title')
    .eq('id', galleryId)
    .maybeSingle<GalleryOwnerRow>()
  return data ?? null
}

type Deps = NotifyDeps & { admin?: SupabaseClient | null; now?: Date }

const skippedNoAdmin: NotifyResult = { status: 'skipped', reason: 'not_configured' }

/** A client marked a photo as favorite or for retouch (selected = true only). */
export async function notifyClientPick(galleryId: string, pick: 'favorite' | 'retouch', deps: Deps = {}): Promise<NotifyResult> {
  const admin = deps.admin === undefined ? createSupabaseAdminClient() : deps.admin
  if (!admin) return skippedNoAdmin
  const gallery = await galleryOwner(admin, galleryId)
  if (!gallery) return skippedNoAdmin
  return notifyOwner(
    {
      ownerId: gallery.owner_id,
      kind: 'client_picks',
      dedupeKey: `${gallery.id}:${pick}:${hourBucket(deps.now ?? new Date())}`,
      message: (t) => ({
        title: pick === 'retouch' ? t.pushRetouchTitle : t.pushPicksTitle,
        body: replace(pick === 'retouch' ? t.pushRetouchBody : t.pushPicksBody, { gallery: gallery.title }),
        path: `/dashboard/galleries/${gallery.id}`,
      }),
    },
    deps
  )
}

/**
 * Someone opened the public gallery. resolveViewer() names the signed-in
 * visitor (null for clients); it runs only while the gallery's first view is
 * still unclaimed, so the auth lookup does not happen on every page view.
 */
export async function notifyFirstView(
  galleryId: string,
  resolveViewer: () => Promise<string | null>,
  deps: Deps = {}
): Promise<NotifyResult> {
  const admin = deps.admin === undefined ? createSupabaseAdminClient() : deps.admin
  if (!admin) return skippedNoAdmin
  const gallery = await galleryOwner(admin, galleryId)
  if (!gallery) return skippedNoAdmin
  return notifyOwner(
    {
      ownerId: gallery.owner_id,
      kind: 'first_view',
      dedupeKey: `gallery:${gallery.id}`,
      message: (t) => ({
        title: t.pushFirstViewTitle,
        body: replace(t.pushFirstViewBody, { gallery: gallery.title }),
        path: `/dashboard/galleries/${gallery.id}`,
      }),
      // The photographer previewing their own gallery is not «a client opened it».
      guard: async () => (await resolveViewer()) !== gallery.owner_id,
    },
    deps
  )
}

export async function notifyBooking(
  slot: { id: string; owner_id: string; starts_at: string },
  clientName: string,
  deps: NotifyDeps = {}
): Promise<NotifyResult> {
  return notifyOwner(
    {
      ownerId: slot.owner_id,
      kind: 'booking',
      dedupeKey: `slot:${slot.id}`,
      message: (t) => ({
        title: t.pushBookingTitle,
        body: replace(t.pushBookingBody, { name: clientName.trim().slice(0, 60), date: formatSlotShort(slot.starts_at) }),
        path: '/dashboard/booking',
      }),
    },
    deps
  )
}

export function formatBytesShort(bytes: number): string {
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.max(Math.round(bytes / 1024 ** 2), 0)} MB`
}

export interface StorageProfile {
  user_id: string
  plan: string
  grace_until: string | null
  storage_used_bytes: number
  storage_limit_bytes: number
}

/** Used share of the limit that actually gates uploads (as the dashboard meter). */
export function storageShare(profile: StorageProfile): { share: number; limit: number } {
  const limit = Math.min(
    profile.storage_limit_bytes,
    planStorageBytes(effectiveGalleryPlan(profile.plan, profile.grace_until))
  )
  return { share: limit > 0 ? profile.storage_used_bytes / limit : 0, limit }
}

export async function notifyStorageIfLow(profile: StorageProfile, deps: Deps = {}): Promise<NotifyResult | null> {
  const { share, limit } = storageShare(profile)
  if (limit <= 0 || share < STORAGE_LOW_THRESHOLD) return null
  const month = hourBucket(deps.now ?? new Date()).slice(0, 7)
  return notifyOwner(
    {
      ownerId: profile.user_id,
      kind: 'storage_low',
      dedupeKey: `month:${month}`,
      message: (t) => ({
        title: t.pushStorageTitle,
        body: replace(t.pushStorageBody, {
          pct: Math.min(Math.round(share * 100), 100),
          used: formatBytesShort(profile.storage_used_bytes),
          limit: formatBytesShort(limit),
        }),
        path: '/dashboard/billing',
      }),
    },
    deps
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days left until `closesAt`, rounded up (closing in 5 h = 1 day). */
export function daysUntil(closesAt: string, now: Date): number {
  return Math.max(Math.ceil((new Date(closesAt).getTime() - now.getTime()) / DAY_MS), 0)
}

export interface ExpiringGallery {
  id: string
  owner_id: string
  title: string
  /** expires_at (set by the photographer) or free_expires_at (Free plan), whichever is sooner. */
  closes_at: string
}

export async function notifyGalleryExpiring(gallery: ExpiringGallery, deps: Deps = {}): Promise<NotifyResult> {
  const days = Math.max(daysUntil(gallery.closes_at, deps.now ?? new Date()), 1)
  return notifyOwner(
    {
      ownerId: gallery.owner_id,
      kind: 'gallery_expiring',
      dedupeKey: `${gallery.id}:${gallery.closes_at.slice(0, 10)}`,
      message: (t) => ({
        title: t.pushExpiringTitle,
        body: replace(t.pushExpiringBody, { gallery: gallery.title, n: days }),
        path: `/dashboard/galleries/${gallery.id}`,
      }),
    },
    deps
  )
}

/** The sooner of the two deadlines, if it falls within the window from now. */
export function closingDeadline(
  row: { expires_at: string | null; free_expires_at: string | null; free_expired_at: string | null },
  now: Date,
  withinDays = EXPIRING_WITHIN_DAYS
): string | null {
  const candidates = [row.expires_at, row.free_expired_at ? null : row.free_expires_at].filter(
    (value): value is string => typeof value === 'string'
  )
  const upcoming = candidates
    .filter((value) => {
      const t = new Date(value).getTime()
      return t > now.getTime() && t <= now.getTime() + withinDays * DAY_MS
    })
    .sort()
  return upcoming[0] ?? null
}

export { formatSlotShort }

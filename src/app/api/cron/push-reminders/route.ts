import { NextResponse, type NextRequest } from 'next/server'
import {
  closingDeadline,
  notifyGalleryExpiring,
  notifyStorageIfLow,
  type StorageProfile,
} from '@/lib/push/events'
import { EXPIRING_WITHIN_DAYS } from '@/lib/push/kinds'
import { getVapidConfig } from '@/lib/push/send'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Daily (vercel.json) push reminders for photographers who turned them on:
 *   - «Галерея скоро закриється»: expires_at or the Free plan's
 *     free_expires_at within EXPIRING_WITHIN_DAYS days;
 *   - «Місце в сховищі закінчується»: ≥ 90% of the effective limit.
 * Only owners with at least one push subscription are looked at, so the run
 * is cheap. Dedupe (push_deliveries) makes a re-run harmless. Also prunes the
 * delivery log older than 120 days (except first_view). Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!getVapidConfig()) return NextResponse.json({ skipped: 'not_configured' })
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'service_not_configured' }, { status: 503 })

  const now = new Date()
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('owner_id')
    .returns<{ owner_id: string }[]>()
  if (subsError) return NextResponse.json({ skipped: 'migration', error: subsError.message })
  const owners = Array.from(new Set((subs ?? []).map((row) => row.owner_id)))
  const summary = { owners: owners.length, expiring: 0, storage: 0, pruned: false }
  if (owners.length === 0) return NextResponse.json(summary)

  const horizon = new Date(now.getTime() + EXPIRING_WITHIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  for (let i = 0; i < owners.length; i += 200) {
    const chunk = owners.slice(i, i + 200)
    const [{ data: galleries }, { data: profiles }] = await Promise.all([
      admin
        .from('galleries')
        .select('id, owner_id, title, expires_at, free_expires_at, free_expired_at')
        .in('owner_id', chunk)
        .eq('is_published', true)
        .or(`and(expires_at.gt.${now.toISOString()},expires_at.lte.${horizon}),and(free_expires_at.gt.${now.toISOString()},free_expires_at.lte.${horizon})`)
        .returns<
          { id: string; owner_id: string; title: string; expires_at: string | null; free_expires_at: string | null; free_expired_at: string | null }[]
        >(),
      admin
        .from('profiles')
        .select('user_id, plan, grace_until, storage_used_bytes, storage_limit_bytes')
        .in('user_id', chunk)
        .returns<StorageProfile[]>(),
    ])
    for (const gallery of galleries ?? []) {
      const closesAt = closingDeadline(gallery, now)
      if (!closesAt) continue
      const result = await notifyGalleryExpiring({ ...gallery, closes_at: closesAt }, { now })
      if (result.status === 'sent' && result.delivered > 0) summary.expiring += 1
    }
    for (const profile of profiles ?? []) {
      const result = await notifyStorageIfLow(profile, { now })
      if (result?.status === 'sent' && result.delivered > 0) summary.storage += 1
    }
  }

  const cutoff = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString()
  // first_view stays forever: it is «once per gallery», not «once per window».
  const { error: pruneError } = await admin
    .from('push_deliveries')
    .delete()
    .lt('sent_at', cutoff)
    .neq('kind', 'first_view')
  summary.pruned = !pruneError
  return NextResponse.json(summary)
}

import { NextResponse, type NextRequest } from 'next/server'
import {
  FREE_PURGE_AFTER_DAYS,
  planFreeGallery,
  type FreeGallery,
  type FreeNoticeKind,
} from '@/lib/free-expiry'
import { freeExpiryWarningEmail } from '@/lib/lifecycle-emails'
import { contactOf, send } from '@/lib/lifecycle-notify'
import { syncPartners, type PartnerSyncSummary } from '@/lib/partners'
import { getStorage } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Galleries whose files may be deleted in one run. */
const MAX_PURGES_PER_RUN = 50
/** More than this due at once means the data is wrong — delete nothing. */
const ABORT_IF_PURGES_DUE_OVER = 300

type Mode = 'dry-run' | 'notify' | 'live'
type Admin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>

interface Candidate {
  gallery_id: string
  owner_id: string
  title: string
  free_expires_at: string
  free_expired_at: string | null
  asset_count: number
  owner_paid: boolean
}

/**
 * Daily 03:00 UTC (vercel.json). First the partner periods (migration 0051,
 * lib/partners): start, end (back to Free, galleries get 30 days), 7-day
 * letter. Then the Free plan's 30-day galleries
 * (src/lib/free-expiry.ts, migration 0049). Per gallery: warning e-mails
 * 7 days and 1 day before (one letter per owner per run), closure past the
 * deadline, file deletion 7 days after closure. Protected by CRON_SECRET.
 *
 * FREE_EXPIRY_MODE (env): live (default) — everything; notify — letters and
 * closures, never deletes files; dry-run — report only. `?dry=1` forces a dry run.
 * A failed read stops the run before anything is written.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'service_not_configured' }, { status: 503 })
  }
  const envMode = process.env.FREE_EXPIRY_MODE
  const mode: Mode =
    new URL(request.url).searchParams.get('dry') === '1'
      ? 'dry-run'
      : envMode === 'dry-run' || envMode === 'notify'
        ? envMode
        : 'live'
  const now = Date.now()

  // Partners first: a period that ended today hands its galleries a deadline
  // that the pass below already sees.
  let partners: PartnerSyncSummary
  try {
    partners = await syncPartners(admin, { dryRun: mode === 'dry-run' })
  } catch (cause) {
    console.error('free-expiry: partner sync failed', cause)
    return NextResponse.json({ error: 'db_read_failed', table: 'partner_periods' }, { status: 500 })
  }

  const { data: rows, error } = await admin.rpc('free_expiry_candidates')
  if (error) {
    console.error('free-expiry: candidates read failed', error.message)
    return NextResponse.json({ error: 'db_read_failed', table: 'galleries' }, { status: 500 })
  }
  const candidates = (rows ?? []) as Candidate[]

  const sent = new Map<string, Partial<Record<FreeNoticeKind, string>>>()
  const ids = candidates.map((c) => c.gallery_id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data: notices, error: noticeError } = await admin
      .from('free_expiry_notices')
      .select('gallery_id, cycle, kind, sent_at')
      .in('gallery_id', ids.slice(i, i + 200))
    if (noticeError) {
      console.error('free-expiry: notices read failed', noticeError.message)
      return NextResponse.json({ error: 'db_read_failed', table: 'free_expiry_notices' }, { status: 500 })
    }
    for (const n of (notices ?? []) as { gallery_id: string; cycle: string; kind: FreeNoticeKind; sent_at: string }[]) {
      const gallery = candidates.find((c) => c.gallery_id === n.gallery_id)
      if (!gallery || new Date(n.cycle).getTime() !== new Date(gallery.free_expires_at).getTime()) continue
      const entry = sent.get(n.gallery_id) ?? {}
      entry[n.kind] = n.sent_at
      sent.set(n.gallery_id, entry)
    }
  }

  const planned = candidates.map((c) => {
    const gallery: FreeGallery = {
      galleryId: c.gallery_id,
      expiresAt: c.free_expires_at,
      expiredAt: c.free_expired_at,
      assetCount: Number(c.asset_count),
      ownerPaid: c.owner_paid,
    }
    return { candidate: c, action: planFreeGallery(gallery, sent.get(c.gallery_id) ?? {}, now) }
  })

  const purgesDue = planned.filter((p) => p.action.type === 'purge').length
  const summary = {
    mode,
    partners,
    scanned: candidates.length,
    notified: { d7: 0, d1: 0 } as Record<FreeNoticeKind, number>,
    letters: 0,
    expired: 0,
    purged: 0,
    purgedObjects: 0,
    purgesDue,
    purgesDeferred: 0,
    emailFailures: 0,
    errors: 0,
    planned: planned
      .filter((p) => p.action.type !== 'none')
      .map((p) => ({
        galleryId: p.candidate.gallery_id,
        action: p.action.type === 'notify' ? `notify:${p.action.kind}` : p.action.type,
      })),
  }
  if (purgesDue > ABORT_IF_PURGES_DUE_OVER) {
    console.error('free-expiry: too many purges due at once, refusing', purgesDue)
    return NextResponse.json({ ...summary, error: 'too_many_purges_due' }, { status: 500 })
  }
  if (mode === 'dry-run') return NextResponse.json(summary)

  // 1. Warnings, grouped: one letter per owner and kind.
  const letters = new Map<string, { owner: string; kind: FreeNoticeKind; items: typeof planned }>()
  for (const p of planned) {
    if (p.action.type !== 'notify') continue
    const key = `${p.candidate.owner_id}:${p.action.kind}`
    const letter = letters.get(key) ?? { owner: p.candidate.owner_id, kind: p.action.kind, items: [] }
    letter.items.push(p)
    letters.set(key, letter)
  }
  for (const letter of letters.values()) {
    try {
      const delivered = await sendWarning(admin, letter.owner, letter.kind, letter.items)
      if (delivered) {
        summary.letters += 1
        summary.notified[letter.kind] += letter.items.length
      } else {
        summary.emailFailures += 1
      }
    } catch (cause) {
      summary.errors += 1
      console.error('free-expiry: warning failed', letter.owner, cause)
    }
  }

  // 2. Closures. Conditional: a payment that cleared the deadline meanwhile wins.
  for (const p of planned) {
    if (p.action.type !== 'expire') continue
    const { data, error: expireError } = await admin
      .from('galleries')
      .update({ free_expired_at: new Date().toISOString() })
      .eq('id', p.candidate.gallery_id)
      .is('free_expired_at', null)
      .lte('free_expires_at', new Date().toISOString())
      .select('id')
    if (expireError) {
      summary.errors += 1
      console.error('free-expiry: close failed', p.candidate.gallery_id, expireError.message)
    } else {
      summary.expired += data?.length ?? 0
    }
  }

  // 3. Deletion: rows first (atomic re-check in SQL), then the bucket.
  for (const p of planned) {
    if (p.action.type !== 'purge') continue
    if (mode !== 'live' || summary.purged >= MAX_PURGES_PER_RUN) {
      summary.purgesDeferred += 1
      continue
    }
    try {
      const { data: keys, error: purgeError } = await admin.rpc('purge_free_gallery', {
        p_gallery: p.candidate.gallery_id,
        p_days: FREE_PURGE_AFTER_DAYS,
      })
      if (purgeError) throw new Error(purgeError.message)
      if (!Array.isArray(keys)) continue // refused: paying again or reopened
      const prefix = `u/${p.candidate.owner_id}/g/${p.candidate.gallery_id}/`
      const owned = (keys as string[]).filter((key) => key.startsWith(prefix))
      const storage = getStorage()
      for (let i = 0; i < owned.length; i += 1000) await storage.delete(owned.slice(i, i + 1000))
      summary.purged += 1
      summary.purgedObjects += owned.length
    } catch (cause) {
      // Rows may be gone already: the orphan cron removes leftover objects.
      summary.errors += 1
      console.error('free-expiry: purge failed', p.candidate.gallery_id, cause)
    }
  }

  console.log('free-expiry:', JSON.stringify({ ...summary, planned: summary.planned.length }))
  return NextResponse.json(summary)
}

/**
 * Journal first (two overlapping runs can't both send), then send; a failed
 * send removes the journal rows so tomorrow retries.
 */
async function sendWarning(
  admin: Admin,
  ownerId: string,
  kind: FreeNoticeKind,
  items: { candidate: Candidate; action: { type: string; alsoMark?: FreeNoticeKind[] } }[]
): Promise<boolean> {
  const rows = items.map((i) => ({ gallery_id: i.candidate.gallery_id, cycle: i.candidate.free_expires_at, kind }))
  const { data: fresh, error } = await admin
    .from('free_expiry_notices')
    .upsert(rows, { onConflict: 'gallery_id,cycle,kind', ignoreDuplicates: true })
    .select('gallery_id')
  if (error) throw new Error(`free_expiry_notices: ${error.message}`)
  const freshIds = new Set(((fresh ?? []) as { gallery_id: string }[]).map((r) => r.gallery_id))
  const mine = items.filter((i) => freshIds.has(i.candidate.gallery_id))
  if (mine.length === 0) return true

  const contact = await contactOf(admin, ownerId)
  const delivered =
    !!contact &&
    (await send(
      contact,
      freeExpiryWarningEmail({
        name: contact.name,
        daysLeft: kind === 'd1' ? 1 : 7,
        galleries: mine.map((i) => ({ title: i.candidate.title, closesAt: new Date(i.candidate.free_expires_at) })),
      })
    ))
  if (!delivered) {
    await admin
      .from('free_expiry_notices')
      .delete()
      .in('gallery_id', mine.map((i) => i.candidate.gallery_id))
      .eq('kind', kind)
    return false
  }
  const also = mine.flatMap((i) =>
    (i.action.alsoMark ?? []).map((k) => ({ gallery_id: i.candidate.gallery_id, cycle: i.candidate.free_expires_at, kind: k }))
  )
  if (also.length > 0) {
    await admin.from('free_expiry_notices').upsert(also, { onConflict: 'gallery_id,cycle,kind', ignoreDuplicates: true })
  }
  return true
}

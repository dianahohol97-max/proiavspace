import { NextResponse, type NextRequest } from 'next/server'
import {
  closedEmail,
  deletionWarningEmail,
  graceStartEmail,
  type EmailMessage,
} from '@/lib/lifecycle-emails'
import { contactOf, recordNotice, send, type Contact } from '@/lib/lifecycle-notify'
import { GRACE_PERIOD_DAYS } from '@/lib/plans'
import {
  DAY_MS,
  FREE_LIMIT_BYTES,
  RETENTION_DAYS,
  planRetention,
  type NoticeKind,
  type RetentionAccount,
  type RetentionAction,
  type SentNotices,
} from '@/lib/retention'
import { getStorage } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Accounts whose files may be deleted in one run. */
const MAX_DELETIONS_PER_RUN = 5
/**
 * More accounts due for deletion than this at once means the data is wrong
 * (a mass-reset of grace_until, a bad migration) — stop and delete nothing.
 */
const ABORT_IF_DELETIONS_DUE_OVER = 25

type Mode = 'dry-run' | 'notify' | 'live'

/**
 * Daily plan-lifecycle sweep (audit LC-01). Rules: src/lib/retention.ts.
 * Order per account: e-mail → closure → deletion; a step never runs unless
 * the one before it went out. Protected by CRON_SECRET.
 *
 * RETENTION_MODE (env) decides how far it may go — default is a dry run:
 *   dry-run  report what would happen; no e-mails, no writes;
 *   notify   send e-mails and close galleries, never delete files;
 *   live     everything, including deleting files from B2.
 * `?dry=1` forces a dry run whatever the env says.
 *
 * Any database read error stops the run before anything is written.
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
  const envMode = process.env.RETENTION_MODE
  const mode: Mode =
    new URL(request.url).searchParams.get('dry') === '1'
      ? 'dry-run'
      : envMode === 'live' || envMode === 'notify'
        ? envMode
        : 'dry-run'
  const now = Date.now()

  // 1. Read everything first. A failed read = no writes at all.
  const { data: rows, error: rowsError } = await admin
    .from('profiles')
    .select('user_id, plan, grace_until, gallery_closed_at, storage_used_bytes, is_ambassador')
    .or(
      `gallery_closed_at.not.is.null,and(plan.neq.free,grace_until.lt."${new Date(now + GRACE_PERIOD_DAYS * DAY_MS).toISOString()}")`
    )
  if (rowsError) {
    console.error('retention: profiles read failed', rowsError.message)
    return NextResponse.json({ error: 'db_read_failed', table: 'profiles' }, { status: 500 })
  }
  const accounts = (rows ?? []) as {
    user_id: string
    plan: string
    grace_until: string | null
    gallery_closed_at: string | null
    storage_used_bytes: number
    is_ambassador: boolean | null
  }[]
  const ids = accounts.map((a) => a.user_id)

  const notices = new Map<string, SentNotices>()
  if (ids.length > 0) {
    const { data: noticeRows, error: noticeError } = await admin
      .from('lifecycle_notices')
      .select('user_id, cycle, kind, sent_at')
      .in('user_id', ids)
    if (noticeError) {
      console.error('retention: notices read failed', noticeError.message)
      return NextResponse.json({ error: 'db_read_failed', table: 'lifecycle_notices' }, { status: 500 })
    }
    for (const row of (noticeRows ?? []) as { user_id: string; cycle: string; kind: NoticeKind; sent_at: string }[]) {
      const account = accounts.find((a) => a.user_id === row.user_id)
      if (!account?.grace_until || new Date(row.cycle).getTime() !== new Date(account.grace_until).getTime()) continue
      const entry = notices.get(row.user_id) ?? {}
      entry[row.kind] = row.sent_at
      notices.set(row.user_id, entry)
    }
  }

  // Partner accounts (0051) carry grace_until = end of the period; their end
  // is handled by the partner sync (back to Free + 30 days for galleries), not
  // by this 14 + 60 road.
  const partnerUsers = new Set<string>()
  if (ids.length > 0) {
    const { data: partnerRows, error: partnerError } = await admin
      .from('partner_periods')
      .select('user_id')
      .in('user_id', ids)
      .is('finished_at', null)
    if (partnerError) {
      console.error('retention: partner_periods read failed', partnerError.message)
      return NextResponse.json({ error: 'db_read_failed', table: 'partner_periods' }, { status: 500 })
    }
    for (const row of (partnerRows ?? []) as { user_id: string }[]) partnerUsers.add(row.user_id)
  }

  const plans = accounts
    .filter((a) => !a.is_ambassador && !partnerUsers.has(a.user_id))
    .map((a) => {
      const account: RetentionAccount = {
        userId: a.user_id,
        plan: a.plan,
        graceUntil: a.grace_until,
        galleryClosedAt: a.gallery_closed_at,
        storageUsedBytes: Number(a.storage_used_bytes),
      }
      return { account, plan: planRetention(account, notices.get(a.user_id) ?? {}, now) }
    })

  const deletionsDue = plans.filter((p) => p.plan.actions.some((x) => x.type === 'delete')).length
  const summary = {
    mode,
    scanned: plans.length,
    reopened: 0,
    normalized: 0,
    notified: { grace_start: 0, closed: 0, delete_30: 0, delete_7: 0, delete_1: 0 } as Record<string, number>,
    closed: 0,
    deleted: 0,
    deletedObjects: 0,
    deletionsDue,
    deletionsDeferred: 0,
    emailFailures: 0,
    errors: 0,
    planned: [] as { userId: string; state: string; actions: string[] }[],
  }

  if (deletionsDue > ABORT_IF_DELETIONS_DUE_OVER) {
    console.error('retention: too many deletions due at once, refusing', deletionsDue)
    return NextResponse.json({ ...summary, error: 'too_many_deletions_due' }, { status: 500 })
  }

  for (const { account, plan } of plans) {
    if (plan.actions.length === 0) continue
    summary.planned.push({
      userId: account.userId,
      state: plan.state,
      actions: plan.actions.map((a) => (a.type === 'notify' ? `notify:${a.kind}` : a.type)),
    })
    if (mode === 'dry-run') continue
    try {
      for (const action of plan.actions) {
        const ok = await apply(admin, account, plan.cycle, action, mode, summary)
        if (!ok) break // letter → closure → deletion: stop at the first step that did not happen
      }
    } catch (cause) {
      summary.errors += 1
      console.error('retention: account failed', account.userId, cause)
    }
  }

  console.log('retention:', JSON.stringify({ ...summary, planned: summary.planned.length }))
  return NextResponse.json(summary)
}

type Admin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>
type Summary = {
  reopened: number
  normalized: number
  notified: Record<string, number>
  closed: number
  deleted: number
  deletedObjects: number
  deletionsDeferred: number
  emailFailures: number
}

async function apply(
  admin: Admin,
  account: RetentionAccount,
  cycle: string | null,
  action: RetentionAction,
  mode: Exclude<Mode, 'dry-run'>,
  summary: Summary
): Promise<boolean> {
  const userId = account.userId

  if (action.type === 'reopen') {
    const { error } = await admin.from('profiles').update({ gallery_closed_at: null }).eq('user_id', userId)
    if (error) throw new Error(error.message)
    summary.reopened += 1
    return true
  }

  if (action.type === 'normalize') {
    // Fits into Free: a plain Free account, galleries open, nothing to delete.
    const { error } = await admin
      .from('profiles')
      .update({ plan: 'free', storage_limit_bytes: FREE_LIMIT_BYTES, grace_until: null, gallery_closed_at: null })
      .eq('user_id', userId)
      .lte('storage_used_bytes', FREE_LIMIT_BYTES)
    if (error) throw new Error(error.message)
    summary.normalized += 1
    return true
  }

  if (!cycle) return false
  const contact = await contactOf(admin, userId)
  if (!contact) return false

  if (action.type === 'notify' && action.kind === 'grace_start') {
    const { data: promo } = await admin
      .from('promo_grants')
      .select('ends_at, autopay_at')
      .eq('user_id', userId)
      .maybeSingle()
    const endedAt = new Date(new Date(cycle).getTime() - GRACE_PERIOD_DAYS * DAY_MS)
    const isPromo =
      !!promo && !promo.autopay_at && Math.abs(new Date(promo.ends_at).getTime() - endedAt.getTime()) < DAY_MS
    return notify(admin, userId, cycle, 'grace_start', [], summary, contact, () =>
      graceStartEmail({ name: contact.name, plan: account.plan, promo: isPromo, endedAt, closesAt: action.closesAt })
    )
  }

  if (action.type === 'close') {
    const galleryCount = await countGalleries(admin, userId)
    const sent = await notify(admin, userId, cycle, 'closed', [], summary, contact, () =>
      closedEmail({ name: contact.name, plan: account.plan, galleryCount, deletesAt: action.deletesAt })
    )
    if (!sent) return false
    const { error } = await admin
      .from('profiles')
      .update({ gallery_closed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('gallery_closed_at', null)
    if (error) throw new Error(error.message)
    summary.closed += 1
    return true
  }

  if (action.type === 'notify') {
    const daysLeft = Number(action.kind.slice('delete_'.length)) as 30 | 7 | 1
    const [galleryCount, fileCount] = await Promise.all([countGalleries(admin, userId), countFiles(admin, userId)])
    return notify(admin, userId, cycle, action.kind, action.alsoMark, summary, contact, () =>
      deletionWarningEmail({
        name: contact.name,
        daysLeft,
        deletesAt: action.deletesAt,
        galleryCount,
        fileCount,
        usedBytes: account.storageUsedBytes,
      })
    )
  }

  // action.type === 'delete'
  if (mode !== 'live') {
    summary.deletionsDeferred += 1
    return false
  }
  if (summary.deleted >= MAX_DELETIONS_PER_RUN) {
    summary.deletionsDeferred += 1
    return false
  }
  const removed = await deleteAccountMedia(userId)
  summary.deletedObjects += removed
  const { data: finished, error } = await admin.rpc('finish_retention_deletion', {
    p_user: userId,
    p_retention_days: RETENTION_DAYS,
  })
  if (error) throw new Error(error.message)
  if (finished === true) {
    await recordNotice(admin, userId, cycle, 'deleted')
    summary.deleted += 1
  }
  return finished === true
}

/**
 * Journal first (so two overlapping runs can't both write), then send. A
 * failed send removes the journal row again — tomorrow retries, and the next
 * step (closure / deletion) waits for it.
 */
async function notify(
  admin: Admin,
  userId: string,
  cycle: string,
  kind: NoticeKind,
  alsoMark: NoticeKind[],
  summary: Summary,
  contact: Contact,
  build: () => EmailMessage
): Promise<boolean> {
  const fresh = await recordNotice(admin, userId, cycle, kind)
  if (!fresh) return true
  const delivered = await send(contact, build())
  if (!delivered) {
    await admin.from('lifecycle_notices').delete().eq('user_id', userId).eq('cycle', cycle).eq('kind', kind)
    summary.emailFailures += 1
    return false
  }
  for (const other of alsoMark) await recordNotice(admin, userId, cycle, other)
  summary.notified[kind] = (summary.notified[kind] ?? 0) + 1
  return true
}

async function countGalleries(admin: Admin, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('galleries')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countFiles(admin: Admin, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('assets')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Removes the account's gallery and portfolio media from storage. Only the
 * media prefixes of THIS account (u/<id>/g/, u/<id>/portfolio/) — logos and
 * anything else stay. Throws on a storage error, so the DB rows (and the
 * files they point to) stay until the next run.
 */
async function deleteAccountMedia(userId: string): Promise<number> {
  const storage = getStorage()
  let removed = 0
  for (const prefix of [`u/${userId}/g/`, `u/${userId}/portfolio/`]) {
    const objects = await storage.list(prefix)
    const keys = objects.map((o) => o.key).filter((key) => key.startsWith(prefix))
    for (let i = 0; i < keys.length; i += 1000) {
      await storage.delete(keys.slice(i, i + 1000))
    }
    removed += keys.length
  }
  return removed
}

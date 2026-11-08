import { NextResponse, type NextRequest } from 'next/server'
import { reportServerError } from '@/lib/sentry/report'
import { getStorage } from '@/lib/storage'
import { asPurgeStorage, purgeDryRun, purgeStorageQueue } from '@/lib/storage/purge'
import { supabasePurgeQueue } from '@/lib/storage/purge-queue'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Hourly drain of public.storage_purge_queue (audit LC-02, migration 0057):
 * deletes the files of deleted accounts from B2, every version, and marks the
 * rows purged. Rules and safety checks: src/lib/storage/purge.ts. Protected
 * by CRON_SECRET like the other crons.
 *
 * STORAGE_PURGE_MODE (env): `live` deletes; anything else (default) is a dry
 * run — lists and logs what would go, deletes and writes nothing.
 * `?dry=1` forces a dry run whatever the env says.
 *
 * Without the table (0057 not applied yet) it answers 200 and does nothing.
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
  const dryRun = purgeDryRun(
    process.env.STORAGE_PURGE_MODE,
    new URL(request.url).searchParams.get('dry') === '1'
  )
  const reports: Promise<void>[] = []
  try {
    const summary = await purgeStorageQueue(
      supabasePurgeQueue(admin),
      asPurgeStorage(getStorage()),
      {
        dryRun,
        report: (error, context) => {
          reports.push(reportServerError(error, { cron: 'storage-purge', ...context }))
        },
      }
    )
    await Promise.all(reports)
    if (summary.skipped) {
      console.log('storage purge: queue table missing (migration 0057 not applied) — skipped')
    } else {
      console.log('storage purge:', JSON.stringify(summary))
    }
    return NextResponse.json(summary)
  } catch (cause) {
    // Queue unreadable or storage not configured: nothing was deleted.
    console.error('storage purge: run failed', cause)
    await Promise.all([...reports, reportServerError(cause, { cron: 'storage-purge' })])
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 })
  }
}

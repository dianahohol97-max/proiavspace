import { NextResponse, type NextRequest } from 'next/server'
import { getStorage } from '@/lib/storage'
import { orphanKeys, referencedKeys, staleMultipartUploads } from '@/lib/storage/cleanup'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Per run — keeps one sweep well inside the function's time budget. */
const MAX_DELETES_PER_RUN = 2000
const PAGE = 1000

/**
 * Daily sweep of what the upload flow can leave behind in the bucket and
 * never counts against a quota (audit ST-02 / ST-03): objects PUT via a
 * presigned URL whose /complete never came, and multipart uploads that were
 * never finished. Rules live in lib/storage/cleanup.ts. Protected by
 * CRON_SECRET like /api/billing/renew. Only media prefixes are touched —
 * logos, social videos and anything else are never listed for deletion.
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
  const storage = getStorage()

  // 1. Every key the database knows about (originals + renditions).
  const referenced = new Set<string>()
  for (const table of ['assets', 'portfolio_assets'] as const) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from(table)
        .select('r2_key, variants')
        .range(from, from + PAGE - 1)
        .returns<{ r2_key: string; variants: Record<string, string> | null }[]>()
      if (error) {
        // A partial picture would delete live files: stop, retry tomorrow.
        console.error('storage cleanup: listing rows failed', table, error.message)
        return NextResponse.json({ error: 'db_read_failed', table }, { status: 500 })
      }
      for (const key of referencedKeys(data ?? [])) referenced.add(key)
      if (!data || data.length < PAGE) break
    }
  }

  // 2. Objects in the bucket nobody references, older than a day.
  const objects = await storage.list('u/')
  const orphans = orphanKeys(objects, referenced).slice(0, MAX_DELETES_PER_RUN)
  const orphanBytes = objects
    .filter((object) => orphans.includes(object.key))
    .reduce((sum, object) => sum + object.sizeBytes, 0)
  if (orphans.length > 0) await storage.delete(orphans)

  // 3. Multipart uploads left open for more than a day.
  const stale = staleMultipartUploads(await storage.listMultipartUploads('u/'))
  let aborted = 0
  for (const upload of stale) {
    try {
      await storage.abortMultipartUpload(upload.key, upload.uploadId)
      aborted += 1
    } catch (cause) {
      console.error('storage cleanup: abort failed', upload.key, cause)
    }
  }

  const summary = {
    scanned: objects.length,
    referenced: referenced.size,
    deletedOrphans: orphans.length,
    deletedBytes: orphanBytes,
    abortedMultipart: aborted,
    truncated: orphans.length === MAX_DELETES_PER_RUN,
  }
  console.log('storage cleanup:', JSON.stringify(summary))
  return NextResponse.json(summary)
}

import { NextResponse, type NextRequest } from 'next/server'
import { planStorageBytes } from '@/lib/plans'
import { IMPORT_PROMO } from '@/lib/promo'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface FinishBody {
  importId: string
  skippedDuplicate: number
  skippedUnsupported: number
  skippedVideo: number
  failed: number
}

function isFinishBody(value: unknown): value is FinishBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.importId === 'string' &&
    ['skippedDuplicate', 'skippedUnsupported', 'skippedVideo', 'failed'].every(
      (key) => typeof v[key] === 'number' && Number.isFinite(v[key])
    )
  )
}

export interface ImportReport {
  importedCount: number
  importedBytes: number
  skippedDuplicate: number
  skippedUnsupported: number
  skippedVideo: number
  failed: number
  /** Set when this import earned the «місяць Базового» promo: its end date. */
  promoEndsAt: string | null
}

/**
 * Zip import, last step: close the import. The imported count and bytes come
 * from the assets actually registered under it (finish_gallery_import), so
 * the report — and the promo built on it — never trusts the browser's tally.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!isFinishBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .rpc('finish_gallery_import', {
      p_import_id: body.importId,
      p_skipped_duplicate: Math.floor(body.skippedDuplicate),
      p_skipped_unsupported: Math.floor(body.skippedUnsupported),
      p_skipped_video: Math.floor(body.skippedVideo),
      p_failed: Math.floor(body.failed),
    })
    .maybeSingle<{
      imported_count: number
      imported_bytes: number
      skipped_duplicate: number
      skipped_unsupported: number
      skipped_video: number
      failed_count: number
    }>()
  if (error || !row) {
    return NextResponse.json({ error: 'import_not_running' }, { status: 400 })
  }

  const report: ImportReport = {
    importedCount: row.imported_count,
    importedBytes: Number(row.imported_bytes),
    skippedDuplicate: row.skipped_duplicate,
    skippedUnsupported: row.skipped_unsupported,
    skippedVideo: row.skipped_video,
    failed: row.failed_count,
    promoEndsAt: null,
  }

  // Promo: the first successful import grants a free month of «Базовий».
  // All eligibility rules (slots, deadline, once per account, free plan only)
  // are checked atomically in grant_import_promo(); null means «not granted».
  if (report.importedCount > 0) {
    const admin = createSupabaseAdminClient()
    if (admin) {
      const { data: endsAt } = await admin.rpc('grant_import_promo', {
        p_user: user.id,
        p_import_id: body.importId,
        p_storage_bytes: planStorageBytes(IMPORT_PROMO.plan),
        p_max_grants: IMPORT_PROMO.maxGrants,
        p_deadline: IMPORT_PROMO.deadline,
      })
      report.promoEndsAt = typeof endsAt === 'string' ? endsAt : null
    }
  }

  return NextResponse.json({ report })
}

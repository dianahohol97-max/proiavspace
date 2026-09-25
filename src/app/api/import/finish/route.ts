import { NextResponse, type NextRequest } from 'next/server'
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
}

/**
 * Zip import, last step: close the import. The imported count and bytes come
 * from the assets actually registered under it (finish_gallery_import), so
 * the report — and anything built on it — never trusts the browser's tally.
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
  }
  return NextResponse.json({ report })
}

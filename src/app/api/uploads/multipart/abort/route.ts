import { NextResponse, type NextRequest } from 'next/server'
import { galleryPrefix, getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface AbortBody {
  galleryId: string
  key: string
  uploadId: string
}

function isAbortBody(value: unknown): value is AbortBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.galleryId === 'string' &&
    typeof v.key === 'string' &&
    typeof v.uploadId === 'string'
  )
}

/**
 * Multipart cleanup on client-side failure. A missed abort (closed tab) is
 * not lost either: B2 keeps — and bills — the parts until aborted, so the
 * daily /api/cron/storage-cleanup sweeps uploads left open for over a day.
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
  if (!isAbortBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!body.key.startsWith(galleryPrefix(user.id, body.galleryId))) {
    return NextResponse.json({ error: 'key_mismatch' }, { status: 400 })
  }

  await getStorage().abortMultipartUpload(body.key, body.uploadId)
  return NextResponse.json({ ok: true })
}

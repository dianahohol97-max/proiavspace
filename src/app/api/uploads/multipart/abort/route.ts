import { NextResponse, type NextRequest } from 'next/server'
import { galleryPrefix, getStorage } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { releaseReservation } from '@/lib/upload/reservations'

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
 * Multipart cleanup when the browser gives up for good (quota, duplicate,
 * plan) — a network error does NOT abort: the parts stay for resume. A missed abort (closed tab) is
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

  try {
    await getStorage().abortMultipartUpload(body.key, body.uploadId)
  } catch (cause) {
    // Already completed or swept by the cron: nothing to abort, but the
    // reservation must still go, or it holds quota for up to 24 h.
    const err = cause as { name?: string; Code?: string }
    if (err.name !== 'NoSuchUpload' && err.Code !== 'NoSuchUpload') throw cause
  }
  await releaseReservation(createSupabaseAdminClient(), body.uploadId, user.id)
  return NextResponse.json({ ok: true })
}

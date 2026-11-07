import { NextResponse, type NextRequest } from 'next/server'
import { galleryPrefix, getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ListPartsBody {
  galleryId: string
  key: string
  uploadId: string
}

function isListPartsBody(value: unknown): value is ListPartsBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.galleryId === 'string' &&
    typeof v.key === 'string' &&
    typeof v.uploadId === 'string'
  )
}

/**
 * Resume: which parts of an open multipart upload storage already holds
 * (S3 ListParts). The browser keeps uploadId + key in IndexedDB; after a
 * dropped network or a reloaded tab it asks here and uploads only the rest.
 * 404 upload_not_found once the upload is gone (completed, aborted, swept by
 * the 24 h cron) — the browser then starts a fresh one.
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
  if (!isListPartsBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!body.key.startsWith(galleryPrefix(user.id, body.galleryId))) {
    return NextResponse.json({ error: 'key_mismatch' }, { status: 400 })
  }

  const parts = await getStorage().listParts(body.key, body.uploadId)
  if (!parts) {
    return NextResponse.json({ error: 'upload_not_found' }, { status: 404 })
  }
  return NextResponse.json({ parts })
}

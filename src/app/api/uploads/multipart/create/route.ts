import { NextResponse, type NextRequest } from 'next/server'
import { getStorage, originalKey } from '@/lib/storage'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { reserveUpload, reservedBytes } from '@/lib/upload/reservations'
import { authorizeUpload } from '@/lib/uploads'

export const runtime = 'nodejs'

interface CreateBody {
  galleryId: string
  fileName: string
  contentType: string
  sizeBytes: number
}

function isCreateBody(value: unknown): value is CreateBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.galleryId === 'string' &&
    typeof v.fileName === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number'
  )
}

/**
 * Multipart flow (files over 16 MB, lib/upload/multipart.ts), step 1: open the
 * upload in storage after the same ownership + quota gate as the single-PUT
 * path. Bytes of this account's other open uploads count as used, and this
 * one's declared size is reserved until complete/abort/the 24 h sweep
 * (migration 0063). The browser then requests part URLs, PUTs parts straight
 * to storage (resuming via .../list-parts) and finalizes via .../complete.
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
  if (!isCreateBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const reserved = admin ? await reservedBytes(admin, user.id) : 0
  const check = await authorizeUpload(supabase, user.id, body, { reservedBytes: reserved })
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const key = originalKey(user.id, body.galleryId, body.fileName)
  const { uploadId } = await getStorage().createMultipartUpload({
    key,
    contentType: body.contentType,
  })

  if (admin) {
    await reserveUpload(admin, {
      uploadId,
      ownerId: user.id,
      galleryId: body.galleryId,
      key,
      sizeBytes: body.sizeBytes,
    })
  }

  return NextResponse.json({ key, uploadId })
}

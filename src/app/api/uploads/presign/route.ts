import { NextResponse, type NextRequest } from 'next/server'
import { getStorage, isVariantName, originalKey, variantKey } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { authorizeUpload } from '@/lib/uploads'

export const runtime = 'nodejs'

interface PresignBody {
  galleryId: string
  fileName: string
  contentType: string
  sizeBytes: number
  /** When set, this presign is for a generated rendition, stored under v/. */
  variant?: string
}

function isPresignBody(value: unknown): value is PresignBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.galleryId === 'string' &&
    typeof v.fileName === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number' &&
    (v.variant === undefined || typeof v.variant === 'string')
  )
}

/**
 * Step 1 of the upload flow: the browser asks for a presigned PUT URL, then
 * uploads the file DIRECTLY to R2 (never through our servers), then calls
 * /api/uploads/complete to register the asset row.
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
  if (!isPresignBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const check = await authorizeUpload(supabase, user.id, body)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  if (body.variant !== undefined && !isVariantName(body.variant)) {
    return NextResponse.json({ error: 'unknown_variant' }, { status: 400 })
  }

  const key = body.variant
    ? variantKey(user.id, body.galleryId, body.variant)
    : originalKey(user.id, body.galleryId, body.fileName)
  const { url } = await getStorage().getUploadUrl({
    key,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
  })

  return NextResponse.json({ uploadUrl: url, key })
}

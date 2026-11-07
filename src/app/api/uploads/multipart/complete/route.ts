import { NextResponse, type NextRequest } from 'next/server'
import { galleryPrefix, getStorage } from '@/lib/storage'
import type { UploadedPart } from '@/lib/storage/StorageProvider'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkStoredParts } from '@/lib/upload/multipart'
import { releaseReservation } from '@/lib/upload/reservations'
import { parseRegisterAssetInput, registerAsset } from '@/lib/uploads'

export const runtime = 'nodejs'

interface MultipartFields {
  uploadId: string
  /**
   * The browser's part list with ETags, or null when it could not read them
   * (bucket CORS without ExposeHeaders: ETag) or does not have all of them —
   * then the server takes the list from storage itself (ListParts).
   */
  parts: UploadedPart[] | null
}

function parseMultipartFields(value: unknown): MultipartFields | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.uploadId !== 'string') return null
  const complete =
    Array.isArray(v.parts) &&
    v.parts.length > 0 &&
    v.parts.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).partNumber === 'number' &&
        typeof (p as Record<string, unknown>).etag === 'string' &&
        ((p as Record<string, unknown>).etag as string).length > 0
    )
  return { uploadId: v.uploadId, parts: complete ? (v.parts as UploadedPart[]) : null }
}

/**
 * Multipart flow, last step: stitch the parts together in storage, then
 * register the asset row exactly like the single-PUT complete route
 * (registerAsset also re-validates the key prefix and HEADs the real object,
 * so completing foreign uploads or lying about the size is not possible).
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const raw: unknown = await request.json().catch(() => null)
  const register = parseRegisterAssetInput(raw)
  const multipart = parseMultipartFields(raw)
  if (!register || !multipart) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Validate ownership of the key BEFORE touching storage state.
  if (!register.key.startsWith(galleryPrefix(user.id, register.galleryId))) {
    return NextResponse.json({ error: 'key_mismatch' }, { status: 400 })
  }

  const storage = getStorage()
  let parts: UploadedPart[]
  if (multipart.parts) {
    parts = [...multipart.parts].sort((a, b) => a.partNumber - b.partNumber)
  } else {
    const stored = await storage.listParts(register.key, multipart.uploadId)
    if (stored) {
      const check = checkStoredParts(stored, register.sizeBytes)
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 422 })
      }
      parts = check.parts
    } else {
      parts = []
    }
  }

  // No such upload any more: either an earlier attempt of this very request
  // completed it (its answer was lost on a dropped connection) — then the
  // object exists and registerAsset answers idempotently — or it was aborted,
  // and registerAsset reports upload_missing.
  if (parts.length > 0) {
    try {
      await storage.completeMultipartUpload(register.key, multipart.uploadId, parts)
    } catch (cause) {
      const name = (cause as { name?: string }).name
      if (name === 'InvalidPart' || name === 'InvalidPartOrder' || name === 'EntityTooSmall') {
        // The upload stays open for another attempt.
        return NextResponse.json({ error: 'parts_invalid' }, { status: 422 })
      }
      if (name !== 'NoSuchUpload') throw cause
    }
  }

  // From here the bytes are an object (counted through the asset row, or
  // discarded by registerAsset) — the reservation has done its job.
  const result = await registerAsset(supabase, user.id, register)
  await releaseReservation(createSupabaseAdminClient(), multipart.uploadId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ assetId: result.assetId })
}

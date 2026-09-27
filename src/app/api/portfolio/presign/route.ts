import { NextResponse, type NextRequest } from 'next/server'
import { effectiveGalleryPlan, planStorageBytes } from '@/lib/plans'
import { getStorage, isVariantName } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_PORTFOLIO_BYTES = 100 * 1024 * 1024 // showcase photos, not shoots

interface PresignBody {
  fileName: string
  contentType: string
  sizeBytes: number
  variant?: string
}

function isPresignBody(value: unknown): value is PresignBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.fileName === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number' &&
    (v.variant === undefined || typeof v.variant === 'string')
  )
}

/** Portfolio uploads live under u/<id>/portfolio/ — images only, quota-gated. */
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
  if (!body.contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 })
  }
  if (body.sizeBytes <= 0 || body.sizeBytes > MAX_PORTFOLIO_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 })
  }
  if (body.variant !== undefined && !isVariantName(body.variant)) {
    return NextResponse.json({ error: 'unknown_variant' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, storage_used_bytes, storage_limit_bytes, grace_until')
    .eq('user_id', user.id)
    .single()
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  const plan = effectiveGalleryPlan(profile.plan, profile.grace_until)
  const effectiveLimit = Math.min(profile.storage_limit_bytes, planStorageBytes(plan))
  if (profile.storage_used_bytes + body.sizeBytes > effectiveLimit) {
    return NextResponse.json({ error: 'storage_quota_exceeded' }, { status: 403 })
  }

  const safeName = body.fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80)
  const key = body.variant
    ? `u/${user.id}/portfolio/v/${crypto.randomUUID()}-${body.variant}.jpg`
    : `u/${user.id}/portfolio/${crypto.randomUUID()}-${safeName}`
  const { url } = await getStorage().getUploadUrl({
    key,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
  })

  return NextResponse.json({ uploadUrl: url, key })
}

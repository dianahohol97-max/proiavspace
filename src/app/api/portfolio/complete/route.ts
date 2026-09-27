import { NextResponse, type NextRequest } from 'next/server'
import { getStorage, isVariantName } from '@/lib/storage'
import { isQuotaError } from '@/lib/uploads'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface CompleteBody {
  key: string
  contentType: string
  sizeBytes: number
  width?: number
  height?: number
  variants?: Record<string, string>
  category?: string
}

function isCompleteBody(value: unknown): value is CompleteBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const variantsOk =
    v.variants === undefined ||
    (typeof v.variants === 'object' &&
      v.variants !== null &&
      Object.entries(v.variants).every(
        ([name, key]) => isVariantName(name) && typeof key === 'string'
      ))
  return (
    typeof v.key === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sizeBytes === 'number' &&
    (v.width === undefined || typeof v.width === 'number') &&
    (v.height === undefined || typeof v.height === 'number') &&
    (v.category === undefined || typeof v.category === 'string') &&
    variantsOk
  )
}

/** Registers a portfolio photo after the direct PUT. */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!isCompleteBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const prefix = `u/${user.id}/portfolio/`
  const allKeys = [body.key, ...Object.values(body.variants ?? {})]
  if (allKeys.some((key) => !key.startsWith(prefix))) {
    return NextResponse.json({ error: 'key_mismatch' }, { status: 400 })
  }

  // Rows are written only here, after the key check above — the user's own
  // client has no INSERT on portfolio_assets (migration 0041).
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { data, error } = await admin
    .from('portfolio_assets')
    .insert({
      owner_id: user.id,
      r2_key: body.key,
      content_type: body.contentType,
      width: body.width ?? null,
      height: body.height ?? null,
      size_bytes: body.sizeBytes,
      variants: body.variants ?? {},
      category: body.category?.trim().slice(0, 60) || null,
    })
    .select('id')
    .single()

  if (isQuotaError(error)) {
    // Refused by the quota trigger (0045): the objects must not stay uncounted.
    await getStorage().delete(allKeys).catch(() => {})
    return NextResponse.json({ error: 'storage_quota_exceeded' }, { status: 403 })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

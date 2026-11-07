import { NextResponse, type NextRequest } from 'next/server'
import { parsePortfolioComplete, portfolioAssetRow } from '@/lib/portfolio-upload'
import { getStorage, portfolioKeysOwned } from '@/lib/storage'
import { isQuotaError } from '@/lib/uploads'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Registers a portfolio photo after the direct PUT. */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = parsePortfolioComplete(await request.json().catch(() => null))
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const allKeys = [body.key, ...Object.values(body.variants ?? {})]
  if (!portfolioKeysOwned(user.id, body.key, body.variants)) {
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
    .insert(portfolioAssetRow(user.id, body))
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

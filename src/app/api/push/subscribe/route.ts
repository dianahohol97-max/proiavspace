import { NextResponse, type NextRequest } from 'next/server'
import { isLocale } from '@/lib/i18n/config'
import { isMissingTableError, parseSubscription } from '@/lib/push/kinds'
import { getVapidConfig } from '@/lib/push/send'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Save / forget this device's push subscription (push_subscriptions, 0068).
 * Writes go through the signed-in user's client, so RLS («лише власник»)
 * stays the authority. The one exception: the same phone signed into another
 * account before — that old row (someone else's, invisible under RLS) is
 * removed with the service role, so the previous account's notifications
 * stop arriving on this phone.
 *
 *   POST   { subscription: PushSubscription.toJSON(), locale }  → { ok }
 *   DELETE { endpoint }                                         → { ok }
 *   503 { error: 'migration_required' } — 0068 is not applied yet
 *   503 { error: 'not_configured' }     — no VAPID keys on the server
 */
export async function POST(request: NextRequest) {
  if (!getVapidConfig()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const body = (await request.json().catch(() => null)) as { subscription?: unknown; locale?: unknown } | null
  const subscription = parseSubscription(body?.subscription)
  if (!subscription) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const locale = typeof body?.locale === 'string' && isLocale(body.locale) ? body.locale : 'uk'

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  if (admin) {
    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint)
      .neq('owner_id', user.id)
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 })
    }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      owner_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      locale,
      user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300) || null,
    },
    { onConflict: 'endpoint' }
  )
  if (isMissingTableError(error)) return NextResponse.json({ error: 'migration_required' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null
  if (typeof body?.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('owner_id', user.id)
    .eq('endpoint', body.endpoint)
  if (isMissingTableError(error)) return NextResponse.json({ error: 'migration_required' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

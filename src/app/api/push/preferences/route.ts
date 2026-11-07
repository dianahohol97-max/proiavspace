import { NextResponse, type NextRequest } from 'next/server'
import {
  DEFAULT_PUSH_PREFERENCES,
  PUSH_KINDS,
  isMissingTableError,
  parsePreferencesPatch,
  type PushPreferences,
} from '@/lib/push/kinds'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Which notification types are on (push_preferences, 0068), under RLS.
 *   GET → { preferences }           (no row yet → every type on)
 *   PUT { client_picks?: bool, … } → { preferences }
 *   503 { error: 'migration_required' } before migration 0068.
 */
async function currentUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function pick(row: Record<string, unknown> | null): PushPreferences {
  const out = { ...DEFAULT_PUSH_PREFERENCES }
  for (const kind of PUSH_KINDS) {
    if (row && typeof row[kind] === 'boolean') out[kind] = row[kind] as boolean
  }
  return out
}

export async function GET() {
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('push_preferences')
    .select(PUSH_KINDS.join(', '))
    .eq('owner_id', user.id)
    .maybeSingle<Record<string, unknown>>()
  if (isMissingTableError(error)) return NextResponse.json({ error: 'migration_required' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  return NextResponse.json({ preferences: pick(data) })
}

export async function PUT(request: NextRequest) {
  const patch = parsePreferencesPatch(await request.json().catch(() => null))
  if (!patch) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('push_preferences')
    .upsert({ owner_id: user.id, ...patch }, { onConflict: 'owner_id' })
    .select(PUSH_KINDS.join(', '))
    .single<Record<string, unknown>>()
  if (isMissingTableError(error)) return NextResponse.json({ error: 'migration_required' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ preferences: pick(data) })
}

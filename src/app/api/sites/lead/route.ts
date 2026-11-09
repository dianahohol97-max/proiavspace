import { NextResponse, type NextRequest } from 'next/server'
import { viewerCanSeeSites } from '@/lib/features/sites-server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface LeadBody {
  handle: string
  name: string
  contact: string
  message?: string
}

function isLeadBody(value: unknown): value is LeadBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.handle === 'string' &&
    typeof v.name === 'string' &&
    typeof v.contact === 'string' &&
    (v.message === undefined || typeof v.message === 'string')
  )
}

/**
 * Public lead submit from a photographer site. All authorization lives in
 * the record_site_lead RPC: it refuses unless the site is published and the
 * owner enabled the form.
 */
export async function POST(request: NextRequest) {
  // Shelved (src/lib/features/sites.ts): 404 unless sites are on or it is the owner.
  if (!(await viewerCanSeeSites())) return new NextResponse('Not found', { status: 404 })
  const body: unknown = await request.json().catch(() => null)
  if (!isLeadBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const name = body.name.trim()
  const contact = body.contact.trim()
  if (!name || !contact || name.length > 120 || contact.length > 200) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.rpc('record_site_lead', {
    p_handle: body.handle,
    p_name: name,
    p_contact: contact,
    p_message: (body.message ?? '').trim().slice(0, 2000),
  })
  if (error) {
    return NextResponse.json({ error: 'rejected' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'
import type { SocialStatus } from '@/lib/social/posts'

/** Gate every social mutation on the admin allowlist, then use the service role. */
async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect('/uk/dashboard')
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Service role not configured')
  return admin
}

/**
 * Move a post along the pipeline. Approving is the founder's one-tap action;
 * Make then publishes `approved` rows to the channels for that format.
 */
export async function setPostStatus(
  locale: Locale,
  id: string,
  status: SocialStatus
): Promise<void> {
  const admin = await requireAdmin()
  const patch: Record<string, unknown> = { status }
  if (status === 'posted') patch.posted_at = new Date().toISOString()
  const { error } = await admin.from('social_posts').update(patch).eq('id', id)
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/content`)
}

/** Kind → the queue `format` Make filters on. */
const KIND_FORMAT: Record<string, string> = {
  carousel: 'carousel',
  reel: 'reel',
  story: 'story',
  single: 'single',
}

/**
 * «Опублікувати зараз» — approve the post AND immediately ping the Make publish
 * webhook so it posts right now instead of on the next scheduled poll. If
 * MAKE_PUBLISH_HOOK_URL isn't configured yet, the post is still approved and the
 * scheduled Make run will pick it up — so the button never leaves it stuck.
 */
export async function publishPostNow(locale: Locale, id: string): Promise<void> {
  const admin = await requireAdmin()

  const { data: row } = await admin
    .from('social_posts')
    .select('kind, status')
    .eq('id', id)
    .maybeSingle()
  const current = (row as { kind?: string; status?: string } | null) ?? null

  // Idempotency: a post that already went out must never be re-sent — the
  // founder triple-clicked a silent button once and got three IG posts.
  if (current?.status === 'posted' || current?.status === 'archived') {
    redirect(`/${locale}/dashboard/content/${id}?pub=already`)
  }

  const hook = process.env.MAKE_PUBLISH_HOOK_URL
  let outcome: 'sent' | 'queued' | 'hookfail' = 'queued'
  if (hook) {
    try {
      const response = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, format: KIND_FORMAT[current?.kind ?? 'single'] ?? current?.kind }),
      })
      outcome = response.ok ? 'sent' : 'hookfail'
    } catch {
      outcome = 'hookfail' /* webhook down → stays approved, scheduled run picks it up */
    }
  }

  // Successful hand-off to Make counts as posted (so the button disappears);
  // otherwise the post stays approved for the scheduled run.
  const { error } = await admin
    .from('social_posts')
    .update(
      outcome === 'sent'
        ? { status: 'posted', posted_at: new Date().toISOString() }
        : { status: 'approved' }
    )
    .eq('id', id)
  if (error) throw error

  revalidatePath(`/${locale}/dashboard/content`)
  revalidatePath(`/${locale}/dashboard/content/${id}`)
  redirect(`/${locale}/dashboard/content/${id}?pub=${outcome}`)
}

export async function deletePost(locale: Locale, id: string): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await admin.from('social_posts').delete().eq('id', id)
  if (error) throw error
  revalidatePath(`/${locale}/dashboard/content`)
}

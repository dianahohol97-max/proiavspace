'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { generateNextArticle, type GenerateResult } from '@/lib/blog/generate'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

/** Gate every blog mutation on the admin allowlist, then use the service role. */
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

function revalidateBlog(locale: Locale) {
  revalidatePath(`/${locale}/dashboard/blog`)
  revalidatePath('/uk/blog')
  revalidatePath('/uk/blog', 'layout')
}

/**
 * Founder-triggered generation: write the next queued topic into a draft, right
 * from the dashboard. Admin-gated, but never throws — a misconfiguration (e.g.
 * the service-role key missing in the environment) comes back as a readable
 * message instead of crashing the page.
 */
export async function generateArticleNow(locale: Locale): Promise<GenerateResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return { ok: false, message: 'Немає доступу.' }
  }
  const result = await generateNextArticle()
  if (result.ok) revalidateBlog(locale)
  return result
}

export async function setArticleStatus(
  locale: Locale,
  id: string,
  status: 'draft' | 'published'
): Promise<void> {
  const admin = await requireAdmin()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  // Stamp the publish date the first time it goes live.
  if (status === 'published') patch.published_date = new Date().toISOString().slice(0, 10)
  const { error } = await admin.from('blog_articles').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update article: ${error.message}`)
  revalidateBlog(locale)
}

export async function deleteArticle(locale: Locale, id: string): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await admin.from('blog_articles').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete article: ${error.message}`)
  revalidateBlog(locale)
  redirect(`/${locale}/dashboard/blog`)
}

/** Light editing before publishing: title, description and the body JSON. */
export async function updateArticle(locale: Locale, id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const bodyRaw = String(formData.get('body') ?? '').trim()

  let body: unknown
  try {
    body = JSON.parse(bodyRaw)
  } catch {
    throw new Error('Тіло статті — некоректний JSON')
  }
  if (!Array.isArray(body)) throw new Error('Тіло статті має бути масивом блоків')

  const { error } = await admin
    .from('blog_articles')
    .update({ title, description, body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Failed to update article: ${error.message}`)
  revalidateBlog(locale)
}

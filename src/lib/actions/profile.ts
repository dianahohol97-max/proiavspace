'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getStorage } from '@/lib/storage'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')
  return { supabase, user }
}

export async function updateDisplayName(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()
  const displayName = String(formData.get('display_name') ?? '').trim()

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || null,
      watermark_enabled: formData.get('watermark_enabled') === 'on',
    })
    .eq('user_id', user.id)
  if (error) throw new Error(`Failed to update profile: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/settings`)
  // Land back with a confirmation flag so the form can say it saved.
  redirect(`/${locale}/dashboard/settings?saved=1`)
}

/** Called by LogoUploader after the direct PUT to R2 succeeded. */
export async function saveLogoKey(locale: Locale, key: string): Promise<void> {
  const { supabase, user } = await requireUser()

  if (!key.startsWith(`u/${user.id}/brand/`)) {
    throw new Error('Logo key outside your brand prefix')
  }

  // Replace, not accumulate: drop the previous logo object if any.
  const { data: profile } = await supabase
    .from('profiles')
    .select('logo_url')
    .eq('user_id', user.id)
    .single()
  if (profile?.logo_url && profile.logo_url !== key) {
    await getStorage().delete([profile.logo_url])
  }

  const { error } = await supabase
    .from('profiles')
    .update({ logo_url: key })
    .eq('user_id', user.id)
  if (error) throw new Error(`Failed to save logo: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/settings`)
}

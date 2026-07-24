'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isSiteTrialExpired } from '@/lib/plans'
import type { PricingItem, SiteContent, SiteTextBlocks } from '@/lib/site/content'
import { THEME_CATALOG } from '@/lib/site/themes'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { locales, type Locale } from '@/lib/i18n/config'

/** Every language a site can be offered in besides the Ukrainian base. */
const EXTRA_LOCALES = locales.filter((l): l is Locale => l !== 'uk')

async function requireUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/uk/login')
  return { supabase, user }
}

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

export async function saveSite(locale: Locale, formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser()

  const handle = str(formData, 'handle').toLowerCase() || null
  if (handle && !/^[a-z0-9][a-z0-9-]{2,31}$/.test(handle)) {
    throw new Error('Handle must be 3-32 chars: latin letters, digits, dashes')
  }

  // The editor exposes the 8-entry catalog; «Опівніч» maps to tysha+night.
  const catalogEntry =
    THEME_CATALOG.find((entry) => entry.value === str(formData, 'theme')) ?? THEME_CATALOG[0]

  const items: PricingItem[] = [0, 1, 2]
    .map((index) => ({
      name: str(formData, `price_name_${index}`),
      price: str(formData, `price_amount_${index}`),
      includes: String(formData.get(`price_includes_${index}`) ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }))
    .filter((item) => item.name)

  // Enabled languages + their per-language text blocks. Translation fields are
  // kept even for a language that is momentarily unchecked, so toggling a
  // language off never silently discards text the photographer already typed.
  const languages = EXTRA_LOCALES.filter((l) => formData.get(`lang_${l}`) === 'on')
  const translations: Record<string, SiteTextBlocks> = {}
  for (const l of EXTRA_LOCALES) {
    const block: SiteTextBlocks = {
      hero: {
        title: str(formData, `t_${l}_hero_title`),
        subtitle: str(formData, `t_${l}_hero_subtitle`),
      },
      about: { text: str(formData, `t_${l}_about_text`) },
    }
    if (block.hero.title || block.hero.subtitle || block.about.text) translations[l] = block
  }

  const content: SiteContent = {
    hero: {
      title: str(formData, 'hero_title'),
      subtitle: str(formData, 'hero_subtitle'),
      imageId: str(formData, 'hero_image_id'),
    },
    about: { text: str(formData, 'about_text') },
    pricing: { items },
    contact: {
      email: str(formData, 'contact_email'),
      phone: str(formData, 'contact_phone'),
      instagram: str(formData, 'contact_instagram'),
      bookingUrl: str(formData, 'contact_booking_url'),
    },
    translations,
    settings: {
      languages,
      leadForm: formData.get('opt_lead_form') === 'on',
    },
  }

  // Publishing is gated by the 30-day site trial: once it lapses (still on
  // site_trial), the site can only stay a draft until the photographer upgrades.
  // Saving content is always allowed — only the publish flag is forced off.
  let isPublished = formData.get('is_published') === 'on'
  if (isPublished) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('site_plan, created_at')
      .eq('user_id', user.id)
      .single<{ site_plan: string; created_at: string }>()
    if (prof && isSiteTrialExpired(prof.site_plan, prof.created_at)) {
      isPublished = false
    }
  }

  const { error } = await supabase.from('sites').upsert(
    {
      user_id: user.id,
      handle,
      theme: catalogEntry.theme,
      mode: catalogEntry.mode,
      is_published: isPublished,
      content,
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`Failed to save site: ${error.message}`)

  revalidatePath(`/${locale}/dashboard/site`)
  if (handle) revalidatePath(`/${locale}/s/${handle}`)
}

/** Removes one lead from the dashboard list; RLS limits it to the owner. */
export async function deleteSiteLead(locale: Locale, leadId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('site_leads').delete().eq('id', leadId)
  if (error) throw new Error(`Failed to delete lead: ${error.message}`)
  revalidatePath(`/${locale}/dashboard/site`)
}

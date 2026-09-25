import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ZipImporter } from '@/components/ZipImporter'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ImportPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = await getDictionary(locale)

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Same watermark rule as the gallery Uploader: imported previews look
  // exactly like uploaded ones.
  const { data: profile } = await supabase
    .from('profiles')
    .select('watermark_enabled, display_name')
    .eq('user_id', user.id)
    .single<{ watermark_enabled: boolean; display_name: string | null }>()
  const watermarkText =
    profile?.watermark_enabled && profile.display_name ? profile.display_name : undefined

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted no-underline">
        {dict.importer.back}
      </Link>
      <h1 className="mt-4 mb-6 font-brand text-3xl">{dict.importer.title}</h1>
      <ZipImporter locale={locale} watermarkText={watermarkText} t={dict.importer} />
    </main>
  )
}

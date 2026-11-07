import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FolderCull } from '@/components/folder-cull/FolderCull'
import { isLocale } from '@/lib/i18n/config'
import { folderLabels } from '@/lib/folder-cull/i18n'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * «Відбір із папки» — culling RAWs from the photographer's computer, before
 * editing. Needs only a signed-in account (no gallery); files never leave the
 * browser. Later: a separate subscription.
 */
export default async function FolderCullPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  const l = folderLabels(locale)
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href={`/${locale}/dashboard`} className="text-sm text-muted no-underline hover:text-fg">
        ← {locale === 'uk' ? 'Кабінет' : 'Dashboard'}
      </Link>
      <h1 className="mt-4 font-display text-4xl">{l.title}</h1>
      <FolderCull locale={locale} />
    </main>
  )
}

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AlbumEditor } from '@/components/album/AlbumEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Редактор альбому',
  robots: { index: false, follow: false },
  other: { google: 'notranslate' },
}

/**
 * Full-screen album editor — outside the dashboard layout on purpose: the
 * spread needs the whole laptop screen, not the width left by the sidebar.
 * Data is loaded by the client through server actions (RLS: owner only).
 */
export default async function AlbumEditorPage({ params }: { params: { locale: string; id: string } }) {
  if (!isLocale(params.locale)) notFound()
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${params.locale}/login`)
  return (
    <div className="notranslate" translate="no">
      <AlbumEditor backendKind="server" projectId={params.id} basePath={`/${params.locale}/dashboard/albums`} />
    </div>
  )
}

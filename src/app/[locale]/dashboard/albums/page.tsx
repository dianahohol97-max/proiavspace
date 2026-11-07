import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { AlbumsHome } from '@/components/album/AlbumsHome'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Альбоми', robots: { index: false, follow: false } }

/** Album projects (the dashboard layout already requires a signed-in user). */
export default function AlbumsPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  return <AlbumsHome backendKind="server" basePath={`/${params.locale}/dashboard/albums`} editorPath={`/${params.locale}/albums`} />
}

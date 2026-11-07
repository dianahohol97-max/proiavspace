import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { ProfilesManager } from '@/components/album/ProfilesManager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Профілі друку', robots: { index: false, follow: false } }

export default function AlbumProfilesPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  return <ProfilesManager backendKind="server" basePath={`/${params.locale}/dashboard/albums`} />
}

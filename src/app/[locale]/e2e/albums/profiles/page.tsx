import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { albumDemoEnabled } from '@/lib/album/demo-gate'
import { ProfilesManager } from '@/components/album/ProfilesManager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Профілі друку (демо)', robots: { index: false, follow: false } }

export default function AlbumProfilesDemoPage({ params }: { params: { locale: string } }) {
  if (!albumDemoEnabled()) notFound()
  return <ProfilesManager backendKind="local" basePath={`/${params.locale}/e2e/albums`} />
}

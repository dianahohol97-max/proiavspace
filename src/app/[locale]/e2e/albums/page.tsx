import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { albumDemoEnabled } from '@/lib/album/demo-gate'
import { AlbumsHome } from '@/components/album/AlbumsHome'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Альбоми (демо)', robots: { index: false, follow: false } }

export default function AlbumsDemoPage({ params }: { params: { locale: string } }) {
  if (!albumDemoEnabled()) notFound()
  const base = `/${params.locale}/e2e/albums`
  return <AlbumsHome backendKind="local" basePath={base} editorPath={base} />
}

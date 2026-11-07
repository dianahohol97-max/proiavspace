import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { albumDemoEnabled } from '@/lib/album/demo-gate'
import { AlbumEditor } from '@/components/album/AlbumEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Редактор альбому (демо)', robots: { index: false, follow: false } }

export default function AlbumEditorDemoPage({ params }: { params: { locale: string; id: string } }) {
  if (!albumDemoEnabled()) notFound()
  return <AlbumEditor backendKind="local" projectId={params.id} basePath={`/${params.locale}/e2e/albums`} />
}

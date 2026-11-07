import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FolderCull } from '@/components/folder-cull/FolderCull'
import { isLocale } from '@/lib/i18n/config'
import { folderLabels } from '@/lib/folder-cull/i18n'

/**
 * Database-free demo of «Відбір із папки» (benchmarks, e2e). The folder is
 * read in the browser like in the dashboard; nothing is uploaded or stored on
 * the server. Not linked, not indexed.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Відбір із папки — демо', robots: { index: false, follow: false } }

export default function FolderCullDemo({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { opfs?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const l = folderLabels(params.locale)
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">{l.title} · demo</h1>
      {/* ?opfs=<folder>: e2e of «write .xmp into the folder» via the browser's private file system. */}
      <FolderCull locale={params.locale} opfsFolder={searchParams.opfs && /^[\w-]{1,40}$/.test(searchParams.opfs) ? searchParams.opfs : undefined} />
    </main>
  )
}

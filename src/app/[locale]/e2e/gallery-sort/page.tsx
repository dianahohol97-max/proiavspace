import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'
import { GallerySortControl } from '@/components/gallery/GallerySortControl'
import { ProbeUploader } from './ProbeUploader'
import { e2eAfterBatch, e2eRegister, e2eResetSort, e2eSort, e2eSortState } from './actions'

/**
 * Test-only page: the dashboard's «Порядок» control and the photo order of
 * one in-memory gallery (./actions), plus an uploader that reads EXIF for
 * real. ?reset=1 clears it. E2E_THEME_PREVIEW=1 only.
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default async function E2EGallerySort({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { reset?: string }
}) {
  if (process.env.E2E_THEME_PREVIEW !== '1' || !isLocale(params.locale)) notFound()
  if (searchParams.reset === '1') await e2eResetSort()
  const dict = await getDictionary(params.locale)
  const state = await e2eSortState()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10" data-testid="sort-state" data-mode={state.mode} data-resorts={state.resorts} data-count={state.photos.length}>
      <ProbeUploader register={e2eRegister} onBatchDone={e2eAfterBatch} />
      {state.photos.length > 1 && (
        <GallerySortControl
          key={state.mode}
          mode={state.mode}
          labels={dict.galleryManage}
          total={state.photos.length}
          withTakenAt={state.photos.filter((p) => p.takenAt).length}
          action={e2eSort}
        />
      )}
      <ol data-testid="photo-order">
        {state.photos.map((photo) => (
          <li key={photo.name}>{photo.name}</li>
        ))}
      </ol>
    </main>
  )
}

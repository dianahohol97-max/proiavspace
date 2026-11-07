import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Uploader } from '@/components/Uploader'
import { getDictionary } from '@/lib/i18n'
import { isLocale } from '@/lib/i18n/config'

/**
 * Test-only page: the real gallery Uploader without a signed-in session, so
 * tests/e2e/upload-resume.spec.ts can drive multipart, the network-outage
 * wait and resume-after-reload against mocked /api/uploads/* and storage
 * (page.route). Exists only under `next dev`; a production build answers 404.
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default async function E2EUploadPage({ params }: { params: { locale: string } }) {
  if (process.env.NODE_ENV === 'production' || !isLocale(params.locale)) notFound()
  const dict = await getDictionary(params.locale)
  return (
    <main className="mx-auto max-w-2xl p-8">
      <Uploader
        galleryId="00000000-0000-4000-8000-0000000000e2"
        dropHint={dict.galleryManage.dropHint}
        videoPlanNotice={dict.galleryManage.videoPlanNotice}
        videoPlanLink={dict.galleryManage.videoPlanLink}
        resumeHint={dict.galleryManage.uploadResumeHint}
        networkWait={dict.galleryManage.uploadNetworkWait}
        billingHref={`/${params.locale}/dashboard/billing`}
      />
    </main>
  )
}

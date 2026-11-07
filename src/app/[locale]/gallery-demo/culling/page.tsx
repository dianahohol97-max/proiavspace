import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n'
import { CullingPanel } from '@/components/gallery/CullingPanel'
import type { CullingPhoto } from '@/lib/culling/types'

/**
 * Demo/benchmark of the photographer's «Відібрати кадри» panel without a
 * database: the demo wedding frames from public/themes (their ~1080 px WebP,
 * like a real gallery's `mobile` rendition). ?n=300 repeats them into a big
 * gallery; each copy gets its own URL so the browser really fetches/decodes it.
 * Not linked from anywhere and not indexed.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Відбір кадрів — демо',
  robots: { index: false, follow: false },
}

/** Demo: hiding changes nothing anywhere — there is no database behind it. */
async function demoSetHidden(): Promise<void> {
  'use server'
}

const FRAMES = Array.from({ length: 24 }, (_, i) => i + 1)
const MAX = 2000

export default async function CullingDemoPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { n?: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const dict = await getDictionary(params.locale)
  const count = Math.min(Math.max(Number.parseInt(searchParams.n ?? '', 10) || FRAMES.length, 1), MAX)
  const photos: CullingPhoto[] = Array.from({ length: count }, (_, i) => {
    const n = FRAMES[i % FRAMES.length]
    const file = `${String(n).padStart(2, '0')}-1080.webp`
    return {
      id: i < FRAMES.length ? String(n) : `${n}-${i}`,
      url: `/themes/${file}${i < FRAMES.length ? '' : `?copy=${i}`}`,
      order: i,
      takenAt: null,
      name: file,
    }
  })
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">{dict.pages.cullingDemoTitle}</h1>
      <CullingPanel galleryId={`demo-${count}`} locale={params.locale} photos={photos} onSetHidden={demoSetHidden} />
    </main>
  )
}

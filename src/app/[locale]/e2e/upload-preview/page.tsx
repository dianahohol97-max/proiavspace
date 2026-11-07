import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { UploadPreviewProbe } from './UploadPreviewProbe'

/**
 * Test-only page (tests/e2e/upload-preview.spec.ts): runs the real browser
 * upload pipeline — EXIF read, upright decode, HEIC fallback, renditions —
 * on a picked file, without storage or a database. Exists only when the
 * server runs with E2E_THEME_PREVIEW=1 (playwright.config.ts); 404 elsewhere.
 */
export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default function E2EUploadPreview() {
  if (process.env.E2E_THEME_PREVIEW !== '1') notFound()
  return <UploadPreviewProbe />
}

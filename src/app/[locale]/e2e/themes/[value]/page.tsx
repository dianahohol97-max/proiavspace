import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ThemePreviewPage from '../../../themes/[value]/page'

/**
 * Test-only door to the theme demos. /[locale]/themes/* redirects to the
 * gallery demo while the site builder is shelved (next.config.js), so the
 * Playwright suite (tests/e2e/tysha.spec.ts) renders the very same demo page
 * here. It exists only when the server runs with E2E_THEME_PREVIEW=1 —
 * playwright.config.ts sets it for its own `next dev`; everywhere else 404.
 */
export const dynamic = 'force-dynamic'

const enabled = () => process.env.E2E_THEME_PREVIEW === '1'

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } }
}

export default async function E2EThemePreview(props: { params: { locale: string; value: string } }) {
  if (!enabled()) notFound()
  return ThemePreviewPage(props)
}

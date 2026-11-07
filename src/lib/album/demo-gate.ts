/**
 * The local album demo (/[locale]/e2e/albums) runs with no database
 * (localStorage + bundled photos). It exists only for the Playwright suite
 * (playwright.config.ts sets E2E_ALBUM_DEMO=1) and in `next dev`; in
 * production it is a 404.
 */
export function albumDemoEnabled(): boolean {
  return process.env.E2E_ALBUM_DEMO === '1' || process.env.NODE_ENV === 'development'
}

/**
 * The e2e run this spec is in: E2E_SITES=1 is the second pass of
 * `npm run test:e2e` with NEXT_PUBLIC_SITES_ENABLED=1 (playwright.config.ts).
 * Sites and booking are shelved by default (src/lib/features/sites.ts).
 */
export const SITES_ON = process.env.E2E_SITES === '1'

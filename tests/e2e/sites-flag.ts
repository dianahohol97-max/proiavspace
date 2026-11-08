/**
 * The e2e dev server with NEXT_PUBLIC_SITES_ENABLED=1 (playwright.config.ts:
 * PORT + 1). Sites and booking are shelved by default (src/lib/features/sites.ts);
 * the theme suites run against this server so they keep running unchanged.
 */
const PORT = Number(process.env.E2E_PORT || 3100)
export const SITES_ON_URL = `http://localhost:${PORT + 1}`

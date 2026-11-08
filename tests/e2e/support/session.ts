import type { BrowserContext } from '@playwright/test'

/** Must match tests/e2e/support/fake-supabase.mjs. */
export const E2E_TOKEN = 'e2e-photographer-token'
export const E2E_USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'olha@e2e.test' }
/** The platform owner (src/lib/admin.ts DEFAULT_ADMINS) — tests/e2e/hide-sites.spec.ts. */
export const E2E_OWNER_TOKEN = 'e2e-owner-token'
export const E2E_OWNER = { id: '00000000-0000-4000-8000-0000000000e3', email: 'dianahohol97@gmail.com' }
export const FAKE_SUPABASE = 'http://127.0.0.1:54321'

/**
 * Signs the browser in as the e2e photographer: the same cookie @supabase/ssr
 * writes (sb-<host>-auth-token, base64url JSON session). The fake Supabase
 * answers /auth/v1/user for this token only.
 */
export async function signIn(context: BrowserContext, baseURL: string, as: 'photographer' | 'owner' = 'photographer') {
  const who = as === 'owner' ? E2E_OWNER : E2E_USER
  const session = {
    access_token: as === 'owner' ? E2E_OWNER_TOKEN : E2E_TOKEN,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: {
      id: who.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: who.email,
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-08-01T00:00:00Z',
    },
  }
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
  await context.addCookies([{ name: 'sb-127-auth-token', value, url: baseURL }])
}

/** Reseed the fake database: 'full' — four galleries, 'empty' — a new photographer. */
export async function resetDb(scenario: 'full' | 'empty' = 'full') {
  const res = await fetch(`${FAKE_SUPABASE}/__e2e/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
  if (!res.ok) throw new Error(`fake supabase reset failed: ${res.status}`)
}

export async function dbState(): Promise<Record<string, Record<string, unknown>[]>> {
  return (await fetch(`${FAKE_SUPABASE}/__e2e/state`)).json()
}

export async function insertRow(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${FAKE_SUPABASE}/__e2e/insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, row }),
  })
  return (await res.json()) as Record<string, unknown>
}

/** Pretend migration 0070 is not applied (no galleries.downloads_enabled). Reset by resetDb(). */
export async function setDownloadsColumn(present: boolean) {
  const res = await fetch(`${FAKE_SUPABASE}/__e2e/schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadsColumn: present }),
  })
  if (!res.ok) throw new Error(`fake supabase schema failed: ${res.status}`)
}

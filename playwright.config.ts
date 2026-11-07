import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests of the main flows that need no database: `next dev` with
 * placeholder Supabase variables (nothing real is reached). Run: npm run test:e2e
 *
 * Phones are emulated in Chromium (viewport, touch, user agent, DPR), so one
 * browser binary covers desktop, iPhone and Android.
 */
const PORT = Number(process.env.E2E_PORT || 3100)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'off',
    // Pre-installed Chromium in cloud sandboxes; CI installs its own.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${baseURL}/uk/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      // Placeholders: pages render without a database, nothing real is called.
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-placeholder-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'e2e-placeholder-service-key',
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: '1',
      // Google OAuth "configured" so the booking dashboard renders its calendar
      // states; no test reaches Google (calendar calls only for connected v2 accounts).
      GOOGLE_CLIENT_ID: 'e2e-placeholder-client-id',
      GOOGLE_CLIENT_SECRET: 'e2e-placeholder-client-secret',
      // Storage placeholders: published-site pages build the client up front;
      // presigning is local, nothing reaches B2.
      STORAGE_PROVIDER: 'b2',
      B2_REGION: 'eu-central-003',
      B2_KEY_ID: 'e2e-placeholder',
      B2_APPLICATION_KEY: 'e2e-placeholder',
      B2_BUCKET: 'e2e-placeholder',
      // Sentry must stay off in tests.
      NEXT_PUBLIC_SENTRY_DSN: '',
    },
  },
})

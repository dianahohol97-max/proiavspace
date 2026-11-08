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
  webServer: [
    {
      // Answers only the signed-in e2e photographer (tests/e2e/dashboard.spec.ts);
      // every other request is dropped, as when nothing listened on :54321.
      command: 'node tests/e2e/support/fake-supabase.mjs',
      url: 'http://127.0.0.1:54321/__e2e/health',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
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
        // Sentry must stay off in tests.
        NEXT_PUBLIC_SENTRY_DSN: '',
        // Opens /[locale]/e2e/themes/[value] — the theme demos, which the
        // public /themes routes redirect away from (tests/e2e/tysha.spec.ts).
        E2E_THEME_PREVIEW: '1',
        // Dashboard e2e: thumbnails are «CDN» URLs served by the fake Supabase;
        // the R2 values only let getStorage() start, nothing reaches R2.
        MEDIA_CDN_URL: 'http://127.0.0.1:54321/media',
        R2_ACCOUNT_ID: 'e2e',
        R2_ACCESS_KEY_ID: 'e2e',
        R2_SECRET_ACCESS_KEY: 'e2e',
        R2_BUCKET: 'e2e',
      },
    },
  ],
})

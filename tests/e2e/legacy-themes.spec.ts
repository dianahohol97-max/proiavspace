import { expect, test } from '@playwright/test'
import { SITES_ON_URL } from './sites-flag'

// Sites are shelved by default (src/lib/features/sites.ts): themes run on the
// e2e server with NEXT_PUBLIC_SITES_ENABLED=1.
test.use({ baseURL: SITES_ON_URL })

/**
 * «Плівка», «Галерея», «Архів», «Продакшн» are no longer offered for sites;
 * a site that still has one renders with the nearest v2 theme.
 */
const MAP: Record<string, string> = { plivka: 'Sheet', arkhiv: 'Sheet', galereia: 'Mat', prodakshn: 'Index' }

for (const [old, module] of Object.entries(MAP)) {
  test(`стара тема «${old}» рендериться найближчою новою (${module})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'один прогін')
    const response = await page.goto(`/uk/e2e/themes/${old}`)
    expect(response?.status()).toBe(200)
    await expect(page.locator(`[class*=${module}_root__]`)).toHaveCount(1)
    await expect(page.locator('[data-card=name]').first()).toBeVisible()
  })
}

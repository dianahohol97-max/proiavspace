import { expect, test, type Page } from '@playwright/test'

/**
 * Landing fixes from testing: the sticky header (landing + inner pages), the
 * phone burger menu, the hero category tabs and the hero gallery card that
 * replaced the photographer-site demo.
 */

async function noHorizontalOverflow(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

for (const path of ['/uk', '/uk/blog', '/uk/tsiny']) {
  test(`${path}: шапка лишається видимою після прокрутки`, async ({ page }) => {
    await page.goto(path)
    const header = page.locator('header:has(nav[aria-label="Головне меню"])').first()
    await expect(header).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 2400))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
    const box = await header.boundingBox()
    expect(box?.y).toBe(0)
    await expect(header).toHaveAttribute('data-scrolled', '')
    // The header paints above the page: the point under its logo hits the header.
    const onTop = await page.evaluate(() => {
      const el = document.elementFromPoint(30, 30)
      return Boolean(el?.closest('header'))
    })
    expect(onTop).toBe(true)
  })
}

test('/uk#pricing: якір не ховається під шапкою', async ({ page }) => {
  await page.goto('/uk#pricing')
  const heading = page.locator('#pricing h2')
  await expect
    .poll(async () => (await heading.boundingBox())?.y ?? 0)
    .toBeGreaterThanOrEqual(64)
})

test.describe('телефон 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  for (const path of ['/uk', '/uk/blog']) {
    test(`${path}: бургер відкриває меню, пункти клікабельні, Esc закриває`, async ({ page }) => {
      await page.goto(path)
      await noHorizontalOverflow(page)
      const burger = page.getByRole('button', { name: 'Меню', exact: true })
      await expect(burger).toBeVisible()
      await expect(burger).toHaveAttribute('aria-expanded', 'false')
      // The bar keeps the compact CTA; the links live in the panel.
      await expect(page.locator('header:has(nav[aria-label="Головне меню"])').first().getByRole('link', { name: /Почати безкоштовно/ })).toBeVisible()

      await burger.click()
      await expect(burger).toHaveAttribute('aria-expanded', 'true')
      const panel = page.getByRole('dialog', { name: 'Меню' })
      await expect(panel).toBeVisible()
      expect(await burger.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'))
      // Focus moved into the panel; the page behind does not scroll.
      await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden')

      for (const name of ['Галереї', 'Тарифи', 'Блог', 'Увійти']) {
        const link = panel.getByRole('link', { name, exact: true })
        await expect(link).toBeVisible()
        // Clickable: the centre of the link is not covered by anything.
        const hit = await link.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          return el === top || el.contains(top)
        })
        expect(hit, name).toBe(true)
      }
      await expect(panel.getByRole('link', { name: 'English' })).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      await expect(burger).toHaveAttribute('aria-expanded', 'false')
      await expect(burger).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')

      // Close button and a click outside close it too.
      await burger.click()
      await panel.getByRole('button', { name: 'Закрити меню' }).click()
      await expect(panel).toBeHidden()
      await burger.click()
      await page.mouse.click(195, 800)
      await expect(panel).toBeHidden()
    })
  }

  test('/uk: пункт меню веде, куди треба, і закриває меню', async ({ page }) => {
    await page.goto('/uk')
    await page.getByRole('button', { name: 'Меню', exact: true }).click()
    await page.getByRole('dialog', { name: 'Меню' }).getByRole('link', { name: 'Тарифи', exact: true }).click()
    await expect(page).toHaveURL(/\/uk\/tsiny$/)
    await expect(page.getByRole('dialog', { name: 'Меню' })).toBeHidden()
  })
})

test('/uk: вибір категорії міняє кадри й підпис картки', async ({ page }) => {
  await page.goto('/uk')
  const tabs = page.getByRole('tablist')
  const weddings = tabs.getByRole('tab', { name: 'Весілля' })
  const portraits = tabs.getByRole('tab', { name: 'Портрети' })
  await expect(weddings).toHaveAttribute('aria-selected', 'true')

  const card = page.getByTestId('hero-gallery-card')
  const shown = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="tabpanel"] img[data-state="on"]')).map(
        (img) => (img as HTMLImageElement).getAttribute('src')
      )
    )
  const before = await shown()
  expect(before).toHaveLength(7)
  await expect(card.locator('[data-state="on"]').first()).toHaveText('Весільні історії')

  await portraits.click()
  await expect(portraits).toHaveAttribute('aria-selected', 'true')
  await expect(weddings).toHaveAttribute('aria-selected', 'false')
  await expect(card.locator('span[data-state="on"]')).toHaveText('Портрети')
  const after = await shown()
  expect(after).toHaveLength(7)
  for (const src of after) expect(before).not.toContain(src)

  // Keyboard: ← goes back to «Весілля».
  await portraits.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(weddings).toBeFocused()
  await expect(weddings).toHaveAttribute('aria-selected', 'true')
  await expect(card.locator('span[data-state="on"]')).toHaveText('Весільні історії')
})

test('/uk: нижня картка — про галерею, без сайту й імені з демо-сайту', async ({ page }) => {
  await page.goto('/uk')
  const text = (await page.getByTestId('hero-gallery-card').textContent()) ?? ''
  expect(text).toContain('Тема')
  expect(text.toLowerCase()).not.toContain('сайт')
  expect(text).not.toMatch(/Романюк|Олена|Romaniuk/)
  // Hidden categories (too few real frames) are not offered.
  await expect(page.getByRole('tab', { name: "Сім'ї" })).toHaveCount(0)
})

for (const width of [1440, 1280, 1024, 768, 390, 360]) {
  test(`/uk @${width}: картки в героїні не перекривають підписи`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/uk')
    await noHorizontalOverflow(page)
    const stage = page.getByRole('tabpanel')
    // Put the stage just under the sticky header.
    await stage.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90))
    await page.waitForTimeout(200)
    // Every text node in the stage is the topmost element at its centre and
    // fully inside the viewport.
    const problems = await stage.evaluate((root) => {
      const out: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        const parent = node.parentElement
        if (!node.textContent?.trim() || !parent) continue
        if (getComputedStyle(parent).visibility === 'hidden' || parent.closest('[data-state="off"]')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of Array.from(range.getClientRects())) {
          if (r.left < 0 || r.right > window.innerWidth + 0.5) out.push(`off-screen: ${node.textContent}`)
          const xs = [r.left + 2, r.left + r.width / 2, r.right - 2]
          const ys = [r.top + 2, r.top + r.height / 2, r.bottom - 2]
          for (const [x, y] of xs.flatMap((x) => ys.map((y) => [x, y]))) {
            const top = document.elementFromPoint(x, y)
            if (top && !parent.contains(top) && !top.contains(parent)) out.push(`covered: ${node.textContent}`)
          }
        }
      }
      return out
    })
    expect(problems).toEqual([])
  })
}

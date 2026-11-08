import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GALLERY_CATALOG,
  GALLERY_STYLE_OF,
  LEGACY_SITE_THEME,
  THEME_CATALOG,
  THEME_IDS,
  resolveGalleryTheme,
  resolveGalleryTokens,
  resolveSiteTheme,
  siteCatalogValue,
} from '@/lib/site/themes'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const V2 = ['start', 'nizhnist', 'kontent', 'lyst', 'portret', 'sviato', 'rozvorot', 'indeks', 'paspartu', 'kontakt', 'temna', 'vydoshukach', 'marshrut']

describe('теми сайтів v2', () => {
  test('усі 13 нових id зареєстровані й є в каталозі редактора', () => {
    for (const id of V2) {
      assert.ok((THEME_IDS as readonly string[]).includes(id), id)
      assert.ok(THEME_CATALOG.some((e) => e.value === id), id)
    }
  })

  test('міграція 0064 дозволяє кожен id каталогу сайту', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0064_site_themes_v2.sql'), 'utf8')
    for (const entry of THEME_CATALOG) {
      if (entry.value === 'opivnich') continue // stored as tysha + night
      assert.match(sql, new RegExp(`'${entry.value}'`), entry.value)
    }
  })

  test('«Плівка», «Галерея», «Архів», «Продакшн» не пропонуються для сайту, але рендеряться найближчою темою', () => {
    for (const old of ['plivka', 'galereia', 'arkhiv', 'prodakshn'] as const) {
      assert.equal(THEME_CATALOG.some((e) => e.value === old), false, old)
      const mapped = resolveSiteTheme(old, 'light')
      assert.ok(V2.includes(mapped.theme), `${old} → ${mapped.theme}`)
      assert.equal(siteCatalogValue(old, 'light'), LEGACY_SITE_THEME[old]!.value)
    }
    assert.equal(siteCatalogValue('tysha', 'night'), 'opivnich')
    assert.equal(siteCatalogValue('start', 'light'), 'start')
  })

  test('стилі галерей не змінились: каталог галерей — ті самі 8, нові теми сайту ведуть на старий стиль', () => {
    assert.deepEqual(
      GALLERY_CATALOG.map((e) => e.value),
      ['tysha', 'opivnich', 'povitria', 'plivka', 'zhurnal', 'galereia', 'arkhiv', 'prodakshn']
    )
    for (const id of V2) {
      const g = resolveGalleryTheme(null, id, 'light')
      assert.deepEqual(g, GALLERY_STYLE_OF[id as keyof typeof GALLERY_STYLE_OF], id)
      assert.ok(GALLERY_CATALOG.some((e) => e.theme === g.theme && e.mode === g.mode), id)
    }
    // site-theme repaints of «Повітря» and «Журнал» do not reach galleries
    assert.equal(resolveGalleryTokens('povitria', 'light').accent, '#1b1a1f')
    assert.equal(resolveGalleryTokens('zhurnal', 'light').accent, '#26242a')
  })
})

/**
 * feat/designer-preview-truth: превʼю в «Дизайні» показує те саме, що клієнт.
 * Колонки й висоти рядків — ті самі gridColumns()/rowTargetHeight() на
 * ширині 1280 (ноутбук) і 390 (телефон); «Рядки» ламаються на тих самих
 * кадрах, що й justifyRows() на справжній ширині; сховані кадри не
 * потрапляють у превʼю, порядок — position, created_at.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  assignMasonryLanes,
  gridColumns,
  justifyRows,
  masonryRatio,
  rowAspect,
  rowTargetHeight,
  type GridLayout,
} from '@/components/gallery/gridLayout'
import {
  PREVIEW_SCREENS,
  clientContentWidth,
  clientCoverHeight,
  clientVisible,
  previewLanes,
  previewMetrics,
  previewRows,
  type PreviewDevice,
} from '@/components/gallery/previewLayout'
import { COLUMN_CHOICES, LAYOUT_CHOICES } from '@/lib/gallery/style'
import { isOwnerPreview } from '@/lib/gallery/owner-preview'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LAYOUTS = LAYOUT_CHOICES.map((choice) => choice.value) as GridLayout[]
const DEVICES: PreviewDevice[] = ['desktop', 'phone']
const VIEWPORT = { desktop: 1280, phone: 390 } as const

describe('превʼю = gridLayout: колонки й висоти рядків', () => {
  test('усі 6 розкладок, обидва пристрої, кожен вибір колонок', () => {
    assert.equal(LAYOUTS.length, 6)
    for (const layout of LAYOUTS)
      for (const device of DEVICES)
        for (const columns of COLUMN_CHOICES)
          for (const frameWidth of [300, 640, 760]) {
            const m = previewMetrics({ device, layout, columns, gap: 14, radius: 10, frameWidth })
            const width = VIEWPORT[device]
            const where = `${layout} · ${device} · ${columns} кол. · рамка ${frameWidth}`
            assert.equal(m.screen.width, width, where)
            assert.equal(m.columns, gridColumns(layout, columns, width), where)
            assert.equal(m.rowTarget, rowTargetHeight(columns, width), where)
          }
  })

  test('«Мозаїка» на телефоні — 1 колонка, на ноутбуці — як вибрано', () => {
    for (const columns of COLUMN_CHOICES) {
      assert.equal(previewMetrics({ device: 'phone', layout: 'masonry', columns, gap: 14, radius: 10 }).columns, 1)
      assert.equal(previewMetrics({ device: 'desktop', layout: 'masonry', columns, gap: 14, radius: 10 }).columns, columns)
    }
  })

  test('рамка: 16:10 і ~9:19.5; ширина контенту 1216 / 362; обкладинка min(88vh, 760)', () => {
    const laptop = previewMetrics({ device: 'desktop', layout: 'masonry', columns: 3, gap: 14, radius: 10, frameWidth: 640 })
    assert.equal(laptop.frame.height, 400)
    assert.equal(laptop.contentWidth, 1216)
    assert.equal(clientCoverHeight(PREVIEW_SCREENS.desktop.height), 704)
    assert.equal(laptop.px.coverHeight, 704 * 0.5)
    assert.equal(laptop.px.coverMargin, 5)
    assert.equal(laptop.px.coverRadius, 8)

    const phone = previewMetrics({ device: 'phone', layout: 'masonry', columns: 3, gap: 14, radius: 10, frameWidth: 300 })
    assert.ok(Math.abs(phone.frame.height / phone.frame.width - 19.5 / 9) < 0.02)
    assert.equal(phone.contentWidth, 362)
    assert.equal(clientContentWidth(390), 362)
    // the cover takes the same share of the frame as of the client's screen
    assert.ok(Math.abs(phone.px.coverHeight / phone.frame.height - clientCoverHeight(844) / 844) < 1e-9)
  })

  test('радіус і проміжки масштабуються пропорційно ширині (1216 / 362)', () => {
    for (const device of DEVICES) {
      const m = previewMetrics({ device, layout: 'square', columns: 3, gap: 20, radius: 22, frameWidth: 300 })
      const k = m.px.contentWidth / m.contentWidth
      assert.ok(Math.abs(k - 300 / VIEWPORT[device]) < 1e-9)
      assert.ok(Math.abs(m.px.gap - 20 * k) < 1e-9)
      assert.ok(Math.abs(m.px.radius - 22 * k) < 1e-9)
    }
  })
})

describe('«Рядки» і «Мозаїка» в превʼю — справжні пропорції', () => {
  const dims = [
    [1600, 1067], [1067, 1600], [1600, 1067], [2000, 1000], [1067, 1600], [1600, 1600],
    [1600, 1067], [900, 1600], [1600, 1067], [1600, 1067], [null, null], [1067, 1600],
  ].map(([width, height]) => ({ width, height }))

  test('рядки ламаються на тих самих кадрах, що й justifyRows на справжній ширині', () => {
    for (const device of DEVICES)
      for (const columns of COLUMN_CHOICES)
        for (const gap of [0, 14, 30]) {
          const m = previewMetrics({ device, layout: 'rows', columns, gap, radius: 10, frameWidth: device === 'phone' ? 300 : 640 })
          const real = justifyRows(dims.map((d) => rowAspect(d.width, d.height)), m.contentWidth, rowTargetHeight(columns, VIEWPORT[device]), gap)
          const shown = previewRows(dims, m, false)
          assert.deepEqual(shown.map((r) => [r.row.start, r.row.end]), real.map((r) => [r.start, r.end]))
          shown.forEach((r, i) => {
            assert.ok(Math.abs(r.row.height - real[i].height * m.scale) < 1e-6, 'висота рядка × масштаб')
            // every frame whole: width ÷ height = the photo's
            r.widths.forEach((w, j) => {
              const d = dims[r.row.start + j]
              assert.ok(Math.abs(w / r.row.height - rowAspect(d.width, d.height)) < 1e-9)
            })
          })
        }
  })

  test('не всі кадри в превʼю → незавершений останній рядок не показуємо', () => {
    const m = previewMetrics({ device: 'phone', layout: 'rows', columns: 3, gap: 14, radius: 10 })
    const all = previewRows(dims, m, false)
    const cut = previewRows(dims, m, true)
    assert.equal(cut.length, all.length - 1)
  })

  test('мозаїка: ті самі колонки, що в клієнта (assignMasonryLanes)', () => {
    for (const device of DEVICES) {
      const columns = gridColumns('masonry', 3, VIEWPORT[device])
      assert.deepEqual(previewLanes(dims, columns), assignMasonryLanes(dims.map((d) => masonryRatio(d.width, d.height)), columns).lanes)
    }
  })
})

describe('фото для превʼю: як у клієнта', () => {
  const asset = (id: string, position: number, created_at: string, hidden = false) => ({
    id,
    position,
    created_at,
    hidden_from_client: hidden,
  })

  test('сховані кадри не потрапляють у превʼю; порядок — position, created_at', () => {
    const { visible } = clientVisible(
      [
        asset('c', 2, '2026-01-01T00:00:00Z'),
        asset('hidden', 0, '2026-01-01T00:00:00Z', true),
        asset('b2', 1, '2026-01-03T00:00:00Z'),
        asset('b1', 1, '2026-01-02T00:00:00Z'),
        asset('a', 0, '2026-01-05T00:00:00Z'),
      ],
      null
    )
    assert.deepEqual(visible.map((a) => a.id), ['a', 'b1', 'b2', 'c'])
  })

  test('обкладинка: вибрана, якщо клієнт її бачить; інакше перший видимий кадр', () => {
    const assets = [asset('x', 0, 'a', true), asset('y', 1, 'b'), asset('z', 2, 'c')]
    assert.equal(clientVisible(assets, 'z').cover?.id, 'z')
    assert.equal(clientVisible(assets, 'x').cover?.id, 'y', 'схована обкладинка → перший видимий')
    assert.equal(clientVisible(assets, null).cover?.id, 'y')
    assert.equal(clientVisible([asset('h', 0, 'a', true)], 'h').cover, null)
  })
})

describe('?preview=1 на /g/[slug]: перегляд не рахуємо лише для власниці', () => {
  const GALLERY = 'g-1'
  const OWNER = 'owner-1'
  /** Supabase stub: auth.getUser() + galleries filtered by .eq(), as PostgREST would. */
  const client = (userId: string | null, calls: string[] = []) =>
    ({
      auth: {
        getUser: async () => {
          calls.push('getUser')
          return { data: { user: userId ? { id: userId } : null }, error: null }
        },
      },
      from: (table: string) => {
        const filters: [string, string][] = []
        const builder = {
          select: () => builder,
          eq: (column: string, value: string) => (filters.push([column, value]), builder),
          maybeSingle: async () => {
            calls.push(`from:${table}`)
            const rows = [{ id: GALLERY, owner_id: OWNER }].filter((row) =>
              filters.every(([column, value]) => String(row[column as keyof typeof row]) === value)
            )
            return { data: rows[0] ? { id: rows[0].id } : null, error: null }
          },
        }
        return builder
      },
    }) as unknown as Parameters<typeof isOwnerPreview>[2]

  test('власниця цієї галереї з ?preview=1 → перегляд не рахується', async () => {
    assert.equal(await isOwnerPreview('1', GALLERY, client(OWNER)), true)
  })

  test('будь-хто інший з ?preview=1 → параметр ігнорується, перегляд рахується', async () => {
    assert.equal(await isOwnerPreview('1', GALLERY, client('someone-else')), false, 'інший фотограф')
    assert.equal(await isOwnerPreview('1', GALLERY, client(null)), false, 'клієнт без входу')
    assert.equal(await isOwnerPreview('1', 'other-gallery', client(OWNER)), false, 'власниця, але чужа галерея')
  })

  test('без ?preview=1 — навіть власниця рахується, і зайвих запитів немає', async () => {
    const calls: string[] = []
    assert.equal(await isOwnerPreview(undefined, GALLERY, client(OWNER, calls)), false)
    assert.equal(await isOwnerPreview('yes', GALLERY, client(OWNER, calls)), false)
    assert.deepEqual(calls, [])
  })

  test('збій авторизації → рахуємо перегляд', async () => {
    const broken = { auth: { getUser: async () => { throw new Error('down') } }, from: () => ({}) } as unknown as Parameters<typeof isOwnerPreview>[2]
    assert.equal(await isOwnerPreview('1', GALLERY, broken), false)
  })

  test('сторінка галереї вирішує через isOwnerPreview, а не за самим параметром', () => {
    const page = readFileSync(join(__dirname, '..', '..', 'src/app/[locale]/g/[slug]/page.tsx'), 'utf8')
    assert.match(page, /const ownerPreview = await isOwnerPreview\(searchParams\.preview, gallery\.id, supabase\)/)
    assert.doesNotMatch(page, /searchParams\.preview === '1'/)
    assert.match(page, /if \(!ownerPreview\) waitUntil\(/)
    assert.match(page, /if \(!ownerPreview && gallery\.view_count < 20/)
  })
})

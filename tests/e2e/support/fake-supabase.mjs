// Fake Supabase for the dashboard e2e (tests/e2e/dashboard.spec.ts).
//
// The e2e dev server talks to NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
// (playwright.config.ts). Before this file existed nothing listened there, so
// every query failed with a connection error. That behaviour is kept for
// everyone except the signed-in e2e photographer: requests carrying the anon
// or service key are dropped (socket destroyed = the same «fetch failed»), and
// only the e2e user's token gets answers. So the other specs see exactly what
// they saw before.
//
// What it answers for the e2e user:
//   GET  /auth/v1/user                    → the photographer
//   *    /rest/v1/<table>?<filters>       → a tiny in-memory PostgREST
//   POST /rest/v1/rpc/<fn>                → null
//   GET  /media/<key>                     → a demo photo (MEDIA_CDN_URL)
//   POST /__e2e/reset   {scenario}        → reseed the tables
//   POST /__e2e/insert  {table,row}       → add a row (the tests' «upload»)
//   POST /__e2e/schema  {downloadsColumn} → pretend migration 0070 is (not) applied
//
// The client gallery (/g/[slug]) and the download routes read with the anon
// and service keys. Those requests are answered only when they are about an
// e2e gallery or photo (its id or slug is in the URL or body), with the anon
// key seeing published galleries only (RLS). Everything else is still dropped.
//   GET  /__e2e/state                     → dump the tables
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.FAKE_SUPABASE_PORT || 54321)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const E2E_TOKEN = 'e2e-photographer-token'
export const E2E_USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'olha@e2e.test' }
// The platform owner (src/lib/admin.ts DEFAULT_ADMINS): sees sections hidden
// from photographers (tests/e2e/hide-sites.spec.ts). Owns no galleries here.
export const E2E_OWNER_TOKEN = 'e2e-owner-token'
export const E2E_OWNER = { id: '00000000-0000-4000-8000-0000000000e3', email: 'dianahohol97@gmail.com' }

const now = () => new Date().toISOString()
const daysAgo = (n) => new Date(Date.now() - n * 86400_000).toISOString()

function gallery(id, title, extra = {}) {
  return {
    id,
    owner_id: E2E_USER.id,
    slug: `olha-vyshnia-${id.slice(0, 6)}`,
    title,
    description: null,
    event_date: null,
    cover_asset_id: null,
    has_password: false,
    expires_at: null,
    free_expires_at: null,
    free_expired_at: null,
    free_purged_at: null,
    is_published: false,
    downloads_enabled: true,
    delivery_status: null,
    delivery_eta: null,
    view_count: 0,
    theme: null,
    style: null,
    created_at: now(),
    updated_at: now(),
    ...extra,
  }
}

function photos(galleryId, count, start = 1) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(((start + i - 1) % 15) + 1).padStart(2, '0')
    const id = `${galleryId.slice(0, 8)}-a${String(i).padStart(3, '0')}`
    const base = `u/${E2E_USER.id}/g/${galleryId}`
    return {
      id,
      gallery_id: galleryId,
      owner_id: E2E_USER.id,
      r2_key: `${base}/o/00000000-0000-0000-0000-00000000000${i % 10}-DSC_${n}${i}.jpg`,
      kind: 'photo',
      content_type: 'image/jpeg',
      width: 1600,
      height: 1067,
      size_bytes: 4_000_000,
      variants: { thumb: `${base}/v/${n}-${i}-thumb.jpg`, preview: `${base}/v/${n}-${i}-preview.jpg` },
      position: i,
      hidden_from_client: false,
      focal_x: null,
      focal_y: null,
      created_at: daysAgo(1),
    }
  })
}

function profile(plan = 'plus') {
  return {
    user_id: E2E_USER.id,
    email: E2E_USER.email,
    display_name: 'Ольга Вишня',
    plan,
    grace_until: null,
    storage_used_bytes: 7.4 * 1024 ** 3,
    storage_limit_bytes: 200 * 1024 ** 3,
    watermark_enabled: false,
    created_at: daysAgo(90),
  }
}

/** Seed data per scenario. `empty` — a brand-new photographer. */
function seed(scenario) {
  const db = { profiles: [profile()], galleries: [], assets: [], gallery_events: [], selections: [] }
  if (scenario === 'empty') return db
  const g1 = gallery('11111111-1111-4111-8111-111111111111', 'Марта і Богдан · весілля', {
    is_published: true,
    has_password: true,
    event_date: '2026-09-14',
    view_count: 128,
    delivery_status: 'ready',
    created_at: daysAgo(20),
    updated_at: daysAgo(2),
  })
  const g2 = gallery('22222222-2222-4222-8222-222222222222', 'Сімейна прогулянка в Карпатах', {
    is_published: true,
    event_date: '2026-10-03',
    view_count: 41,
    delivery_status: 'editing',
    delivery_eta: '2026-11-20',
    created_at: daysAgo(12),
    updated_at: daysAgo(5),
  })
  const g3 = gallery('33333333-3333-4333-8333-333333333333', 'Аня · портрет у студії', {
    event_date: '2026-11-01',
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
  })
  const g4 = gallery('44444444-4444-4444-8444-444444444444', 'Хрещення Софійки', {
    is_published: true,
    event_date: '2026-08-22',
    view_count: 63,
    created_at: daysAgo(40),
    updated_at: daysAgo(30),
  })
  db.galleries.push(g1, g2, g3, g4)
  db.assets.push(...photos(g1.id, 12, 1), ...photos(g2.id, 3, 5), ...photos(g4.id, 8, 9))
  const g1Assets = db.assets.filter((a) => a.gallery_id === g1.id)
  for (const [i, asset] of g1Assets.slice(0, 5).entries()) {
    db.selections.push({ gallery_id: g1.id, asset_id: asset.id, kind: 'favorite', client_token: i < 3 ? 'c1' : 'c2' })
  }
  db.gallery_events.push(
    ...Array.from({ length: 9 }, (_, i) => ({ gallery_id: g1.id, type: 'download', meta: { asset_id: g1Assets[i % 4].id } }))
  )
  return db
}

let db = seed(process.env.FAKE_SUPABASE_SCENARIO || 'full')
/** false — galleries.downloads_enabled does not exist (0070 not applied). */
let downloadsColumn = true

// ---------------------------------------------------------------- PostgREST

function parseValue(raw) {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

function matches(row, column, expr) {
  const dot = expr.indexOf('.')
  let op = expr.slice(0, dot)
  let arg = expr.slice(dot + 1)
  let negate = false
  if (op === 'not') {
    negate = true
    const rest = arg
    op = rest.slice(0, rest.indexOf('.'))
    arg = rest.slice(rest.indexOf('.') + 1)
  }
  const value = row[column]
  let ok
  switch (op) {
    case 'eq':
      ok = String(value) === arg
      break
    case 'neq':
      ok = String(value) !== arg
      break
    case 'is':
      ok = value === parseValue(arg) || (arg === 'null' && value === undefined)
      break
    case 'in': {
      const list = arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
      ok = list.includes(String(value))
      break
    }
    case 'gt':
      ok = value > arg
      break
    case 'gte':
      ok = value >= arg
      break
    case 'lt':
      ok = value < arg
      break
    case 'lte':
      ok = value <= arg
      break
    case 'ilike':
      ok = new RegExp(`^${arg.replace(/[*%]/g, '.*')}$`, 'i').test(String(value ?? ''))
      break
    default:
      ok = true
  }
  return negate ? !ok : ok
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function filterRows(rows, params) {
  return rows.filter((row) => {
    for (const [key, expr] of params) {
      if (RESERVED.has(key) || key === 'or' || key === 'and') continue
      if (!matches(row, key, expr)) return false
    }
    return true
  })
}

function orderRows(rows, order) {
  if (!order) return rows
  const keys = order.split(',').map((part) => {
    const [column, dir] = part.split('.')
    return { column, desc: dir === 'desc' }
  })
  return [...rows].sort((a, b) => {
    for (const { column, desc } of keys) {
      const x = a[column] ?? ''
      const y = b[column] ?? ''
      if (x < y) return desc ? 1 : -1
      if (x > y) return desc ? -1 : 1
    }
    return 0
  })
}

function send(res, status, body, headers = {}) {
  const text = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
  })
}

function respondRows(req, res, rows, total) {
  const wantsObject = (req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
  const headers = {}
  if ((req.headers.prefer ?? '').includes('count=')) {
    headers['Content-Range'] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    return res.end()
  }
  if (wantsObject) {
    if (rows.length !== 1) {
      return send(res, 406, {
        code: 'PGRST116',
        details: `The result contains ${rows.length} rows`,
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      })
    }
    return send(res, 200, rows[0], headers)
  }
  return send(res, 200, rows, headers)
}

const MISSING_COLUMN = {
  code: '42703',
  details: null,
  hint: null,
  message: 'column galleries.downloads_enabled does not exist',
}

const ANON_KEY = 'e2e-placeholder-anon-key'
const SERVICE_KEY = 'e2e-placeholder-service-key'

/** Does this request name an e2e gallery (id or slug) or one of its photos? */
function aboutE2E(text) {
  const keys = [
    ...db.galleries.flatMap((g) => [g.id, g.slug]),
    ...db.assets.map((a) => a.id),
  ].filter(Boolean)
  return keys.some((key) => text.includes(key))
}

async function rest(req, res, url, role = 'user', body = undefined) {
  const table = url.pathname.replace('/rest/v1/', '')
  if (table.startsWith('rpc/')) {
    // get_gallery_branding returns a set; the rest are scalars or void.
    return send(res, 200, table === 'rpc/get_gallery_branding' || table === 'rpc/list_selections' ? [] : null)
  }
  if (!db[table]) db[table] = []
  const params = [...url.searchParams.entries()]
  const select = url.searchParams.get('select') ?? ''
  if (table === 'galleries' && !downloadsColumn && select.includes('downloads_enabled')) {
    return send(res, 400, MISSING_COLUMN)
  }
  // RLS: the anon key sees published galleries only.
  const visible = (rows) =>
    role === 'anon' && table === 'galleries' ? rows.filter((row) => row.is_published) : rows
  const strip = (rows) =>
    !downloadsColumn && table === 'galleries'
      ? rows.map(({ downloads_enabled, ...rest }) => rest)
      : rows

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = strip(visible(filterRows(db[table], params)))
    const total = rows.length
    rows = orderRows(rows, url.searchParams.get('order'))
    const offset = Number(url.searchParams.get('offset') || 0)
    const limit = url.searchParams.get('limit')
    rows = rows.slice(offset, limit ? offset + Number(limit) : undefined)
    return respondRows(req, res, rows, total)
  }
  if (role !== 'user' && req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 401, { message: 'e2e fake: writes only for the photographer' })
  }
  if (req.method === 'POST') {
    const input = Array.isArray(body) ? body : [body]
    const created = input.map((row) => {
      const full = { id: randomUUID(), created_at: now(), updated_at: now(), ...row }
      if (table === 'galleries') {
        Object.assign(full, { ...gallery(full.id, full.title), ...full })
        full.has_password = !!row.password_hash
        delete full.password_hash
      }
      db[table].push(full)
      return full
    })
    return respondRows(req, res, created, created.length)
  }
  if (req.method === 'PATCH') {
    const patch = body ?? {}
    if (table === 'galleries' && !downloadsColumn && 'downloads_enabled' in patch) {
      return send(res, 400, MISSING_COLUMN)
    }
    const rows = filterRows(db[table], params)
    for (const row of rows) {
      Object.assign(row, patch, { updated_at: now() })
      if ('password_hash' in patch) {
        row.has_password = !!patch.password_hash
        delete row.password_hash
      }
    }
    return respondRows(req, res, rows, rows.length)
  }
  if (req.method === 'DELETE') {
    const rows = filterRows(db[table], params)
    db[table] = db[table].filter((row) => !rows.includes(row))
    return respondRows(req, res, rows, rows.length)
  }
  return send(res, 405, { message: 'method not allowed' })
}

// ---------------------------------------------------------------- server

function mediaFile(key) {
  const match = key.match(/\/v\/(\d{2})-/)
  const n = match ? match[1] : String((key.length % 15) + 1).padStart(2, '0')
  const file = join(ROOT, 'public', 'showcase', `${n}.jpg`)
  return existsSync(file) ? file : join(ROOT, 'public', 'showcase', '01.jpg')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (url.pathname === '/__e2e/health') return send(res, 200, { ok: true })
  if (url.pathname === '/__e2e/reset' && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    db = seed(body.scenario ?? 'full')
    downloadsColumn = true
    return send(res, 200, { ok: true })
  }
  if (url.pathname === '/__e2e/insert' && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    const row = { id: randomUUID(), created_at: now(), ...body.row }
    ;(db[body.table] ??= []).push(row)
    return send(res, 200, row)
  }
  if (url.pathname === '/__e2e/state') return send(res, 200, db)
  if (url.pathname === '/__e2e/schema' && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    downloadsColumn = body.downloadsColumn !== false
    return send(res, 200, { ok: true })
  }
  if (url.pathname.startsWith('/media/')) {
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' })
    return res.end(readFileSync(mediaFile(url.pathname)))
  }

  const auth = req.headers.authorization ?? ''
  // The platform owner (tests/e2e/hide-sites.spec.ts) is a signed-in user too.
  const asOwner = auth === `Bearer ${E2E_OWNER_TOKEN}`
  const role =
    auth === `Bearer ${E2E_TOKEN}` || asOwner ? 'user' : auth === `Bearer ${ANON_KEY}` ? 'anon' : auth === `Bearer ${SERVICE_KEY}` ? 'service' : null
  const body = ['POST', 'PATCH'].includes(req.method ?? '') ? await readBody(req) : undefined
  // Anon / service: only questions about an e2e gallery or photo get answers;
  // everything else behaves as if nothing listened here (as before).
  if (role !== 'user') {
    if (role && url.pathname.startsWith('/rest/v1/') && aboutE2E(`${decodeURIComponent(url.search)} ${JSON.stringify(body ?? '')}`)) {
      return rest(req, res, url, role, body)
    }
    req.socket.destroy()
    return
  }

  if (url.pathname === '/auth/v1/user') {
    const who = asOwner ? E2E_OWNER : E2E_USER
    return send(res, 200, {
      id: who.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: who.email,
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: daysAgo(90),
    })
  }
  if (url.pathname.startsWith('/rest/v1/')) return rest(req, res, url, 'user', body)
  if (url.pathname.startsWith('/auth/v1/')) return send(res, 200, {})
  return send(res, 404, { message: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake supabase on http://127.0.0.1:${PORT}`)
})

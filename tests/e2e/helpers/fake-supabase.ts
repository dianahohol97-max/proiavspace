/**
 * A tiny stand-in for Supabase (auth + PostgREST) on 127.0.0.1:54321 — the
 * URL playwright.config.ts already gives `next dev`. Enough for the logged-in
 * «Бронювання» dashboard: the session cookie is accepted, the profile and
 * booking tables are served from memory, inserts/deletes are recorded.
 * Nothing real is reached.
 */
import { createServer, type Server } from 'node:http'

export const FAKE_USER_ID = '7d1f3c1e-0000-4000-8000-000000000001'

type Row = Record<string, unknown>

export interface FakeState {
  settings: Row | null
  slots: Row[]
  inserts: Row[][]
  /** Public RPC answers by function name (get_site, get_free_slots…). */
  rpc: Record<string, unknown>
  /** Bodies of upserts/updates sent to booking_settings. */
  settingsWrites: Row[]
}

export function newState(): FakeState {
  return { settings: null, slots: [], inserts: [], rpc: {}, settingsWrites: [] }
}

export function sessionCookie(): { name: string; value: string } {
  const now = Math.floor(Date.now() / 1000)
  const session = {
    access_token: 'e2e-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user: fakeUser(),
  }
  return {
    name: 'sb-127-auth-token',
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
  }
}

function fakeUser() {
  return {
    id: FAKE_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'olena@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  }
}

const profile = {
  user_id: FAKE_USER_ID,
  display_name: 'Олена Романюк',
  plan: 'basic',
  storage_used_bytes: 12 * 1024 ** 3,
  storage_limit_bytes: 100 * 1024 ** 3,
  grace_until: null,
  logo_url: null,
}

/**
 * PostgREST row filters from the query string (eq/gt/gte/lt/lte/in/is and
 * not.is) — enough for the booking code. Multiple filters on one column
 * (starts_at=gte…&starts_at=lt…) are all applied.
 */
function matches(row: Row, params: URLSearchParams): boolean {
  for (const [col, expr] of params) {
    if (['select', 'limit', 'order', 'on_conflict', 'columns', 'offset'].includes(col)) continue
    const neg = expr.startsWith('not.')
    const e = neg ? expr.slice(4) : expr
    const dot = e.indexOf('.')
    const op = e.slice(0, dot)
    const val = decodeURIComponent(e.slice(dot + 1))
    const cell = row[col]
    let ok: boolean
    if (op === 'eq') ok = String(cell) === val
    else if (op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
      if (cell === null || cell === undefined) ok = false
      else {
        const num = typeof cell === 'number' || /^-?\d+(\.\d+)?$/.test(val)
        const a = num ? Number(cell) : String(cell)
        const b = num ? Number(val) : val
        ok = op === 'gt' ? a > b : op === 'lt' ? a < b : op === 'gte' ? a >= b : a <= b
      }
    } else if (op === 'in') ok = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(cell))
    else if (op === 'is') ok = val === 'null' ? cell === null || cell === undefined : String(cell) === val
    else ok = true
    if (neg ? ok : !ok) return false
  }
  return true
}

/** Kyiv wall clock now, as booking_slots.starts_at is stored. */
function kyivNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Kyiv' }).replace(' ', 'T')
}

export function startFakeSupabase(state: FakeState, port = 54321): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(body === undefined ? '' : JSON.stringify(body))
    }
    const rows = (list: Row[]) => {
      if (wantsObject) return list.length ? send(200, list[0]) : send(406, { code: 'PGRST116', message: 'no rows' })
      return send(200, list)
    }
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null
      const p = url.pathname
      if (p === '/auth/v1/user') return send(200, fakeUser())
      if (p.startsWith('/rest/v1/rpc/')) {
        const fn = p.slice('/rest/v1/rpc/'.length)
        if (fn in state.rpc) return send(200, state.rpc[fn])
        if (fn === 'release_expired_slots') {
          // 0005/0060: priced bookings unpaid for longer than the owner's window.
          const hours = Number(state.settings?.unpaid_release_hours ?? 24)
          let n = 0
          for (const b of state.slots) {
            if (
              b.owner_id === body?.p_owner &&
              b.status === 'booked' &&
              Number(b.price_uah) > 0 &&
              hours > 0 &&
              Date.parse(String(b.booked_at)) < Date.now() - hours * 3_600_000
            ) {
              Object.assign(b, {
                status: 'free', client_name: null, client_phone: null, client_email: null,
                booking_token: null, payment_method: null, invoice_id: null, booked_at: null,
              })
              n++
            }
          }
          return send(200, n)
        }
        if (fn === 'get_free_slots') {
          if (!state.settings?.enabled || state.settings.handle !== body?.p_handle) return send(200, [])
          const now = kyivNow()
          return send(
            200,
            state.slots
              .filter((b) => b.status === 'free' && String(b.starts_at) > now)
              .map((b) => ({ id: b.id, starts_at: b.starts_at, duration_minutes: b.duration_minutes, price_uah: b.price_uah }))
          )
        }
        if (fn === 'get_booking_profile') {
          if (!state.settings?.enabled || state.settings.handle !== body?.p_handle) return send(200, [])
          return send(200, [{ display_name: 'Олена Романюк', logo_key: null, has_mono: false, has_wfp: false, manual_link: null, card_details: null }])
        }
        return send(200, null)
      }
      if (p === '/rest/v1/profiles') return rows([profile])
      if (p === '/rest/v1/booking_settings') {
        if (req.method === 'GET') {
          return rows(state.settings && matches(state.settings, url.searchParams) ? [state.settings] : [])
        }
        const write = (Array.isArray(body) ? body[0] : body) as Row
        state.settingsWrites.push(write)
        state.settings = { ...(state.settings ?? {}), ...write }
        return send(204, undefined)
      }
      if (p === '/rest/v1/booking_slots') {
        if (req.method === 'POST') {
          const prefer = String(req.headers.prefer ?? '')
          const incoming: Row[] = Array.isArray(body) ? body : [body]
          // ON CONFLICT (owner_id, starts_at) DO NOTHING, like the 0058 unique index.
          const taken = (r: Row) =>
            state.slots.some((s) => s.owner_id === r.owner_id && s.starts_at === r.starts_at)
          const list = prefer.includes('ignore-duplicates') ? incoming.filter((r) => !taken(r)) : incoming
          state.inserts.push(list)
          const created: Row[] = []
          for (const r of list) {
            created.push({ id: crypto.randomUUID(), ...r })
            state.slots.push({
              id: created[created.length - 1].id,
              status: 'free',
              client_name: null,
              client_phone: null,
              client_email: null,
              ...r,
            })
          }
          state.slots.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
          return send(201, prefer.includes('return=representation') ? created.map((r) => ({ id: r.id })) : undefined)
        }
        if (req.method === 'DELETE') {
          const gone = state.slots.filter((s) => matches(s, url.searchParams))
          state.slots = state.slots.filter((s) => !gone.includes(s))
          return send(200, gone.map((s) => ({ id: s.id })))
        }
        if (req.method === 'PATCH') {
          const hit = state.slots.filter((s) => matches(s, url.searchParams))
          for (const r of hit) Object.assign(r, body)
          return send(200, hit)
        }
        return rows(state.slots.filter((s) => matches(s, url.searchParams)))
      }
      return send(200, [])
    })
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

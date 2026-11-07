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
}

export function newState(): FakeState {
  return { settings: null, slots: [], inserts: [], rpc: {} }
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
        return send(200, fn === 'release_expired_slots' ? 0 : null)
      }
      if (p === '/rest/v1/profiles') return rows([profile])
      if (p === '/rest/v1/booking_settings') {
        if (req.method === 'GET') return rows(state.settings ? [state.settings] : [])
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
          const ids = /^in\.\((.*)\)$/.exec(url.searchParams.get('id') ?? '')?.[1]?.split(',') ?? []
          const gone = state.slots.filter((s) => ids.includes(String(s.id)) && s.status === 'free')
          state.slots = state.slots.filter((s) => !gone.includes(s))
          return send(200, gone.map((s) => ({ id: s.id })))
        }
        return rows(state.slots)
      }
      return send(200, [])
    })
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

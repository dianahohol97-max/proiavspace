/**
 * Test harness for the referral system. Talks to the throwaway database that
 * tests/referrals/run.sh brings up: fixtures go in as the Postgres superuser
 * (psql), everything under test goes through PostgREST with real JWTs, so RLS
 * and function grants are enforced exactly as on Supabase.
 */
import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { mock } from 'node:test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REST = process.env.REF_TEST_REST
const SECRET = process.env.REF_TEST_JWT_SECRET ?? ''
export const dbAvailable = !!REST && !!process.env.REF_TEST_PSQL_HOST

/** Run SQL as the Postgres superuser (fixtures and inspection only). */
export function pg(sql: string): string {
  return execFileSync(
    'psql',
    [
      '-h', process.env.REF_TEST_PSQL_HOST!,
      '-p', process.env.REF_TEST_PG_PORT!,
      '-U', 'postgres', '-d', 'app',
      '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql,
    ],
    { encoding: 'utf8' }
  ).trim()
}

export const q = (value: string) => `'${value.replace(/'/g, "''")}'`

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

export function jwt(claims: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  )
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

/**
 * supabase-js calls `<url>/rest/v1/...`; PostgREST serves at `/`. A tiny
 * in-process proxy strips the prefix.
 */
let proxyUrl: string | null = null
export async function startProxy(): Promise<string> {
  if (proxyUrl) return proxyUrl
  const target = new URL(REST!)
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      {
        host: target.hostname,
        port: target.port,
        method: req.method,
        path: (req.url ?? '/').replace(/^\/rest\/v1/, ''),
        headers: { ...req.headers, host: target.host },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      }
    )
    upstream.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(upstream)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  server.unref()
  proxyUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return proxyUrl
}

export const anonKey = () => jwt({ role: 'anon' })
export const serviceKey = () => jwt({ role: 'service_role' })

/** A supabase-js client acting as a signed-in user (RLS applies). */
export function userClient(url: string, userId: string): SupabaseClient {
  return createClient(url, anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt({ role: 'authenticated', sub: userId })}` } },
  })
}

export function anonClient(url: string): SupabaseClient {
  return createClient(url, anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Sign up a user the way Supabase Auth does it: a row in auth.users with the
 * signUp() `data` as raw_user_meta_data — the handle_new_user trigger does the rest.
 */
export function signUp(opts: { ref?: string | null; email?: string } = {}): string {
  const email = opts.email ?? `${randomUUID().slice(0, 8)}@test.local`
  const meta = opts.ref === undefined || opts.ref === null ? '{}' : JSON.stringify({ ref: opts.ref })
  return pg(
    `insert into auth.users (email, raw_user_meta_data) values (${q(email)}, ${q(meta)}::jsonb) returning id`
  )
}

export function codeOf(userId: string): string {
  return pg(`select referral_code from public.profiles where user_id = ${q(userId)}`)
}

export interface ProfileRow {
  referred_by: string | null
  credit_balance_kop: number
  cash_balance_kop: number
  plan: string
}
export function profile(userId: string): ProfileRow {
  const row = pg(
    `select json_build_object('referred_by', referred_by, 'credit_balance_kop', credit_balance_kop,
       'cash_balance_kop', cash_balance_kop, 'plan', plan)
     from public.profiles where user_id = ${q(userId)}`
  )
  return JSON.parse(row) as ProfileRow
}

export function earnings(referrerId: string): { amount_kop: number; kind: string; payment_id: string | null }[] {
  const rows = pg(
    `select coalesce(json_agg(json_build_object('amount_kop', amount_kop, 'kind', kind, 'payment_id', payment_id)), '[]')
     from public.referral_earnings where referrer_id = ${q(referrerId)}`
  )
  return JSON.parse(rows)
}

export function referralStatus(referredId: string): string {
  return pg(`select coalesce((select status from public.referrals where referred_id = ${q(referredId)}), 'none')`)
}

/** A pending checkout row, as /api/billing/checkout writes it. */
export function pendingPayment(opts: {
  userId: string
  plan?: string
  period?: string
  amount: number
  creditAppliedKop?: number
  subscriptionId?: string
}): { id: string; orderId: string } {
  const orderId = randomUUID()
  const id = pg(
    `insert into public.payments (user_id, provider, order_id, plan, period, amount, currency, status, credit_applied_kop, subscription_id)
     values (${q(opts.userId)}, 'monobank', ${q(orderId)}, ${q(opts.plan ?? 'basic')}, ${q(opts.period ?? 'month')},
             ${opts.amount}, 'UAH', 'pending', ${opts.creditAppliedKop ?? 0},
             ${opts.subscriptionId ? q(opts.subscriptionId) : 'null'})
     returning id`
  )
  return { id, orderId }
}

// ---------------------------------------------------------------------------
// Module mocks for the Next.js routes. The payment provider is faked (no
// Monobank calls); Supabase is the real local stack behind PostgREST.
// ---------------------------------------------------------------------------

const root = path.resolve(__dirname, '../..')
const modUrl = (rel: string) => pathToFileURL(path.join(root, rel)).href

export interface FakeProvider {
  name: string
  recurring: boolean
  checkouts: { orderId: string; amount: number; description: string }[]
  charges: { orderId: string; amount: number }[]
  /** What the next chargeToken() call answers. */
  chargeResult: 'paid' | 'failed' | 'pending'
}

export const provider: FakeProvider = {
  name: 'monobank',
  recurring: false,
  checkouts: [],
  charges: [],
  chargeResult: 'paid',
}

/** The signed-in user the mocked cookie-based server client acts as. */
export const session: { userId: string | null } = { userId: null }

let mocked = false
export async function installMocks(): Promise<void> {
  if (mocked) return
  mocked = true
  const url = await startProxy()
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey()
  process.env.NEXT_PUBLIC_APP_URL = 'https://proiav.test'
  process.env.CRON_SECRET = 'cron-test'
  delete process.env.BREVO_API_KEY

  const fake = {
    get name() { return provider.name },
    get recurring() { return provider.recurring },
    async parseWebhook(raw: string) {
      return JSON.parse(raw)
    },
    async createCheckoutForm(req: { orderId: string; amount: number; description: string }) {
      provider.checkouts.push({ orderId: req.orderId, amount: req.amount, description: req.description })
      return { url: `https://pay.test/${req.orderId}` }
    },
    async chargeToken(req: { orderId: string; amount: number }) {
      provider.charges.push({ orderId: req.orderId, amount: req.amount })
      return provider.chargeResult
    },
    async deleteToken() {},
    async lookupCharge() {
      return 'unknown' as const
    },
  }

  mock.module(modUrl('src/lib/payments/index.ts'), {
    namedExports: {
      getPayments: () => fake,
      missingPaymentEnv: () => [],
      canChargeTokens: (p: { chargeToken?: unknown }) => typeof p.chargeToken === 'function',
    },
  })
  mock.module(modUrl('src/lib/supabase/server.ts'), {
    namedExports: {
      createSupabaseServerClient: () => {
        if (!session.userId) return anonClient(url)
        // No GoTrue in the local stack: the cookie session resolves to this user.
        const client = userClient(url, session.userId)
        const user = { id: session.userId, email: `${session.userId}@test.local` }
        client.auth.getUser = (async () => ({ data: { user }, error: null })) as never
        return client
      },
    },
  })
}

/** Deliver a (fake-signed) provider webhook to the real route handler. */
export async function deliverWebhook(event: {
  orderId: string
  status: 'paid' | 'failed' | 'canceled' | 'pending' | 'other'
  cardToken?: string
}): Promise<number> {
  const { POST } = await import('@/app/api/billing/webhook/route')
  const res = await POST(
    new Request('https://proiav.test/api/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({ ...event, raw: { test: true } }),
    }) as never
  )
  return res.status
}

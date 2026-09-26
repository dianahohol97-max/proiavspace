/**
 * Throwaway local Postgres with every migration from supabase/migrations
 * applied on top of sql/supabase-stub.sql. Needs the Postgres server
 * binaries (initdb/pg_ctl/psql, any version ≥ 15); without them the SQL
 * tests are skipped, not failed. Never touches the Supabase project.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..', '..')
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')
const STUB = join(__dirname, '..', 'sql', 'supabase-stub.sql')

function findBin(name: string): string | null {
  const fromPath = spawnSync('sh', ['-c', `command -v ${name}`]).stdout.toString().trim()
  if (fromPath) return fromPath
  const base = '/usr/lib/postgresql'
  if (!existsSync(base)) return null
  for (const version of readdirSync(base).sort().reverse()) {
    const candidate = join(base, version, 'bin', name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export interface LocalPg {
  /** Runs SQL as the superuser; returns psql's unaligned, tuples-only output. */
  sql(query: string): string
  /** Like sql(), but returns the error text instead of throwing. */
  trySql(query: string): { ok: boolean; out: string }
  stop(): void
  /** Migrations that failed to apply (file name → first error line). */
  failedMigrations: Record<string, string>
}

export function startLocalPg(): LocalPg | null {
  const initdb = findBin('initdb')
  const pgCtl = findBin('pg_ctl')
  const psql = findBin('psql')
  if (!initdb || !pgCtl || !psql) return null

  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  // initdb refuses to run as root; fall back to the distro's postgres user.
  const asPg = (bin: string, args: string[]) =>
    isRoot
      ? execFileSync('runuser', ['-u', 'postgres', '--', bin, ...args], { stdio: 'pipe' })
      : execFileSync(bin, args, { stdio: 'pipe' })

  const dir = mkdtempSync(join(tmpdir(), 'proiav-audit-pg-'))
  chmodSync(dir, 0o777)
  const port = String(56000 + Math.floor(Math.random() * 2000))
  asPg(initdb, ['-D', join(dir, 'data'), '-U', 'postgres', '-A', 'trust', '--no-sync'])
  asPg(pgCtl, [
    '-D', join(dir, 'data'),
    '-o', `-p ${port} -k ${dir} -c listen_addresses='' -c fsync=off`,
    '-l', join(dir, 'log'),
    '-w', 'start',
  ])

  const run = (args: string[]) =>
    spawnSync(psql, ['-h', dir, '-p', port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', ...args], {
      encoding: 'utf8',
    })

  const failedMigrations: Record<string, string> = {}
  const stubRun = run(['-f', STUB])
  if (stubRun.status !== 0) throw new Error(`stub failed: ${stubRun.stderr}`)
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const r = run(['-f', join(MIGRATIONS, file)])
    if (r.status !== 0) {
      failedMigrations[file] = r.stderr.split('\n').find((l) => l.includes('ERROR')) ?? r.stderr
    }
  }

  const trySql = (query: string) => {
    const r = run(['-At', '-c', query])
    return { ok: r.status === 0, out: (r.status === 0 ? r.stdout : r.stderr).trim() }
  }
  return {
    failedMigrations,
    trySql,
    sql(query: string) {
      const r = trySql(query)
      if (!r.ok) throw new Error(`SQL failed: ${r.out}\n${query}`)
      return r.out
    },
    stop() {
      try {
        asPg(pgCtl, ['-D', join(dir, 'data'), '-m', 'immediate', 'stop'])
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
}

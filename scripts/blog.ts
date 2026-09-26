/**
 * Blog content engine CLI (generator v2). Runs the same pipeline as the
 * dashboard: src/lib/blog/generator.
 *
 *   npm run blog -- generate                 next queued topic → new DRAFT
 *   npm run blog -- rewrite <article-id> [--query "…"]
 *                                            rewrite into `revision` (live article untouched)
 *   npm run blog -- check <article.json> --query "…" [--rates USD=41.2,EUR=48.3]
 *        [--date 2026-09-25] [--targets targets.json] [--out expanded.json] [--offline]
 *                                            expand price markers + quality report for a
 *                                            hand-written article (nothing is saved to the DB)
 *
 * Env: BLOG_LLM_PROVIDER (gemini | anthropic, default gemini), GEMINI_API_KEY,
 * GEMINI_MODEL (fallback in src/lib/gemini.ts), NEXT_PUBLIC_SUPABASE_URL (or
 * SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { finalize, generateNextArticle, rewriteArticle, toDraft } from '@/lib/blog/generator'
import { loadLinkTargets, type LinkTargets } from '@/lib/blog/generator/link-targets'
import { fetchNbuRates, parseRates } from '@/lib/blog/generator/nbu'
import { checkSources, formatReport } from '@/lib/blog/generator/quality'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= process.env.SUPABASE_URL

const [command, ...rest] = process.argv.slice(2)
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}
const has = (name: string) => rest.includes(`--${name}`)

async function main(): Promise<number> {
  if (command === 'generate') {
    const r = await generateNextArticle()
    console.log(`${r.ok ? '✓' : '✖'} ${r.message}`)
    return r.ok ? 0 : 1
  }
  if (command === 'rewrite') {
    const id = rest[0]
    if (!id) throw new Error('usage: rewrite <article-id> [--query "…"]')
    const r = await rewriteArticle(id, flag('query'))
    console.log(`${r.ok ? '✓' : '✖'} ${r.message}`)
    return r.ok ? 0 : 1
  }
  if (command === 'check') {
    const file = rest[0]
    const query = flag('query')
    if (!file || !query) throw new Error('usage: check <article.json> --query "…"')
    const date = flag('date') ?? new Date().toISOString().slice(0, 10)
    const ratesSpec = flag('rates')
    const rates = ratesSpec ? parseRates(ratesSpec, date) : await fetchNbuRates(['USD', 'EUR'], new Date(date))
    const targetsFile = flag('targets')
    const targets: LinkTargets = targetsFile
      ? JSON.parse(readFileSync(targetsFile, 'utf8'))
      : await loadLinkTargets()
    const raw = toDraft(JSON.parse(readFileSync(file, 'utf8')))
    const { draft, prices, report } = finalize(raw, rates, query, targets)
    if (!has('offline')) {
      report.issues.push(...(await checkSources(draft, prices)))
      report.ok = !report.issues.some((i) => i.level === 'error')
    }
    console.log(formatReport(draft.title, report))
    const out = flag('out')
    if (out) writeFileSync(out, JSON.stringify({ ...draft, report, prices }, null, 2))
    return report.ok ? 0 : 2
  }
  console.log('commands: generate | rewrite <id> | check <file.json> --query "…"')
  return 1
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`✖ ${(error as Error).message}`)
    process.exit(1)
  }
)

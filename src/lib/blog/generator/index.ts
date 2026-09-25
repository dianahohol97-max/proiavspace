/**
 * Blog content engine v2 — one pipeline for the dashboard button, the CLI and
 * the scheduled GitHub Action:
 *
 *   research (LLM + web search) → write (LLM, facts only, JSON)
 *   → expand price markers (NBU rate of the day) → quality check
 *   → one fix pass if the check failed → source check → save
 *
 * New articles are saved as DRAFTS. "Rewrite" mode never touches the live
 * fields: it stores the new version in `revision`; an admin applies it in the
 * dashboard (slug and published_date are kept, modified_date is set then).
 */
import type { Block } from '@/lib/blog/articles'
import { slugifyUk } from '@/lib/seo/translit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadLinkTargets, type LinkTargets } from './link-targets'
import { fetchNbuRates } from './nbu'
import { expandPrices } from './prices'
import { buildFixPrompt, buildResearchPrompt, buildWritePrompt } from './prompts'
import { getProvider, parseJson, ProviderError, type LlmProvider } from './providers'
import { checkArticle, checkSources, formatReport, wordCount } from './quality'
import type { Draft, Fact, PriceRef, QualityReport, Rates, Topic } from './types'

export interface GenerateResult {
  ok: boolean
  /** Human-readable, Ukrainian — shown straight to the founder. */
  message: string
  articleId?: string
  title?: string
  report?: QualityReport
}

const BLOCK_TYPES = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'table', 'img', 'faq', 'cta'])

function isBlock(b: unknown): b is Block {
  if (!b || typeof b !== 'object') return false
  const x = b as Record<string, unknown>
  if (!BLOCK_TYPES.has(String(x.type))) return false
  switch (x.type) {
    case 'p':
    case 'h2':
    case 'h3':
      return typeof x.text === 'string'
    case 'ul':
    case 'ol':
      return Array.isArray(x.items) && x.items.every((i) => typeof i === 'string')
    case 'table':
      return Array.isArray(x.head) && Array.isArray(x.rows) && x.rows.every((r) => Array.isArray(r))
    case 'img':
      return typeof x.alt === 'string'
    case 'faq':
      return Array.isArray(x.items) && x.items.every((i) => i && typeof i.q === 'string' && typeof i.a === 'string')
    case 'cta':
      return typeof x.text === 'string' && typeof x.href === 'string'
  }
  return false
}

export function toDraft(raw: unknown): Draft {
  const a = raw as Partial<Draft>
  if (
    typeof a?.title !== 'string' ||
    typeof a.description !== 'string' ||
    !Array.isArray(a.body) ||
    !a.body.every(isBlock)
  )
    throw new ProviderError('Стаття не пройшла перевірку структури JSON.')
  return {
    title: a.title,
    seoTitle: typeof a.seoTitle === 'string' ? a.seoTitle : a.title,
    description: a.description,
    tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
    body: a.body,
  }
}

/** Expand price markers + run the offline check. */
export function finalize(raw: Draft, rates: Rates, query: string, targets: LinkTargets) {
  const { body, prices } = expandPrices(raw.body, rates)
  const draft: Draft = { ...raw, body }
  const report = checkArticle(draft, { query, targets, prices })
  return { draft, prices, report }
}

async function writeArticle(
  llm: LlmProvider,
  topic: Topic,
  today: string,
  rates: Rates,
  targets: LinkTargets,
  existing?: Block[]
): Promise<{ draft: Draft; prices: PriceRef[]; report: QualityReport; facts: Fact[] }> {
  // 1. research with web search
  const research = await llm.research(buildResearchPrompt(topic, today, existing))
  const facts = parseJson<Fact[]>(research.text, 'array').filter((f) => f && typeof f.claim === 'string')
  if (!facts.length) throw new ProviderError('Пошук не повернув жодного факту — статтю не пишемо.')

  // 2. write from the facts only
  const writePrompt = buildWritePrompt({ topic, today, facts, targets, existing })
  let raw = toDraft(parseJson(await llm.write(writePrompt), 'object'))
  let out = finalize(raw, rates, topic.query, targets)

  // 3. one fix pass for errors
  const errors = out.report.issues.filter((i) => i.level === 'error')
  if (errors.length) {
    try {
      raw = toDraft(parseJson(await llm.write(buildFixPrompt(JSON.stringify(raw), errors, writePrompt)), 'object'))
      out = finalize(raw, rates, topic.query, targets)
    } catch {
      // keep the first version; the report shows what is wrong
    }
  }

  // 4. sources answer + price numbers present on their pages
  const sourceIssues = await checkSources(out.draft, out.prices)
  out.report.issues.push(...sourceIssues)
  out.report.ok = !out.report.issues.some((i) => i.level === 'error')
  return { ...out, facts }
}

const readingMinutes = (body: Block[]) => Math.max(1, Math.round(wordCount(body) / 200))

function summary(title: string, report: QualityReport): string {
  const errors = report.issues.filter((i) => i.level === 'error').length
  const warnings = report.issues.length - errors
  return report.ok
    ? `Готово — чернетка «${title}» (${report.words} слів) пройшла перевірку${warnings ? `, зауважень: ${warnings}` : ''}.`
    : `Чернетку «${title}» збережено, але перевірка знайшла помилок: ${errors}. Звіт — на сторінці статті.`
}

/* ------------------------------------------------------------------ */

/** Generate the next queued topic into a new DRAFT. */
export async function generateNextArticle(): Promise<GenerateResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, message: 'Service role не налаштований на сервері.' }
  try {
    const llm = getProvider()
    const { data: topics, error } = await admin
      .from('blog_topics')
      .select('*')
      .eq('status', 'todo')
      .order('position', { ascending: true })
      .limit(1)
    if (error) return { ok: false, message: `Не вдалося прочитати чергу тем: ${error.message}` }
    const topic = (topics as Topic[] | null)?.[0]
    if (!topic) return { ok: false, message: 'Черга порожня — усі теми вже опрацьовані.' }

    const slug = slugifyUk(topic.query || topic.title, 60)
    const { data: existing } = await admin.from('blog_articles').select('id, status').eq('slug', slug).maybeSingle()
    if ((existing as { status?: string } | null)?.status === 'published')
      return { ok: false, message: `Стаття зі слагом ${slug} вже опублікована — онови її режимом «Переписати».` }

    const today = new Date().toISOString().slice(0, 10)
    const [rates, targets] = await Promise.all([fetchNbuRates(), loadLinkTargets()])
    const { draft, report, facts } = await writeArticle(llm, topic, today, rates, targets)

    const now = new Date().toISOString()
    const { data: inserted, error: insErr } = await admin
      .from('blog_articles')
      .upsert(
        {
          slug,
          title: draft.title,
          seo_title: draft.seoTitle,
          description: draft.description,
          published_date: today,
          reading_minutes: readingMinutes(draft.body),
          tags: draft.tags,
          body: draft.body,
          status: 'draft',
          source: `ai:${llm.name}`,
          author: 'eva-khudiuk',
          sources: facts,
          quality_report: report,
          updated_at: now,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .maybeSingle()
    if (insErr) return { ok: false, message: `Не вдалося зберегти чернетку: ${insErr.message}` }
    if (topic.id) await admin.from('blog_topics').update({ status: 'done' }).eq('id', topic.id)

    console.log(formatReport(draft.title, report))
    return {
      ok: true,
      message: summary(draft.title, report),
      articleId: (inserted as { id: string } | null)?.id,
      title: draft.title,
      report,
    }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

/**
 * "Update existing article": rewrite a DB article by the new rules into its
 * `revision`. The live article is untouched until the revision is applied.
 */
export async function rewriteArticle(articleId: string, query?: string): Promise<GenerateResult> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, message: 'Service role не налаштований на сервері.' }
  try {
    const llm = getProvider()
    const { data: row, error } = await admin.from('blog_articles').select('*').eq('id', articleId).maybeSingle()
    if (error || !row) return { ok: false, message: 'Статтю не знайдено.' }
    const r = row as { slug: string; title: string; seo_title?: string | null; tags: unknown; body: unknown }
    const tags = Array.isArray(r.tags) ? (r.tags as string[]) : []
    const topic: Topic = {
      title: r.title,
      query: query || r.seo_title || r.title,
      angle: `Оновлення наявної статті (теги: ${tags.join(', ')}).`,
    }
    const today = new Date().toISOString().slice(0, 10)
    const [rates, targets] = await Promise.all([fetchNbuRates(), loadLinkTargets(r.slug)])
    const { draft, report, facts } = await writeArticle(
      llm,
      topic,
      today,
      rates,
      targets,
      Array.isArray(r.body) ? (r.body as Block[]) : []
    )
    const revision = {
      title: draft.title,
      seoTitle: draft.seoTitle,
      description: draft.description,
      tags: draft.tags,
      body: draft.body,
      readingMinutes: readingMinutes(draft.body),
      sources: facts,
      report,
      generatedAt: new Date().toISOString(),
      provider: llm.name,
    }
    const { error: upErr } = await admin.from('blog_articles').update({ revision }).eq('id', articleId)
    if (upErr) return { ok: false, message: `Не вдалося зберегти оновлену версію: ${upErr.message}` }
    console.log(formatReport(draft.title, report))
    return {
      ok: true,
      message: `Оновлену версію збережено окремо (${report.words} слів, ${report.ok ? 'перевірку пройдено' : 'є помилки'}). Жива стаття не змінена — застосуй версію після перегляду.`,
      articleId,
      title: draft.title,
      report,
    }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

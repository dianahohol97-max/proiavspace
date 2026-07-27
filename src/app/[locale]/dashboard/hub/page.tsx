import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ToolLink {
  label: string
  href: string
  note?: string
  external?: boolean
  badge?: number
}

function ToolCard({ title, items }: { title: string; items: ToolLink[] }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <h3 className="font-brand text-lg">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.href + it.label} className="flex items-start gap-2 text-sm">
            {it.external ? (
              <a href={it.href} target="_blank" rel="noreferrer" className="font-bold text-accent hover:underline">
                {it.label} ↗
              </a>
            ) : (
              <Link href={it.href} className="font-bold text-accent hover:underline">
                {it.label} →
              </Link>
            )}
            {typeof it.badge === 'number' && it.badge > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                {it.badge}
              </span>
            )}
            {it.note && <span className="text-muted">· {it.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Founder-only content hub: every content machine in one place, so nothing
 * lives only in someone's memory — проЯв queues (with live counts), VistelaCo
 * Pinterest pipeline, and the weekly routine checklist.
 */
export default async function HubPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  // Live counts for the "what needs me" badges.
  const admin = createSupabaseAdminClient()
  let postsToApprove = 0
  let threadsDrafts = 0
  let ownPostDrafts = 0
  if (admin) {
    const [posts, replies, own] = await Promise.all([
      admin.from('social_posts').select('id', { count: 'exact', head: true }).in('status', ['draft', 'ready']),
      admin.from('threads_replies').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      admin.from('threads_posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ])
    postsToApprove = posts.count ?? 0
    threadsDrafts = replies.count ?? 0
    ownPostDrafts = own.count ?? 0
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-brand text-3xl">Контент-хаб</h1>
      <p className="mt-2 text-sm text-muted">
        Уся контент-машина в одному місці: черги проЯв, Pinterest VistelaCo, інструменти й
        тижнева рутина. Якщо щось треба зробити — воно тут.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ToolCard
          title="проЯв · соцмережі"
          items={[
            { label: 'Контент (пости/каруселі/рілси)', href: `/${locale}/dashboard/content`, badge: postsToApprove, note: 'на затвердження' },
            { label: 'Сторіс (highlight-набори)', href: `/${locale}/dashboard/stories`, note: 'завантажити і залити' },
            { label: 'Threads · коментарі', href: `/${locale}/dashboard/threads`, badge: threadsDrafts, note: 'драфти чекають' },
            { label: 'Threads · пости', href: `/${locale}/dashboard/threads`, badge: ownPostDrafts, note: 'у стрічку' },
          ]}
        />

        <ToolCard
          title="VistelaCo · Pinterest"
          items={[
            {
              label: 'Черга пінів (Google Sheets)',
              href: 'https://docs.google.com/spreadsheets/d/1Nd8iF0eJI3fJne_9Y37tJjFOazvzRRJTzSaQtNUthMc',
              external: true,
              note: 'постер бере звідси 1 пін/день о 23:55',
            },
            {
              label: 'Pin Generator (робить графіку + тексти)',
              href: 'https://github.com/dianahohol97-max/Vistela-Pin-Generator',
              external: true,
              note: 'npm run dev → наповнюй чергу',
            },
            {
              label: 'Make · Daily Pinterest Poster',
              href: 'https://eu2.make.com/2099159/scenarios/9075841/edit',
              external: true,
              note: 'борди+alt автоматично',
            },
            {
              label: 'Pinterest Analytics',
              href: 'https://analytics.pinterest.com/',
              external: true,
              note: 'дивись saves і outbound clicks',
            },
          ]}
        />

        <ToolCard
          title="Автоматизації Make"
          items={[
            { label: 'Публікація зараз (кнопка в Контенті)', href: 'https://eu2.make.com/2099159/scenarios/9579491/edit', external: true },
            { label: 'Тест Threads-скану', href: 'https://eu2.make.com/2099159/scenarios/9579266/edit', external: true },
            { label: 'Усі сценарії', href: 'https://eu2.make.com/2099159/scenarios', external: true },
          ]}
        />

        <ToolCard
          title="Фабрики контенту (репо)"
          items={[
            { label: 'proyav-content-factory', href: 'https://github.com/dianahohol97-max/proyav-content-factory', external: true, note: 'каруселі + сторіс проЯв' },
            { label: 'Vistela-Pin-Generator', href: 'https://github.com/dianahohol97-max/Vistela-Pin-Generator', external: true, note: '24 шаблони пінів' },
          ]}
        />
      </div>

      {/* Weekly routine */}
      <section className="mt-10 rounded-2xl bg-bg p-6">
        <h2 className="font-brand text-xl">Тижнева рутина</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-fg">
          <li>
            <b>Пн–Пт (5 хв):</b> зайти в «Контент» і «Threads» — затвердити/опублікувати те, що
            назбиралось (бейджі вище підкажуть, чи є що).
          </li>
          <li>
            <b>1× на тиждень (30–40 хв):</b> Pin Generator — згенерувати 7–10 нових пінів у чергу
            VistelaCo (різні лістинги! той самий URL — не частіше ніж раз на 3 дні).
          </li>
          <li>
            <b>1× на тиждень (10 хв):</b> Threads — закинути 3–5 скрінів трендових постів, отримати
            коментарі, опублікувати.
          </li>
          <li>
            <b>1× на місяць:</b> Pinterest Analytics — глянути saves rate і outbound clicks (не
            impressions); прибрати борди без руху.
          </li>
        </ol>
      </section>

      {/* One-time TODO */}
      <section className="mt-6 rounded-2xl border border-line p-6">
        <h2 className="font-brand text-xl">Разові задачі (закрий і забудь)</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg">
          <li>Vercel: додати <code className="rounded bg-bg px-1">MAKE_PUBLISH_HOOK_URL</code> → кнопка «Опублікувати зараз» стане миттєвою</li>
          <li>Pinterest: знайти старий профіль dianahoholsmm → перейменувати або видалити</li>
          <li>Pinterest: Claim Etsy + bio з ключовими словами на @vistelaco</li>
          <li>Pinterest: перенести 41+3 піни у «Wedding Website Templates» (борд → вибрати всі → Move) і видалити порожні борди</li>
          <li>Pinterest: підключити Instagram (Claimed accounts) для авто-публікації</li>
          <li>Buffer: під&apos;єднати в Make → скажи мені, додам TikTok-гілку в «Публікація зараз»</li>
          <li>Ротувати Gemini-ключі та Threads app secret (світились у чаті)</li>
        </ul>
      </section>
    </main>
  )
}

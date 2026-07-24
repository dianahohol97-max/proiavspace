import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminArticles, getCuratedArticles, getTopicStats } from '@/lib/blog/articles'
import { isAdminEmail } from '@/lib/admin'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Founder-only blog CMS: review AI drafts, publish, and see what's live. */
export default async function BlogAdminPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const [articles, curated, topics] = await Promise.all([
    getAdminArticles(),
    Promise.resolve(getCuratedArticles()),
    getTopicStats(),
  ])
  const drafts = articles.filter((a) => a.status === 'draft')
  const published = articles.filter((a) => a.status === 'published')

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-brand text-3xl">Блог</h1>
      <p className="mt-2 text-sm text-muted">
        Чернетки від контент-двигуна зʼявляються тут. Переглянь і опублікуй — усе в одному місці.
      </p>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <span className="rounded-full border border-line px-4 py-1.5">
          Черга тем: <b>{topics.todo}</b> у роботі · {topics.done} готово
        </span>
        <span className="rounded-full border border-line px-4 py-1.5">
          Опубліковано: <b>{published.length + curated.length}</b>
        </span>
      </div>

      {/* --- drafts to review --- */}
      <section className="mt-10">
        <h2 className="mb-4 font-brand text-xl">На перегляд · {drafts.length}</h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">
            Немає нових чернеток. Двигун додасть їх за розкладом (Пн і Чт) або запусти вручну в GitHub → Actions.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {drafts.map((a) => (
              <Link
                key={a.id}
                href={`/${locale}/dashboard/blog/${a.id}`}
                className="flex items-center gap-3 px-5 py-4 no-underline hover:bg-bg"
              >
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  Чернетка
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-fg">{a.title}</span>
                  <span className="block truncate text-xs text-muted">{a.description}</span>
                </span>
                <span className="text-sm text-accent">Переглянути →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- published (from DB) --- */}
      {published.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-brand text-xl">Опубліковані двигуном · {published.length}</h2>
          <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {published.map((a) => (
              <Link
                key={a.id}
                href={`/${locale}/dashboard/blog/${a.id}`}
                className="flex items-center gap-3 px-5 py-4 no-underline hover:bg-bg"
              >
                <span className="rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  Онлайн
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{a.title}</span>
                <span className="text-sm text-accent">Керувати →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --- curated (built-in) --- */}
      <section className="mt-10">
        <h2 className="mb-4 font-brand text-xl">Вбудовані статті · {curated.length}</h2>
        <p className="mb-3 text-xs text-muted">Написані вручну, завжди опубліковані. Редагуються в коді.</p>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {curated.map((a) => (
            <li key={a.slug}>
              <Link href={`/${locale}/blog/${a.slug}`} className="hover:text-fg">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

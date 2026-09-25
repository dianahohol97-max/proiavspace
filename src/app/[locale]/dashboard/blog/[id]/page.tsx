import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminArticle } from '@/lib/blog/articles'
import {
  applyRevision,
  deleteArticle,
  discardRevision,
  setArticleStatus,
  updateArticle,
} from '@/lib/actions/blog'
import { isAdminEmail } from '@/lib/admin'
import { isLocale } from '@/lib/i18n/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ArticleBody } from '@/components/blog/ArticleBody'
import { QualityReportView } from '@/components/blog/QualityReportView'
import { RewriteButton } from './RewriteButton'

export const dynamic = 'force-dynamic'
// The rewrite action (research + writing + source check) takes 1–3 minutes.
export const maxDuration = 300

/** Review one AI article: rendered preview + publish / edit / delete. */
export default async function BlogReviewPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const article = await getAdminArticle(params.id)
  if (!article) notFound()

  const isPublished = article.status === 'published'
  const publishAction = setArticleStatus.bind(null, locale, article.id, 'published')
  const unpublishAction = setArticleStatus.bind(null, locale, article.id, 'draft')
  const deleteAction = deleteArticle.bind(null, locale, article.id)
  const updateAction = updateArticle.bind(null, locale, article.id)
  const applyAction = applyRevision.bind(null, locale, article.id)
  const discardAction = discardRevision.bind(null, locale, article.id)
  const revision = article.revision

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/${locale}/dashboard/blog`} className="text-sm text-muted hover:text-fg">
        ← Усі статті
      </Link>

      {/* --- status + actions --- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            isPublished ? 'bg-emerald-600/10 text-emerald-700' : 'bg-amber-500/15 text-amber-700'
          }`}
        >
          {isPublished ? 'Онлайн' : 'Чернетка'}
        </span>
        {isPublished ? (
          <>
            <a
              href={`/${locale}/blog/${article.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline"
            >
              Відкрити на сайті ↗
            </a>
            <form action={unpublishAction}>
              <button type="submit" className="text-sm text-muted underline hover:text-fg">
                Зняти з публікації
              </button>
            </form>
          </>
        ) : (
          <form action={publishAction}>
            <button
              type="submit"
              className="rounded-full bg-accent px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
            >
              Опублікувати
            </button>
          </form>
        )}
        <form action={deleteAction} className="ml-auto">
          <button type="submit" className="text-sm text-accent underline">
            Видалити
          </button>
        </form>
      </div>

      {/* --- quality report of the current body --- */}
      {article.qualityReport && (
        <section className="mt-6">
          <QualityReportView report={article.qualityReport} />
        </section>
      )}

      {/* --- rendered preview --- */}
      <article className="mt-8 rounded-2xl border border-line p-6">
        <p className="text-xs uppercase tracking-widest text-muted">
          {article.readingMinutes} хв · {article.tags.join(' · ')}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight">{article.title}</h1>
        {article.seoTitle && (
          <p className="mt-2 text-xs text-muted">
            &lt;title&gt; ({article.seoTitle.length}): {article.seoTitle}
          </p>
        )}
        <p className="mt-2 text-muted">{article.description}</p>
        <ArticleBody blocks={article.body} locale={locale} />
      </article>

      {/* --- update existing article (rewrite into a revision) --- */}
      <section className="mt-10 rounded-2xl border border-line p-5">
        <h2 className="font-brand text-lg">Оновити статтю</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Перепише статтю за поточними правилами (факти з пошуку, таблиця, FAQ, перевірка). Слаг і дата
          публікації збережуться. Нова версія зʼявиться нижче — жива стаття не зміниться, поки не
          натиснеш «Застосувати».
        </p>
        <RewriteButton locale={locale} id={article.id} defaultQuery={article.seoTitle ?? article.title} />
      </section>

      {revision && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-brand text-xl">Оновлена версія</h2>
            <span className="text-xs text-muted">
              {new Date(revision.generatedAt).toLocaleString('uk-UA')} · {revision.provider}
            </span>
            <form action={applyAction} className="ml-auto">
              <button
                type="submit"
                className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
              >
                Застосувати
              </button>
            </form>
            <form action={discardAction}>
              <button type="submit" className="text-sm text-muted underline hover:text-fg">
                Відхилити
              </button>
            </form>
          </div>
          {revision.report && (
            <div className="mt-4">
              <QualityReportView report={revision.report} />
            </div>
          )}
          <article className="mt-4 rounded-2xl border border-line p-6">
            <h1 className="font-display text-3xl leading-tight">{revision.title}</h1>
            <p className="mt-2 text-xs text-muted">&lt;title&gt;: {revision.seoTitle}</p>
            <p className="mt-2 text-muted">{revision.description}</p>
            <ArticleBody blocks={revision.body} locale={locale} />
          </article>
        </section>
      )}

      {/* --- light editing --- */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-bold text-muted">Редагувати текст</summary>
        <form action={updateAction} className="mt-4 flex flex-col gap-3">
          <label className="text-xs text-muted">Заголовок</label>
          <input
            name="title"
            defaultValue={article.title}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
          />
          <label className="text-xs text-muted">Опис (meta)</label>
          <input
            name="description"
            defaultValue={article.description}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-fg"
          />
          <label className="text-xs text-muted">Тіло (JSON-блоки)</label>
          <textarea
            name="body"
            rows={16}
            defaultValue={JSON.stringify(article.body, null, 2)}
            className="border border-line bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-fg"
          />
          <button
            type="submit"
            className="self-start rounded-full border border-fg px-6 py-2 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-fg hover:text-bg"
          >
            Зберегти зміни
          </button>
        </form>
      </details>
    </main>
  )
}

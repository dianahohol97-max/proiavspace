import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { draftReplyFromInput, setReplyStatus, updateReplyDraft } from '@/lib/actions/threads'
import { ageLabel, getThreadsReplies, isFresh, type ThreadsReply } from '@/lib/social/threads'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function ReplyCard({ reply, locale }: { reply: ThreadsReply; locale: Locale }) {
  const age = ageLabel(reply.source_created_at)
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-bold text-fg">{reply.source_author ?? 'Threads'}</span>
        {reply.keyword && (
          <span className="rounded-full bg-bg px-2 py-0.5">#{reply.keyword}</span>
        )}
        {age && <span className="text-muted">· {age}</span>}
        <a
          href={reply.source_url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-accent hover:underline"
        >
          Відкрити пост →
        </a>
      </div>
      <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-sm text-muted">{reply.source_text}</p>

      <form action={updateReplyDraft.bind(null, locale, reply.id)} className="mt-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">
          Драфт відповіді від проЯв
        </label>
        <textarea
          name="draft_reply"
          defaultValue={reply.draft_reply}
          rows={4}
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
        />
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:text-fg">
            Зберегти правки
          </button>
        </div>
      </form>

      <div className="mt-3 flex items-center gap-2">
        <form action={setReplyStatus.bind(null, locale, reply.id, 'approved')}>
          <button className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white">
            ✅ Затвердити
          </button>
        </form>
        <form action={setReplyStatus.bind(null, locale, reply.id, 'skipped')}>
          <button className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-muted hover:text-fg">
            ❌ Пропустити
          </button>
        </form>
      </div>
    </div>
  )
}

/** Founder-only Threads engagement: approve/edit AI-drafted replies from проЯв. */
export default async function ThreadsAdminPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const replies = await getThreadsReplies()
  // Reply only to fresh posts: drafts whose source is older than the window are hidden.
  const allDrafts = replies.filter((r) => r.status === 'draft')
  const drafts = allDrafts.filter((r) => isFresh(r.source_created_at))
  const staleHidden = allDrafts.length - drafts.length
  const approved = replies.filter((r) => r.status === 'approved')
  const posted = replies.filter((r) => r.status === 'posted')

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-brand text-3xl">Threads</h1>
      <p className="mt-2 text-sm text-muted">
        Система знаходить релевантні пости за останні 3 дні й накидає корисні відповіді від
        проЯв. Переглянь, за потреби виправ і затвердь.
      </p>

      {/* Manual seed: paste a post you found → проЯв drafts a reply */}
      <form
        action={draftReplyFromInput.bind(null, locale)}
        className="mt-6 rounded-2xl border border-line p-5"
      >
        <p className="text-sm font-bold text-fg">Створити драфт на свій пост</p>
        <p className="mb-3 text-xs text-muted">
          Знайшла пост сама? Встав текст (і за бажанням лінк та автора) — проЯв напише відповідь.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="source_url"
            placeholder="Лінк на пост (необов'язково)"
            className="w-full rounded-xl border border-line bg-white p-2.5 text-sm text-fg sm:w-2/3"
          />
          <input
            name="source_author"
            placeholder="@автор (необов'язково)"
            className="w-full rounded-xl border border-line bg-white p-2.5 text-sm text-fg sm:w-1/3"
          />
        </div>
        <textarea
          name="source_text"
          required
          rows={3}
          placeholder="Текст поста, на який відповідаємо…"
          className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
        />
        <button className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white">
          Створити драфт
        </button>
      </form>

      <section className="mt-8">
        <h2 className="mb-2 font-brand text-xl">На затвердження · {drafts.length}</h2>
        {staleHidden > 0 && (
          <p className="mb-4 text-xs text-muted">
            Приховано {staleHidden} старших за 3 дні — на них не відповідаємо.
          </p>
        )}
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">Немає свіжих драфтів. Система додасть їх за розкладом.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {drafts.map((r) => (
              <ReplyCard key={r.id} reply={r} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {approved.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-brand text-xl">Затверджено · {approved.length}</h2>
          <div className="flex flex-col gap-4">
            {approved.map((r) => (
              <ReplyCard key={r.id} reply={r} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {posted.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-brand text-xl">Опубліковано · {posted.length}</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {posted.map((r) => (
              <li key={r.id}>
                <a href={r.source_url} target="_blank" rel="noreferrer" className="hover:text-fg">
                  {r.source_author ?? 'Threads'} — {r.draft_reply.slice(0, 60)}…
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

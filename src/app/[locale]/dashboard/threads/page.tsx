import { notFound, redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import {
  createOwnPost,
  draftReplyFromInput,
  setOwnPostStatus,
  setReplyStatus,
  updateOwnPost,
  updateReplyDraft,
} from '@/lib/actions/threads'
import {
  ageLabel,
  getThreadsPosts,
  getThreadsReplies,
  isFresh,
  type ThreadsPost,
  type ThreadsReply,
} from '@/lib/social/threads'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ScreenshotUpload } from './ScreenshotUpload'

export const dynamic = 'force-dynamic'

function ReplyCard({ reply, locale }: { reply: ThreadsReply; locale: Locale }) {
  const age = ageLabel(reply.source_created_at)
  const openable = reply.source_url.startsWith('http')
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-bold text-fg">{reply.source_author ?? 'Threads'}</span>
        {reply.keyword && (
          <span className="rounded-full bg-bg px-2 py-0.5">#{reply.keyword}</span>
        )}
        {age && <span className="text-muted">· {age}</span>}
        {openable && (
          <a
            href={reply.source_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-accent hover:underline"
          >
            Відкрити пост →
          </a>
        )}
      </div>
      <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-sm text-muted">{reply.source_text}</p>

      <form action={updateReplyDraft.bind(null, locale, reply.id)} className="mt-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">
          Коментар від проЯв
        </label>
        <textarea
          name="draft_reply"
          defaultValue={reply.draft_reply}
          rows={3}
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
        />
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:text-fg">
            Зберегти правки
          </button>
        </div>
      </form>

      <div className="mt-3 flex items-center gap-2">
        <form action={setReplyStatus.bind(null, locale, reply.id, 'posted')}>
          <button className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white">
            ✅ Опубліковано
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

function OwnPostCard({ post, locale }: { post: ThreadsPost; locale: Locale }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-xs text-muted">
        Ідея: <span className="text-fg">{post.idea}</span>
      </p>
      <form action={updateOwnPost.bind(null, locale, post.id)} className="mt-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">
          Текст поста
        </label>
        <textarea
          name="draft_text"
          defaultValue={post.draft_text}
          rows={4}
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
        />
        <div className="mt-2">
          <button className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:text-fg">
            Зберегти правки
          </button>
        </div>
      </form>
      <div className="mt-3 flex items-center gap-2">
        <form action={setOwnPostStatus.bind(null, locale, post.id, 'posted')}>
          <button className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white">
            ✅ Опубліковано
          </button>
        </form>
        <form action={setOwnPostStatus.bind(null, locale, post.id, 'archived')}>
          <button className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-muted hover:text-fg">
            🗄 В архів
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * Founder-only Threads workspace, two lanes:
 * 1) «Пости» — the founder gives an idea, проЯв drafts a feed post;
 * 2) «Коментарі» — screenshot or pasted text of ANY post (trending included)
 *    → an on-voice comment draft. Publishing happens manually in Threads.
 */
export default async function ThreadsAdminPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale: Locale = params.locale

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!isAdminEmail(user.email)) notFound()

  const [replies, ownPosts] = await Promise.all([getThreadsReplies(), getThreadsPosts()])

  const allDrafts = replies.filter((r) => r.status === 'draft')
  // Auto-scan finds get the freshness window; the founder's own seeds (manual
  // text or screenshot) are always shown — she just added them on purpose.
  const drafts = allDrafts.filter(
    (r) => r.keyword === 'вручну' || r.keyword === 'скрін' || isFresh(r.source_created_at)
  )
  const staleHidden = allDrafts.length - drafts.length
  const postDrafts = ownPosts.filter((p) => p.status === 'draft')
  const postedPosts = ownPosts.filter((p) => p.status === 'posted')
  const postedReplies = replies.filter((r) => r.status === 'posted' || r.status === 'approved')

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-brand text-3xl">Threads</h1>
      <p className="mt-2 text-sm text-muted">
        Дві смуги: <b>пости</b> у стрічку проЯв і <b>коментарі</b> під чужими постами. Усе
        публікуєш вручну — тут тільки готові тексти в голосі бренду.
      </p>

      {/* ================= 1. Own feed posts ================= */}
      <section className="mt-10">
        <h2 className="font-brand text-xl">Пости в стрічку</h2>
        <form
          action={createOwnPost.bind(null, locale)}
          className="mt-4 rounded-2xl border border-line p-5"
        >
          <p className="text-sm font-bold text-fg">Новий пост</p>
          <p className="mb-3 text-xs text-muted">
            Опиши ідею або тему — проЯв напише пост у голосі бренду.
          </p>
          <textarea
            name="idea"
            required
            rows={2}
            placeholder="Напр.: пост про те, як клієнти гублять фото в архівах…"
            className="w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
          />
          <button className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white">
            Написати пост
          </button>
        </form>

        {postDrafts.length > 0 && (
          <div className="mt-4 flex flex-col gap-4">
            {postDrafts.map((p) => (
              <OwnPostCard key={p.id} post={p} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {/* ================= 2. Comments on other posts ================= */}
      <section className="mt-12">
        <h2 className="font-brand text-xl">Коментарі до чужих постів</h2>
        <p className="mt-1 text-xs text-muted">
          Може бути будь-який пост — і тренд не про фото. Голос бренду збережеться, проЯв
          згадається лише якщо доречно.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ScreenshotUpload />

          <form
            action={draftReplyFromInput.bind(null, locale)}
            className="rounded-2xl border border-line p-5"
          >
            <p className="text-sm font-bold text-fg">Або встав текст поста</p>
            <p className="mb-3 text-xs text-muted">Текст + за бажанням лінк і автор.</p>
            <input
              name="source_url"
              placeholder="Лінк (необов'язково)"
              className="mb-2 w-full rounded-xl border border-line bg-white p-2.5 text-sm text-fg"
            />
            <input
              name="source_author"
              placeholder="@автор (необов'язково)"
              className="mb-2 w-full rounded-xl border border-line bg-white p-2.5 text-sm text-fg"
            />
            <textarea
              name="source_text"
              required
              rows={3}
              placeholder="Текст поста…"
              className="w-full rounded-xl border border-line bg-white p-3 text-sm text-fg"
            />
            <button className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white">
              Створити коментар
            </button>
          </form>
        </div>

        <h3 className="mb-2 mt-8 font-brand text-lg">На затвердження · {drafts.length}</h3>
        {staleHidden > 0 && (
          <p className="mb-4 text-xs text-muted">
            Приховано {staleHidden} автознахідок, старших за 3 дні.
          </p>
        )}
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">
            Поки порожньо. Додай скріншот або текст поста вище.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {drafts.map((r) => (
              <ReplyCard key={r.id} reply={r} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {/* ================= History ================= */}
      {(postedPosts.length > 0 || postedReplies.length > 0) && (
        <section className="mt-12">
          <h2 className="mb-3 font-brand text-xl">Опубліковано</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {postedPosts.map((p) => (
              <li key={p.id}>📝 {p.draft_text.slice(0, 80)}…</li>
            ))}
            {postedReplies.map((r) => (
              <li key={r.id}>
                {r.source_url.startsWith('http') ? (
                  <a href={r.source_url} target="_blank" rel="noreferrer" className="hover:text-fg">
                    💬 {r.source_author ?? 'Threads'} — {r.draft_reply.slice(0, 60)}…
                  </a>
                ) : (
                  <span>
                    💬 {r.source_author ?? 'Threads'} — {r.draft_reply.slice(0, 60)}…
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
